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

function dateKeyFor(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/** Groups logs (any order) into per-day sessions, sorted oldest day first. */
export function groupLogsByDay(logs: SetLogEntry[]): SessionSetGroup[] {
  const groups = new Map<string, LoggedSet[]>();
  for (const log of [...logs].sort((a, b) => a.timestamp - b.timestamp)) {
    const key = dateKeyFor(log.timestamp);
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
