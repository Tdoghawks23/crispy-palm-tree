/**
 * Double-progression logic — PRD R10.
 *
 * Pure function: given the most recently logged sets for an exercise (all
 * sets from the last time it was performed) and the current slot's rep
 * range/RIR target, suggest either a weight increase, a +1 rep target at
 * the same weight, or (no history) plain rep-range/RIR guidance — never a
 * fabricated number.
 *
 * Assumption (flagged): "hit the top of the rep range" is judged purely on
 * logged reps, since R12's per-set log schema (exercise id, set index,
 * weight, reps, timestamp) does not capture an actual-RIR-achieved value —
 * RIR is a program-prescribed target the user works toward, not something
 * this build logs back. If every set in the most recent session met or
 * exceeded the rep-range top, that's treated as "hit target at prescribed
 * RIR."
 *
 * Assumption (flagged): weight increment is 2.5 lb for loads under 20 lb
 * (isolation/light dumbbell work, where a flat 5 lb jump is proportionally
 * large) and 5 lb otherwise (typical smallest realistic plate jump: two
 * 2.5 lb plates across a barbell/EZ-bar, one per side).
 *
 * Bodyweight exercises (close-grip push-up / dip variants, per the
 * catalog's `bodyweight` flag) don't get a weight-bump suggestion — a
 * fixed lb increment is meaningless when the load is mostly the trainee's
 * own bodyweight. At the top of the rep range these instead suggest the
 * harder variation named in the source notes (e.g. "elevate feet if 20
 * reps easy", "knees bent->straight to progress"), passed in by the caller
 * as `progressionCue` so this module doesn't need to know about the
 * exercise catalog. Below range-top, bodyweight sets still get the +1-rep
 * suggestion; optional added weight (if any was logged) is still
 * mentioned since some trainees load these with a plate/vest.
 */

export interface LoggedSet {
  weight: number;
  reps: number;
}

export type ProgressionSuggestion =
  | { kind: 'no-history'; message: string }
  | { kind: 'increase-weight'; message: string; suggestedWeight: number }
  | { kind: 'increase-reps'; message: string; suggestedReps: number; weight: number }
  | { kind: 'increase-difficulty'; message: string };

const SMALL_LOAD_THRESHOLD = 20;
const SMALL_LOAD_INCREMENT = 2.5;
const STANDARD_INCREMENT = 5;

function weightIncrementFor(weight: number): number {
  return weight < SMALL_LOAD_THRESHOLD ? SMALL_LOAD_INCREMENT : STANDARD_INCREMENT;
}

/**
 * Parses the top of a rep range out of a source `reps` string, e.g.
 * "8–15 reps @ RIR 1–2" -> 15, "10–20 reps @ RIR 1–2 (last set)" -> 20.
 * Returns undefined for non-rep-based prescriptions (e.g. timed holds),
 * since double progression by rep count doesn't apply to those.
 */
export function parseRepRangeMax(reps: string): number | undefined {
  const match = reps.match(/(\d+)\s*[–-]\s*(\d+)\s*reps?/i);
  if (!match) return undefined;
  return Number(match[2]);
}

/**
 * Parses the target RIR out of a source `reps` string, e.g.
 * "8–15 reps @ RIR 1–2" -> "1–2". Returns undefined if the slot doesn't
 * carry an RIR target (none observed in the source data, but don't assume).
 */
export function parseTargetRIR(reps: string): string | undefined {
  const match = reps.match(/RIR\s*([\d–-]+)/i);
  return match ? match[1] : undefined;
}

export function suggestProgression(params: {
  repRangeMax: number;
  targetRIR: string;
  mostRecentSets: LoggedSet[];
  /** True for close-grip push-up/dip-style bodyweight exercises (catalog `bodyweight` flag). */
  bodyweight?: boolean;
  /** Source-derived harder-variation cue (e.g. "elevate feet if 20 reps easy"), shown at range-top for bodyweight exercises instead of a weight bump. */
  progressionCue?: string;
}): ProgressionSuggestion {
  const { repRangeMax, targetRIR, mostRecentSets, bodyweight = false, progressionCue } = params;

  if (mostRecentSets.length === 0) {
    const guidance = bodyweight
      ? `No history yet — aim for the middle of the rep range at RIR ${targetRIR} with strict form.`
      : `No history yet — aim for the middle of the rep range at RIR ${targetRIR}, pick a weight you can control for all sets.`;
    return { kind: 'no-history', message: guidance };
  }

  const hitTopOfRange = mostRecentSets.every((set) => set.reps >= repRangeMax);
  const lastSet = mostRecentSets[mostRecentSets.length - 1];

  if (hitTopOfRange) {
    if (bodyweight) {
      const cue = progressionCue ? ` Try: ${progressionCue}` : '';
      return {
        kind: 'increase-difficulty',
        message: `Hit ${repRangeMax} reps at RIR ${targetRIR} last time — move to a harder variation.${cue}`,
      };
    }
    const increment = weightIncrementFor(lastSet.weight);
    const suggestedWeight = lastSet.weight + increment;
    return {
      kind: 'increase-weight',
      message: `Hit ${repRangeMax} reps at RIR ${targetRIR} last time — try ${suggestedWeight} lb next session.`,
      suggestedWeight,
    };
  }

  const suggestedReps = lastSet.reps + 1;
  // Mention weight only when it's meaningful: always for loaded exercises,
  // and for bodyweight exercises only if the trainee actually logged some
  // added weight (plate/vest) rather than the 0 default.
  const mentionWeight = !bodyweight || lastSet.weight > 0;
  return {
    kind: 'increase-reps',
    message: mentionWeight
      ? `Same weight (${lastSet.weight} lb), aim for ${suggestedReps} reps next session.`
      : `Aim for ${suggestedReps} reps next session.`,
    suggestedReps,
    weight: lastSet.weight,
  };
}
