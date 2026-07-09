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
 */

export interface LoggedSet {
  weight: number;
  reps: number;
}

export type ProgressionSuggestion =
  | { kind: 'no-history'; message: string }
  | { kind: 'increase-weight'; message: string; suggestedWeight: number }
  | { kind: 'increase-reps'; message: string; suggestedReps: number; weight: number };

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
}): ProgressionSuggestion {
  const { repRangeMax, targetRIR, mostRecentSets } = params;

  if (mostRecentSets.length === 0) {
    return {
      kind: 'no-history',
      message: `No history yet — aim for the middle of the rep range at RIR ${targetRIR}, pick a weight you can control for all sets.`,
    };
  }

  const hitTopOfRange = mostRecentSets.every((set) => set.reps >= repRangeMax);
  const lastSet = mostRecentSets[mostRecentSets.length - 1];

  if (hitTopOfRange) {
    const increment = weightIncrementFor(lastSet.weight);
    const suggestedWeight = lastSet.weight + increment;
    return {
      kind: 'increase-weight',
      message: `Hit ${repRangeMax} reps at RIR ${targetRIR} last time — try ${suggestedWeight} lb next session.`,
      suggestedWeight,
    };
  }

  const suggestedReps = lastSet.reps + 1;
  return {
    kind: 'increase-reps',
    message: `Same weight (${lastSet.weight} lb), aim for ${suggestedReps} reps next session.`,
    suggestedReps,
    weight: lastSet.weight,
  };
}
