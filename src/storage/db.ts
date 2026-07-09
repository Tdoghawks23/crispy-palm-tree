/**
 * IndexedDB persistence — PRD R11-R14.
 *
 * Uses `idb` over IndexedDB (approved stack, CLAUDE.md). Three stores:
 *  - programState: single record — active variant, current week/day,
 *    rotation state (R11). First run initializes to 4-day/week 1/Mon (R14).
 *  - setLogs: append-only per-set log rows (exercise id, set index, weight,
 *    reps, timestamp) — never overwritten (R12).
 *  - sessionProgress: single record for the in-progress session's
 *    checked/logged state, saved incrementally so closing and reopening
 *    mid-session restores exactly where the user left off (R13).
 *
 * This is the one layer (besides UI) allowed side effects (CLAUDE.md).
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { getSession, TRAINING_DAYS, type Variant } from '../data/program';
import { advanceRotationState, INITIAL_ROTATION_STATE, type RotationState } from '../engine/rotation';
import { nextTrainingDay } from './advance';

const DB_NAME = 'arm-growth';
const DB_VERSION = 1;
const SINGLETON_KEY = 'current';

export interface ProgramState {
  variant: Variant;
  week: number;
  day: string;
  rotationState: RotationState;
}

export const DEFAULT_PROGRAM_STATE: ProgramState = {
  variant: '4-day',
  week: 1,
  day: 'Mon',
  rotationState: INITIAL_ROTATION_STATE,
};

export interface SetLogEntry {
  id?: number;
  exerciseId: string;
  setIndex: number;
  weight: number;
  reps: number;
  timestamp: number;
}

export interface SessionProgress {
  variant: Variant;
  week: number;
  day: string;
  /** Ids of checked warm-up/main/cool-down steps, e.g. "main-2-set-1". */
  checkedSteps: string[];
  /** In-progress weight/reps input values keyed by the same step ids, saved before a set is checked off. */
  setInputs: Record<string, { weight?: number; reps?: number }>;
  updatedAt: number;
}

interface AppDBSchema extends DBSchema {
  programState: {
    key: string;
    value: ProgramState;
  };
  setLogs: {
    key: number;
    value: SetLogEntry;
    indexes: { byExercise: string };
  };
  sessionProgress: {
    key: string;
    value: SessionProgress;
  };
}

let dbPromise: Promise<IDBPDatabase<AppDBSchema>> | undefined;

function getDB(): Promise<IDBPDatabase<AppDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AppDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('programState')) {
          db.createObjectStore('programState');
        }
        if (!db.objectStoreNames.contains('setLogs')) {
          const store = db.createObjectStore('setLogs', { keyPath: 'id', autoIncrement: true });
          store.createIndex('byExercise', 'exerciseId');
        }
        if (!db.objectStoreNames.contains('sessionProgress')) {
          db.createObjectStore('sessionProgress');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Test-only escape hatch: drops the cached connection handle and deletes
 * the database so each test file starts from a clean slate. Never called
 * from application code.
 */
export async function _resetForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
  }
  dbPromise = undefined;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

// ---------------------------------------------------------------------
// Program state (R11, R14)
// ---------------------------------------------------------------------

/** First-run (empty IndexedDB) initializes to 4-day/week 1/Mon (R14). */
export async function getProgramState(): Promise<ProgramState> {
  const db = await getDB();
  const existing = await db.get('programState', SINGLETON_KEY);
  if (existing) return existing;
  await db.put('programState', DEFAULT_PROGRAM_STATE, SINGLETON_KEY);
  return DEFAULT_PROGRAM_STATE;
}

export async function saveProgramState(state: ProgramState): Promise<void> {
  const db = await getDB();
  await db.put('programState', state, SINGLETON_KEY);
}

/**
 * Marks the current session complete: advances rotation state for every
 * pattern used in the just-finished session, then advances day/week (R17,
 * §8 restart-at-week-12 behavior lives in `nextTrainingDay`). The only
 * action that advances program state — partial completion never calls
 * this (R17).
 */
