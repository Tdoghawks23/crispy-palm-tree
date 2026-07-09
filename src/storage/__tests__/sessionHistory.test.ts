import { describe, expect, it } from 'vitest';
import { groupLogsByDay, getMostRecentSessionSets } from '../sessionHistory';
import type { SetLogEntry } from '../db';

const DAY1 = new Date('2026-06-01T10:00:00Z').getTime();
const DAY1_LATER = new Date('2026-06-01T10:05:00Z').getTime();
const DAY2 = new Date('2026-06-08T10:00:00Z').getTime();

describe('groupLogsByDay / getMostRecentSessionSets (R10 grouping helper)', () => {
  it('groups logs from the same calendar day into one session', () => {
    const logs: SetLogEntry[] = [
      { exerciseId: 'ez-bar-curl', setIndex: 0, weight: 30, reps: 12, timestamp: DAY1 },
      { exerciseId: 'ez-bar-curl', setIndex: 1, weight: 30, reps: 11, timestamp: DAY1_LATER },
    ];
    const groups = groupLogsByDay(logs);
    expect(groups).toHaveLength(1);
    expect(groups[0].sets).toEqual([
      { weight: 30, reps: 12 },
      { weight: 30, reps: 11 },
    ]);
  });

  it('splits logs from different calendar days into separate sessions, oldest first', () => {
    const logs: SetLogEntry[] = [
      { exerciseId: 'ez-bar-curl', setIndex: 0, weight: 35, reps: 10, timestamp: DAY2 },
      { exerciseId: 'ez-bar-curl', setIndex: 0, weight: 30, reps: 12, timestamp: DAY1 },
    ];
    const groups = groupLogsByDay(logs);
    expect(groups.map((g) => g.dateKey)).toEqual(['2026-06-01', '2026-06-08']);
  });

  it('getMostRecentSessionSets returns only the latest day\'s sets', () => {
    const logs: SetLogEntry[] = [
      { exerciseId: 'ez-bar-curl', setIndex: 0, weight: 30, reps: 12, timestamp: DAY1 },
      { exerciseId: 'ez-bar-curl', setIndex: 0, weight: 35, reps: 15, timestamp: DAY2 },
      { exerciseId: 'ez-bar-curl', setIndex: 1, weight: 35, reps: 14, timestamp: DAY2 + 1000 },
    ];
    expect(getMostRecentSessionSets(logs)).toEqual([
      { weight: 35, reps: 15 },
      { weight: 35, reps: 14 },
    ]);
  });

  it('returns an empty array when there is no history', () => {
    expect(getMostRecentSessionSets([])).toEqual([]);
  });
});
