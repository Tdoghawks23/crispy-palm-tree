import { describe, expect, it } from 'vitest';
import { EXERCISES, MOVEMENT_PATTERNS, getExercisesByPattern } from '../exercises';

const ALLOWED_EQUIPMENT = new Set([
  'ez-bar',
  'plates',
  'dumbbells',
  'barbell',
  'bands',
  'chairs',
  'pushup-board',
]);

describe('exercise catalog (R2/R3)', () => {
  it('has a pool of at most 3 exercises (originals + authored) per movement pattern', () => {
    for (const pattern of MOVEMENT_PATTERNS) {
      const pool = getExercisesByPattern(pattern);
      expect(pool.length, pattern).toBeGreaterThan(0);
      expect(pool.length, pattern).toBeLessThanOrEqual(3);
    }
  });

  it('has at least one non-authored (source) exercise per movement pattern', () => {
    for (const pattern of MOVEMENT_PATTERNS) {
      const pool = getExercisesByPattern(pattern);
      expect(pool.some((e) => !e.authored), pattern).toBe(true);
    }
  });

  it('only uses the R3-approved equipment pool', () => {
    for (const exercise of EXERCISES) {
      for (const eq of exercise.equipment) {
        expect(ALLOWED_EQUIPMENT.has(eq), `${exercise.id} equipment ${eq}`).toBe(true);
      }
    }
  });

  it('has unique ids', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
