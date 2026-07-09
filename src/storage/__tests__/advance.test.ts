import { describe, expect, it } from 'vitest';
import { nextTrainingDay } from '../advance';

describe('nextTrainingDay (R11/R17)', () => {
  it('advances to the next training day within the same week (4-day)', () => {
    expect(nextTrainingDay('4-day', { week: 3, day: 'Mon' })).toEqual({ week: 3, day: 'Tue' });
    expect(nextTrainingDay('4-day', { week: 3, day: 'Tue' })).toEqual({ week: 3, day: 'Thu' });
    expect(nextTrainingDay('4-day', { week: 3, day: 'Thu' })).toEqual({ week: 3, day: 'Sat' });
  });

  it('advances to the next week after the last training day (4-day)', () => {
    expect(nextTrainingDay('4-day', { week: 3, day: 'Sat' })).toEqual({ week: 4, day: 'Mon' });
  });

  it('advances to the next training day within the same week (3-day)', () => {
    expect(nextTrainingDay('3-day', { week: 5, day: 'Mon' })).toEqual({ week: 5, day: 'Wed' });
    expect(nextTrainingDay('3-day', { week: 5, day: 'Wed' })).toEqual({ week: 5, day: 'Fri' });
  });

  it('advances to the next week after the last training day (3-day)', () => {
    expect(nextTrainingDay('3-day', { week: 5, day: 'Fri' })).toEqual({ week: 6, day: 'Mon' });
  });

  it('loops back to week 1 after week 12 (program restart, §8)', () => {
    expect(nextTrainingDay('4-day', { week: 12, day: 'Sat' })).toEqual({ week: 1, day: 'Mon' });
    expect(nextTrainingDay('3-day', { week: 12, day: 'Fri' })).toEqual({ week: 1, day: 'Mon' });
  });

  it('throws for a day that is not a training day of the variant', () => {
    expect(() => nextTrainingDay('3-day', { week: 1, day: 'Tue' })).toThrow();
  });
});
