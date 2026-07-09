import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  _resetForTests,
  addSetLog,
  clearSessionProgress,
  completeSession,
  DEFAULT_PROGRAM_STATE,
  getAllSetLogs,
  getProgramState,
  getSessionProgress,
  getSetLogsForExercise,
  repeatDay,
  saveProgramState,
  saveSessionProgress,
  setWeekDay,
  skipDay,
  switchVariant,
} from '../db';

beforeEach(async () => {
  await _resetForTests();
});

afterEach(async () => {
  await _resetForTests();
});

describe('program state (R11, R14)', () => {
  it('first run (empty IndexedDB) initializes to 4-day/week 1/Mon', async () => {
    const state = await getProgramState();
    expect(state).toEqual(DEFAULT_PROGRAM_STATE);
  });

  it('persists the initialized default across subsequent reads', async () => {
    await getProgramState();
    const second = await getProgramState();
    expect(second).toEqual(DEFAULT_PROGRAM_STATE);
  });

  it('completeSession advances to the next training day and rotation state', async () => {
    const before = await getProgramState();
    expect(before.day).toBe('Mon');
    const after = await completeSession();
    expect(after.day).toBe('Tue');
    expect(after.week).toBe(1);
    // Patterns used on Mon/week1/4-day should have advanced by one offset.
    expect(Object.keys(after.rotationState).length).toBeGreaterThan(0);
  });

  it('completeSession loops week 12 -> week 1 (program restart, §8)', async () => {
    await saveProgramState({ variant: '4-day', week: 12, day: 'Sat', rotationState: {} });
    const after = await completeSession();
    expect(after.week).toBe(1);
    expect(after.day).toBe('Mon');
  });

  it('skipDay advances the day without touching rotation state', async () => {
    const before = await getProgramState();
    const after = await skipDay();
    expect(after.day).toBe('Tue');
    expect(after.rotationState).toEqual(before.rotationState);
  });

  it('repeatDay keeps week/day/rotation unchanged and clears session progress', async () => {
    await saveSessionProgress({
      variant: '4-day',
      week: 1,
      day: 'Mon',
      checkedSteps: ['warmup-0'],
      setInputs: {},
      updatedAt: 1,
    });
    const before = await getProgramState();
    const after = await repeatDay();
    expect(after).toEqual(before);
    expect(await getSessionProgress()).toBeUndefined();
  });

  it('switchVariant preserves the week, resets to the new variant\'s first training day, carries rotation state', async () => {
    await completeSession(); // advance to week1 Tue, non-empty rotation state
    const beforeSwitch = await getProgramState();
    const after = await switchVariant('3-day');
    expect(after.variant).toBe('3-day');
    expect(after.week).toBe(beforeSwitch.week);
    expect(after.day).toBe('Mon');
    expect(after.rotationState).toEqual(beforeSwitch.rotationState);
  });

  it('switchVariant is a no-op when already on that variant', async () => {
    const before = await getProgramState();
    const after = await switchVariant('4-day');
    expect(after).toEqual(before);
  });

  it('setWeekDay jumps directly to a week/day without touching rotation state (R19 manual override)', async () => {
    const before = await getProgramState();
    const after = await setWeekDay(6, 'Thu');
    expect(after.week).toBe(6);
    expect(after.day).toBe('Thu');
    expect(after.rotationState).toEqual(before.rotationState);
  });

  it('setWeekDay rejects a day that is not a training day for the active variant', async () => {
    await expect(setWeekDay(6, 'Wed')).rejects.toThrow();
  });
});

describe('per-set logs (R12) — append-only', () => {
  it('records a set log and retrieves it by exercise id', async () => {
    await addSetLog({ exerciseId: 'ez-bar-curl', setIndex: 0, weight: 30, reps: 12, timestamp: 100 });
    const logs = await getSetLogsForExercise('ez-bar-curl');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ exerciseId: 'ez-bar-curl', weight: 30, reps: 12 });
  });

  it('never overwrites previous logs — each completed set is a new entry', async () => {
    await addSetLog({ exerciseId: 'ez-bar-curl', setIndex: 0, weight: 30, reps: 12, timestamp: 100 });
    await addSetLog({ exerciseId: 'ez-bar-curl', setIndex: 1, weight: 30, reps: 11, timestamp: 200 });
    const logs = await getSetLogsForExercise('ez-bar-curl');
    expect(logs).toHaveLength(2);
    expect(logs.map((l) => l.setIndex)).toEqual([0, 1]);
  });

  it('getAllSetLogs returns logs across exercises ordered by timestamp', async () => {
    await addSetLog({ exerciseId: 'a', setIndex: 0, weight: 10, reps: 10, timestamp: 200 });
    await addSetLog({ exerciseId: 'b', setIndex: 0, weight: 20, reps: 8, timestamp: 100 });
    const logs = await getAllSetLogs();
    expect(logs.map((l) => l.exerciseId)).toEqual(['b', 'a']);
  });
});

describe('in-progress session state (R13)', () => {
  it('persists incrementally and can be read back', async () => {
    await saveSessionProgress({
      variant: '4-day',
      week: 1,
      day: 'Mon',
      checkedSteps: ['warmup-0'],
      setInputs: {},
      updatedAt: 1,
    });
    await saveSessionProgress({
      variant: '4-day',
      week: 1,
      day: 'Mon',
      checkedSteps: ['warmup-0', 'main-0-set-0'],
      setInputs: {},
      updatedAt: 2,
    });
    const progress = await getSessionProgress();
    expect(progress?.checkedSteps).toEqual(['warmup-0', 'main-0-set-0']);
  });

  it('clearSessionProgress removes the in-progress state', async () => {
    await saveSessionProgress({
      variant: '4-day',
      week: 1,
      day: 'Mon',
      checkedSteps: ['warmup-0'],
      setInputs: {},
      updatedAt: 1,
    });
    await clearSessionProgress();
    expect(await getSessionProgress()).toBeUndefined();
  });
});
