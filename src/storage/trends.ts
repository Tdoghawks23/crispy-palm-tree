/**
 * Pattern-level trend aggregation for the Progress screen (R18).
 *
 * Rotation deliberately swaps which alternate fills a movement-pattern
 * slot each session, so a per-exercise series only gains a point every
 * 2–3 weeks — useless as a trend. Aggregating by the exercises' `pattern`
 * tag (the app's one movement taxonomy, CLAUDE.md) gives a point every
 * time the pattern is trained, i.e. weekly.
 *
 * Two series per pattern, each with its own day axis:
 *  - loadVolume: Σ weight×reps per day over sets with weight > 0. Days
 *    where the pattern was trained purely at bodyweight are excluded
 *    rather than charted as misleading zero dips.
 *  - bwReps: Σ reps per day over sets of bodyweight-flagged exercises —
 *    the metric that actually moves for push-up/dip work (their logs
 *    carry weight 0 unless load was added). Days without bodyweight sets
 *    are likewise excluded.
 *
 * Pure data transform over stored SetLogEntry rows — kept in storage/
 * next to sessionHistory.ts for the same reason it is (operates on the
 * stored log shape, no IndexedDB access of its own).
 */
import {
  EXERCISES,
  MOVEMENT_PATTERNS,
  type Exercise,
  type MovementPattern,
} from '../data/exercises';
import type { SetLogEntry } from './db';
import { localDateKey } from './sessionHistory';

export interface SeriesPoint {
  dateKey: string;
  value: number;
}

export interface ExerciseTrendSummary {
  exerciseId: string;
  name: string;
  bodyweight: boolean;
  /** Distinct local days this exercise was logged. */
  sessions: number;
  lastDateKey: string;
  /** Heaviest weight in the most recent session; null when it was pure bodyweight. */
  lastTopWeight: number | null;
  /** Total reps in the most recent session. */
  lastTotalReps: number;
}

export interface PatternTrend {
  pattern: MovementPattern;
  /** Σ weight×reps per day over weighted sets; empty when the pattern has only ever been bodyweight. */
  loadVolume: SeriesPoint[];
  /** Σ reps per day over bodyweight-exercise sets; empty for purely weighted patterns. */
  bwReps: SeriesPoint[];
  exercises: ExerciseTrendSummary[];
}

const byId = new Map<string, Exercise>(EXERCISES.map((e) => [e.id, e]));

function sortedPoints(days: Map<string, number>): SeriesPoint[] {
  return [...days.entries()]
    .map(([dateKey, value]) => ({ dateKey, value }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/** Aggregates all logs into per-pattern trends, ordered like MOVEMENT_PATTERNS; patterns with no logs are omitted. */
export function computePatternTrends(logs: SetLogEntry[]): PatternTrend[] {
  const loadByPattern = new Map<MovementPattern, Map<string, number>>();
  const repsByPattern = new Map<MovementPattern, Map<string, number>>();
  const logsByExercise = new Map<string, SetLogEntry[]>();

  for (const log of logs) {
    const exercise = byId.get(log.exerciseId);
    // A log row whose exercise id no longer resolves (catalog drift) can't
    // be attributed to a pattern; skip rather than mis-bucket it.
    if (!exercise) continue;
    const day = localDateKey(log.timestamp);

    if (log.weight > 0) {
      let days = loadByPattern.get(exercise.pattern);
      if (!days) loadByPattern.set(exercise.pattern, (days = new Map()));
      days.set(day, (days.get(day) ?? 0) + log.weight * log.reps);
    }
    if (exercise.bodyweight) {
      let days = repsByPattern.get(exercise.pattern);
      if (!days) repsByPattern.set(exercise.pattern, (days = new Map()));
      days.set(day, (days.get(day) ?? 0) + log.reps);
    }

    const bucket = logsByExercise.get(log.exerciseId);
    if (bucket) bucket.push(log);
    else logsByExercise.set(log.exerciseId, [log]);
  }

  const summariesByPattern = new Map<MovementPattern, ExerciseTrendSummary[]>();
  for (const [exerciseId, exerciseLogs] of logsByExercise) {
    const exercise = byId.get(exerciseId)!;
    const byDay = new Map<string, SetLogEntry[]>();
    for (const log of exerciseLogs) {
      const day = localDateKey(log.timestamp);
      const bucket = byDay.get(day);
      if (bucket) bucket.push(log);
      else byDay.set(day, [log]);
    }
    const days = [...byDay.keys()].sort();
    const lastDateKey = days[days.length - 1];
    const lastSets = byDay.get(lastDateKey)!;
    const lastTopWeight = Math.max(...lastSets.map((s) => s.weight));
    const summary: ExerciseTrendSummary = {
      exerciseId,
      name: exercise.name,
      bodyweight: exercise.bodyweight === true,
      sessions: days.length,
      lastDateKey,
      lastTopWeight: lastTopWeight > 0 ? lastTopWeight : null,
      lastTotalReps: lastSets.reduce((sum, s) => sum + s.reps, 0),
    };
    const bucket = summariesByPattern.get(exercise.pattern);
    if (bucket) bucket.push(summary);
    else summariesByPattern.set(exercise.pattern, [summary]);
  }

  return MOVEMENT_PATTERNS.filter(
    (p) => loadByPattern.has(p) || repsByPattern.has(p),
  ).map((pattern) => ({
    pattern,
    loadVolume: sortedPoints(loadByPattern.get(pattern) ?? new Map()),
    bwReps: sortedPoints(repsByPattern.get(pattern) ?? new Map()),
    exercises: (summariesByPattern.get(pattern) ?? []).sort((a, b) =>
      b.lastDateKey.localeCompare(a.lastDateKey),
    ),
  }));
}

export interface TrendDelta {
  direction: 'up' | 'down';
  pct: number;
}

/**
 * First-vs-latest change for a series, or null when there's nothing to
 * compare (fewer than 2 points, or a zero first value). Unlike the old
 * gains-only pill this also reports declines — the UI styles them as
 * neutral, since dips are normal (and by design in the week-9 deload).
 */
export function seriesDelta(points: SeriesPoint[]): TrendDelta | null {
  if (points.length < 2) return null;
  const first = points[0].value;
  const last = points[points.length - 1].value;
  if (first === 0) return null;
  const pct = Math.round(((last - first) / first) * 100);
  return { direction: pct >= 0 ? 'up' : 'down', pct: Math.abs(pct) };
}
