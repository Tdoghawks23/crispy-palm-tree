/**
 * Groups an exercise's per-set logs (R12) into sessions, so the UI can hand
 * progression.ts "the most recent session's sets" per R10.
 *
 * Simplest workable grouping: one session = one calendar day (this is a
 * single-user app that trains at most once a day per the source program,
 * so "same day" and "same session" coincide in practice). Kept here
 * (storage layer) rather than in engine/ because it operates directly on
 * the stored `SetLogEntry` shape — the grouping itself is a pure data
 * transform with no IndexedDB access, just colocated with its input type.
 */
import type { LoggedSet } from '../engine/progression';
import type { SetLogEntry } from './db';

export interface SessionSetGroup {
  /** Calendar day key, e.g. "2026-07-09", derived from the logs' timestamps. */
  dateKey: string;
  sets: LoggedSet[];
}

/**
 * Calendar-day key in the *local* timezone (not UTC). This is a phone app
 * for a single user training in one place — bucketing by UTC day would
 * split a late-evening US workout across two "sessions" whenever it
 * crosses UTC midnight (QA should-fix 3). Exported so callers (e.g. the
 * Progress screen's "distinct training days logged" count) use the same
 * bucketing instead of re-deriving it with `toISOString()`.
 */
export function localDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Groups logs (any order) into per-day sessions, sorted oldest day first. */
export function groupLogsByDay(logs: SetLogEntry[]): SessionSetGroup[] {
  const groups = new Map<string, LoggedSet[]>();
  for (const log of [...logs].sort((a, b) => a.timestamp - b.timestamp)) {
    const key = localDateKey(log.timestamp);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push({ weight: log.weight, reps: log.reps });
    } else {
      groups.set(key, [{ weight: log.weight, reps: log.reps }]);
    }
  }
  return [...groups.entries()]
    .map(([dateKey, sets]) => ({ dateKey, sets }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/** The sets logged in the most recent session for an exercise (empty if no history). */
export function getMostRecentSessionSets(logs: SetLogEntry[]): LoggedSet[] {
  const groups = groupLogsByDay(logs);
  if (groups.length === 0) return [];
  return groups[groups.length - 1].sets;
}
