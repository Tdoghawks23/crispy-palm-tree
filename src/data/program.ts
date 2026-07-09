/**
 * Program schema — PRD R4.
 *
 * Backed by `program.generated.json`, produced by `scripts/build-program.mjs`
 * from `docs/source/program_full.json` (run `npm run gen:program` to
 * regenerate after any source-data or mapping change). Golden tests in
 * `src/engine/__tests__/` pin specific rows against the source file
 * directly, so this generated data can't silently drift.
 */
import generated from './program.generated.json';
import type { MovementPattern } from './exercises';

export type Variant = '4-day' | '3-day';
export type MesocycleId = 'M1' | 'M2' | 'deload' | 'M3';

export interface Intensifiers {
  /** M2 only: add 1¼ reps on these set numbers (1-indexed). */
  quarterRepsSets?: number[];
  /** M2 only: one mini rest-pause on the last set. */
  restPauseLastSet?: boolean;
}

export interface ProgramSlot {
  slotIndex: number;
  exerciseId: string;
  pattern: MovementPattern;
  /** Verbatim exercise name as it appears in the source row. */
  sourceExerciseName: string;
  /** Grip/stance variant for this week, if the source rotates one (R2). */
  gripVariant?: string;
  sets: number;
  reps: string;
  /** Verbatim source `notes` for this exact week/day/exercise row. */
  notes: string;
  intensifiers?: Intensifiers;
  /** M3 only: display-only rest-cut guidance (no enforced timer, R21). */
  restCutGuidance?: string;
}

export interface ProgramSession {
  week: number;
  day: string;
  session: string;
  mesoId: MesocycleId;
  /** Verbatim source `meso` label for this week. */
  mesoLabel: string;
  slots: ProgramSlot[];
}

interface GeneratedProgram {
  '4-day': ProgramSession[];
  '3-day': ProgramSession[];
}

const PROGRAM = generated as unknown as GeneratedProgram;

/** Real training days, in weekly order, per variant (R4 — excludes "None" placeholders). */
export const TRAINING_DAYS: Record<Variant, string[]> = {
  '4-day': ['Mon', 'Tue', 'Thu', 'Sat'],
  '3-day': ['Mon', 'Wed', 'Fri'],
};

export function getSession(variant: Variant, week: number, day: string): ProgramSession | undefined {
  return PROGRAM[variant].find((s) => s.week === week && s.day === day);
}

export function getSessionsForWeek(variant: Variant, week: number): ProgramSession[] {
  return PROGRAM[variant].filter((s) => s.week === week);
}

export function getAllSessions(variant: Variant): ProgramSession[] {
  return PROGRAM[variant];
}

export const TOTAL_WEEKS = 12;
