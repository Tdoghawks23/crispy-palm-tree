/**
 * Exercise rotation — PRD R8.
 *
 * Each program slot carries a fixed movement pattern and a "default"
 * exercise id (the exact source exercise the Excel program used for that
 * slot that week — e.g. Mon Push always defaults to close-grip push-up
 * "board narrow", Sat Arms B to "feet elevated/weighted", even though both
 * share the close-grip-pushup pattern). Rotation never crosses patterns: a
 * slot only ever resolves to another exercise tagged with the *same*
 * pattern, chosen from the catalog pool for that pattern.
 *
 * RotationState is a per-pattern integer offset. Offset 0 (the initial/
 * default state) always resolves to the slot's own original exercise —
 * this is what makes the golden tests (R9) match the Excel ground truth
 * exactly. Advancing the offset cycles deterministically through the
 * pattern's pool (capped at 3 members, R3), so consecutive sessions vary
 * without ever repeating the same exercise twice back-to-back (pool size
 * is always >= 2 wherever rotation is possible).
 */
import { getExercisesByPattern, type Exercise, type MovementPattern } from '../data/exercises';

/** Per-pattern rotation offset. Absent/undefined pattern keys behave as offset 0. */
export type RotationState = Partial<Record<MovementPattern, number>>;

/** Default state: every pattern at offset 0 (resolves to source originals). */
export const INITIAL_ROTATION_STATE: RotationState = {};

/**
 * Resolves which catalog exercise a program slot should use this session,
 * given the current rotation state. Pure function: same slot + same
 * rotationState always returns the same exercise.
 */
export function resolveSlotExercise(
  slot: { exerciseId: string; pattern: MovementPattern },
  rotationState: RotationState,
): Exercise {
  const pool = getExercisesByPattern(slot.pattern);
  if (pool.length === 0) {
    throw new Error(`No catalog exercises found for pattern "${slot.pattern}"`);
  }

  const defaultIndex = pool.findIndex((e) => e.id === slot.exerciseId);
  if (defaultIndex === -1) {
    throw new Error(
      `Slot's original exercise "${slot.exerciseId}" is not in the catalog pool for pattern "${slot.pattern}"`,
    );
  }

  const offset = rotationState[slot.pattern] ?? 0;
  const index = (((defaultIndex + offset) % pool.length) + pool.length) % pool.length;
  return pool[index];
}

/**
 * Advances rotation state for the given set of patterns (typically "every
 * pattern used in the session just completed"), cycling each pattern's
 * offset forward by one step through its pool. Pure — returns a new state,
 * does not mutate the input.
 */
export function advanceRotationState(
  rotationState: RotationState,
  patternsUsed: MovementPattern[],
): RotationState {
  const next: RotationState = { ...rotationState };
  for (const pattern of patternsUsed) {
    const poolSize = getExercisesByPattern(pattern).length;
    next[pattern] = ((next[pattern] ?? 0) + 1) % poolSize;
  }
  return next;
}
