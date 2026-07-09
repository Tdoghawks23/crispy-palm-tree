import { afterEach, describe, expect, it } from 'vitest';
import { groupLogsByDay, getMostRecentSessionSets, localDateKey } from '../sessionHistory';
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

  describe('local-date bucketing (QA should-fix 3 — was bucketing by UTC day)', () => {
    const originalTZ = process.env.TZ;

    afterEach(() => {
      process.env.TZ = originalTZ;
    });

    it('keeps a late-evening US-timezone workout in one session even though it crosses UTC midnight', () => {
      process.env.TZ = 'America/Los_Angeles';
      // 2026-06-01 22:30 and 23:15 PDT (UTC-7) -> 2026-06-02 05:30 / 06:15 UTC.
      // A UTC-day bucketing would incorrectly split these into two sessions.
      const setA = new Date('2026-06-02T05:30:00Z').getTime();
      const setB = new Date('2026-06-02T06:15:00Z').getTime();

      expect(localDateKey(setA)).toBe('2026-06-01');
      expect(localDateKey(setB)).toBe('2026-06-01');

      const logs: SetLogEntry[] = [
        { exerciseId: 'db-hammer-curl', setIndex: 0, weight: 20, reps: 12, timestamp: setA },
        { exerciseId: 'db-hammer-curl', setIndex: 1, weight: 20, reps: 11, timestamp: setB },
      ];
      const groups = groupLogsByDay(logs);
      expect(groups).toHaveLength(1);
      expect(groups[0].dateKey).toBe('2026-06-01');
      expect(groups[0].sets).toHaveLength(2);
    });

    it('still separates two distinct local calendar days', () => {
      process.env.TZ = 'America/Los_Angeles';
      const eveningDay1 = new Date('2026-06-02T05:00:00Z').getTime(); // 2026-06-01 22:00 PDT
      const morningDay2 = new Date('2026-06-02T16:00:00Z').getTime(); // 2026-06-02 09:00 PDT
      expect(localDateKey(eveningDay1)).toBe('2026-06-01');
      expect(localDateKey(morningDay2)).toBe('2026-06-02');
    });
  });
});
