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

/**
 * The (variant, week, day) triple a caller believes it's currently acting
 * on. completeSession/skipDay require this and treat a mismatch (program
 * state has already moved past it) as a no-op — see `advanceProgramState`.
 */
export interface SessionIdentity {
  variant: Variant;
  week: number;
  day: string;
}

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
 * Reads programState and, IF it still matches `expected`, writes
 * `computeNext(current)` back — all inside a single IndexedDB readwrite
 * transaction on the programState store. This closes both the atomicity
 * gap (get/compute/put used to be three separate transactions, letting a
 * second call interleave between them) and makes a duplicate call a
 * no-op: IndexedDB serializes readwrite transactions against the same
 * store, so a second, overlapping call's read is guaranteed to happen
 * only after the first call's write has committed — at which point
 * `current` no longer matches `expected`, and this returns the
 * already-advanced state unchanged instead of advancing a second time.
 *
 * Fixes the double-tap "Complete session" bug: two calls for the same
 * (variant, week, day) racing (or staggered a few ms apart) now advance
 * state exactly once, never twice.
 */
async function advanceProgramState(
  expected: SessionIdentity,
  computeNext: (current: ProgramState) => ProgramState,
): Promise<ProgramState> {
  const db = await getDB();
  const tx = db.transaction('programState', 'readwrite');
  const store = tx.objectStore('programState');
  const current = (await store.get(SINGLETON_KEY)) ?? DEFAULT_PROGRAM_STATE;

  if (
    current.variant !== expected.variant ||
    current.week !== expected.week ||
    current.day !== expected.day
  ) {
    await tx.done;
    return current;
  }

  const nextState = computeNext(current);
  await store.put(nextState, SINGLETON_KEY);
  await tx.done;
  return nextState;
}

/**
 * Marks the session identified by `expected` complete: advances rotation
 * state for every pattern used in that session, then advances day/week
 * (R17, §8 restart-at-week-12 behavior lives in `nextTrainingDay`). The
 * only action that advances program state — partial completion never
 * calls this (R17). Idempotent per `advanceProgramState` above: a
 * duplicate/re-entrant call for the same `expected` identity is a no-op.
 */
export async function completeSession(expected: SessionIdentity): Promise<ProgramState> {
  const nextState = await advanceProgramState(expected, (current) => {
    const programSession = getSession(current.variant, current.week, current.day);
    const patternsUsed = programSession
      ? [...new Set(programSession.slots.map((s) => s.pattern))]
      : [];
    const rotationState = advanceRotationState(current.rotationState, patternsUsed);
    const next = nextTrainingDay(current.variant, current);
    return { variant: current.variant, ...next, rotationState };
  });
  await clearSessionProgress();
  return nextState;
}

/**
 * Skips the day identified by `expected` without logging a completed
 * session or rotating exercises. Idempotent the same way completeSession
 * is — a duplicate call for the same identity is a no-op.
 */
export async function skipDay(expected: SessionIdentity): Promise<ProgramState> {
  const nextState = await advanceProgramState(expected, (current) => {
    const next = nextTrainingDay(current.variant, current);
    return { ...current, ...next };
  });
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
  // No-op guard (same idea as switchVariant's above): submitting the
  // already-active week/day shouldn't wipe in-progress session state —
  // otherwise a mid-session visit to Overview that just re-submits the
  // current values silently wipes typed-but-unlogged inputs.
  if (current.week === week && current.day === day) {
    return current;
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

// ---------------------------------------------------------------------
// Storage durability
// ---------------------------------------------------------------------

/**
 * Asks the browser to exempt this origin's storage from best-effort
 * eviction. Everything the app accrues lives in the IndexedDB above with
 * no export/backup/sync path by design (PRD §10), so eviction under
 * storage pressure would be unrecoverable loss of the entire training
 * history — persist() is the only durability lever available. Safe to
 * call unconditionally: resolves false where the Storage API is missing
 * (older WebKit) or the request is denied, and never throws.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** Whether this origin's storage is currently durable — false when denied, unknown, or unsupported. */
export async function isStoragePersisted(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}
