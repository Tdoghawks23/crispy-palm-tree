import { describe, expect, it } from 'vitest';
import { generateSession } from '../generateSession';
import { advanceRotationState, INITIAL_ROTATION_STATE, resolveSlotExercise } from '../rotation';
import { getExercisesByPattern, MOVEMENT_PATTERNS } from '../../data/exercises';
import { getSession } from '../../data/program';

describe('rotation (R8)', () => {
  it('default/initial rotation state resolves every slot to its source original', () => {
    for (const variant of ['4-day', '3-day'] as const) {
      for (let week = 1; week <= 12; week++) {
        const days = variant === '4-day' ? ['Mon', 'Tue', 'Thu', 'Sat'] : ['Mon', 'Wed', 'Fri'];
        for (const day of days) {
          const programSession = getSession(variant, week, day)!;
          for (const slot of programSession.slots) {
            const resolved = resolveSlotExercise(slot, INITIAL_ROTATION_STATE);
            expect(resolved.id).toBe(slot.exerciseId);
          }
        }
      }
    }
  });

  it('never resolves a slot to an exercise outside its own movement pattern', () => {
    const programSession = getSession('4-day', 1, 'Sat')!;
    for (const slot of programSession.slots) {
      for (let offset = 0; offset < 5; offset++) {
        const resolved = resolveSlotExercise(slot, { [slot.pattern]: offset });
        expect(resolved.pattern).toBe(slot.pattern);
      }
    }
  });

  it('respects the pool cap: never more than 3 candidates per pattern', () => {
    for (const pattern of MOVEMENT_PATTERNS) {
      expect(getExercisesByPattern(pattern).length).toBeLessThanOrEqual(3);
    }
  });

  it('is deterministic: same slot + same rotation state always resolves the same exercise', () => {
    const programSession = getSession('4-day', 1, 'Sat')!;
    const slot = programSession.slots[0];
    const stateA = { [slot.pattern]: 1 };
    const first = resolveSlotExercise(slot, stateA);
    const second = resolveSlotExercise(slot, stateA);
    expect(first).toEqual(second);
  });

  it('advancing rotation state cycles through the pattern pool without repeating consecutively', () => {
    const programSession = getSession('4-day', 1, 'Sat')!;
    const slot = programSession.slots.find((s) => s.pattern === 'close-grip-pushup')!;
    let state = INITIAL_ROTATION_STATE;
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      const resolved = resolveSlotExercise(slot, state);
      seen.push(resolved.id);
      state = advanceRotationState(state, [slot.pattern]);
    }
    // 3 consecutive rotations through a pool of exactly 3 must hit each once.
    expect(new Set(seen).size).toBe(3);
  });

  it('generateSession is deterministic for the same (variant, week, day, rotationState)', () => {
    const state = { 'curl-ez': 1 } as const;
    const a = generateSession('4-day', 3, 'Tue', state);
    const b = generateSession('4-day', 3, 'Tue', state);
    expect(a).toEqual(b);
  });

  it('rotating a slot changes the resolved exercise but keeps sets/reps from the program', () => {
    const base = generateSession('4-day', 1, 'Tue', INITIAL_ROTATION_STATE);
    const rotated = generateSession('4-day', 1, 'Tue', { 'curl-ez': 1 });
    const baseCurl = base.mainExercises.find((e) => e.pattern === 'curl-ez')!;
    const rotatedCurl = rotated.mainExercises.find((e) => e.pattern === 'curl-ez')!;
    expect(rotatedCurl.exercise.id).not.toBe(baseCurl.exercise.id);
    expect(rotatedCurl.pattern).toBe(baseCurl.pattern);
    expect(rotatedCurl.sets).toBe(baseCurl.sets);
    expect(rotatedCurl.reps).toBe(baseCurl.reps);
  });
});