export async function completeSession(): Promise<ProgramState> {
  const current = await getProgramState();
  const programSession = getSession(current.variant, current.week, current.day);
  const patternsUsed = programSession
    ? [...new Set(programSession.slots.map((s) => s.pattern))]
    : [];
  const rotationState = advanceRotationState(current.rotationState, patternsUsed);
  const next = nextTrainingDay(current.variant, current);
  const nextState: ProgramState = { variant: current.variant, ...next, rotationState };
  await saveProgramState(nextState);
  await clearSessionProgress();
  return nextState;
}

/** Skips the current day without logging a completed session or rotating exercises. */
export async function skipDay(): Promise<ProgramState> {
  const current = await getProgramState();
  const next = nextTrainingDay(current.variant, current);
  const nextState: ProgramState = { ...current, ...next };
  await saveProgramState(nextState);
  await clearSessionProgress();
  return nextState;
}

/** Repeats the current day: clears in-progress session state, keeps week/day/rotation unchanged. */
export async function repeatDay(): Promise<ProgramState> {
  const current = await getProgramState();
  await clearSessionProgress();
  return current;
}

/**
 * Switches variant mid-program (§8 edge case): the mesocycle week is
 * preserved, the day resets to the new variant's first training day of
 * that week, and rotation state carries over so the switch doesn't repeat
 * the same exercise twice in a row.
 */
export async function switchVariant(newVariant: Variant): Promise<ProgramState> {
  const current = await getProgramState();
  if (current.variant === newVariant) return current;
  const nextState: ProgramState = {
    variant: newVariant,
    week: current.week,
    day: TRAINING_DAYS[newVariant][0],
    rotationState: current.rotationState,
  };
  await saveProgramState(nextState);
  await clearSessionProgress();
  return nextState;
}

/**
 * Manual week/day override (R19 program-overview screen). Unlike
 * completeSession/skipDay this does not advance rotation state — it's a
 * direct jump, not a training-day transition.
 */
export async function setWeekDay(week: number, day: string): Promise<ProgramState> {
  const current = await getProgramState();
  if (!TRAINING_DAYS[current.variant].includes(day)) {
    throw new Error(`"${day}" is not a training day for the ${current.variant} variant`);
  }
  const nextState: ProgramState = { ...current, week, day };
  await saveProgramState(nextState);
  await clearSessionProgress();
  return nextState;
}

// ---------------------------------------------------------------------
// Per-set logs (R12) — append-only, never overwritten
// ---------------------------------------------------------------------

export async function addSetLog(entry: Omit<SetLogEntry, 'id'>): Promise<void> {
  const db = await getDB();
  await db.add('setLogs', entry as SetLogEntry);
}

/** All logged sets for an exercise, oldest first. */
export async function getSetLogsForExercise(exerciseId: string): Promise<SetLogEntry[]> {
  const db = await getDB();
  const logs = await db.getAllFromIndex('setLogs', 'byExercise', exerciseId);
  return logs.sort((a, b) => a.timestamp - b.timestamp);
}

export async function getAllSetLogs(): Promise<SetLogEntry[]> {
  const db = await getDB();
  const logs = await db.getAll('setLogs');
  return logs.sort((a, b) => a.timestamp - b.timestamp);
}

// ---------------------------------------------------------------------
// In-progress session state (R13)
// ---------------------------------------------------------------------

export async function getSessionProgress(): Promise<SessionProgress | undefined> {
  const db = await getDB();
  return db.get('sessionProgress', SINGLETON_KEY);
}

/** Called on every checkbox/log interaction so a mid-session close/reopen restores exactly (R13). */
export async function saveSessionProgress(progress: SessionProgress): Promise<void> {
  const db = await getDB();
  await db.put('sessionProgress', progress, SINGLETON_KEY);
}

export async function clearSessionProgress(): Promise<void> {
  const db = await getDB();
  await db.delete('sessionProgress', SINGLETON_KEY);
}
