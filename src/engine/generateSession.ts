/**
 * Session generation — PRD R7.
 *
 * Pure, deterministic: `generateSession(variant, week, day, rotationState)`
 * always returns the same `Session` for the same inputs. No `Date.now()`,
 * no unseeded `Math.random()`, no hidden mutable module state.
 */
import { WARMUP_STEPS, type WarmupStep } from '../data/warmup';
import { COOLDOWN_STEPS, type CooldownStep } from '../data/cooldown';
import { getSession, type Intensifiers, type MesocycleId, type Variant } from '../data/program';
import type { Exercise, MovementPattern } from '../data/exercises';
import { resolveSlotExercise, type RotationState, INITIAL_ROTATION_STATE } from './rotation';

export interface SessionSlot {
  slotIndex: number;
  pattern: MovementPattern;
  /** The catalog exercise resolved for this session (source original or rotated alternate). */
  exercise: Exercise;
  /**
   * Grip/stance variant for this week (R2) — only set when the resolved
   * exercise is the slot's own source original; rotated alternates don't
   * carry the source's grip-rotation schedule.
   */
  gripVariant?: string;
  sets: number;
  reps: string;
  /**
   * Form cue to display: the source's verbatim per-week note when the
   * slot resolved to its original exercise, otherwise the resolved
   * alternate's own catalog form cue.
   */
  notes: string;
  intensifiers?: Intensifiers;
  restCutGuidance?: string;
}

export interface Session {
  variant: Variant;
  week: number;
  day: string;
  session: string;
  mesoId: MesocycleId;
  mesoLabel: string;
  warmup: WarmupStep[];
  mainExercises: SessionSlot[];
  cooldown: CooldownStep[];
}

export function generateSession(
  variant: Variant,
  week: number,
  day: string,
  rotationState: RotationState = INITIAL_ROTATION_STATE,
): Session {
  const programSession = getSession(variant, week, day);
  if (!programSession) {
    throw new Error(`No program session found for ${variant} week ${week} day "${day}"`);
  }

  const mainExercises: SessionSlot[] = programSession.slots.map((slot) => {
    const resolved = resolveSlotExercise(slot, rotationState);
    const isOriginal = resolved.id === slot.exerciseId;
    return {
      slotIndex: slot.slotIndex,
      pattern: slot.pattern,
      exercise: resolved,
      gripVariant: isOriginal ? slot.gripVariant : undefined,
      sets: slot.sets,
      reps: slot.reps,
      notes: isOriginal ? slot.notes : resolved.formCues,
      intensifiers: slot.intensifiers,
      restCutGuidance: slot.restCutGuidance,
    };
  });

  return {
    variant,
    week,
    day,
    session: programSession.session,
    mesoId: programSession.mesoId,
    mesoLabel: programSession.mesoLabel,
    warmup: WARMUP_STEPS,
    mainExercises,
    cooldown: COOLDOWN_STEPS,
  };
}
