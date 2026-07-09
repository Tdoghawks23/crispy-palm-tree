/**
 * Pure day/week advancement logic for program state — PRD R11/R17/§8.
 *
 * Split out from db.ts so it's unit-testable without IndexedDB: given a
 * variant and the current (week, day), compute the next training day,
 * wrapping to the next week (or back to week 1 — program restart, §8) when
 * the current day is the variant's last training day of the week.
 */
import { TRAINING_DAYS, TOTAL_WEEKS, type Variant } from '../data/program';

export interface DayPointer {
  week: number;
  day: string;
}

export function nextTrainingDay(variant: Variant, current: DayPointer): DayPointer {
  const days = TRAINING_DAYS[variant];
  const idx = days.indexOf(current.day);
  if (idx === -1) {
    throw new Error(`"${current.day}" is not a training day for the ${variant} variant`);
  }
  if (idx < days.length - 1) {
    return { week: current.week, day: days[idx + 1] };
  }
  // Last training day of the week: advance to next week's first day, or
  // loop back to week 1 (program restart) after week 12.
  const nextWeek = current.week >= TOTAL_WEEKS ? 1 : current.week + 1;
  return { week: nextWeek, day: days[0] };
}
