import { describe, expect, it } from 'vitest';
import { computePatternTrends, seriesDelta } from '../trends';
import type { SetLogEntry } from '../db';

/** Log row at 10:00 local time on the given local calendar day. */
function log(
  exerciseId: string,
  day: string,
  weight: number,
  reps: number,
  setIndex = 0,
): SetLogEntry {
  return { exerciseId, setIndex, weight, reps, timestamp: new Date(`${day}T10:00:00`).getTime() };
}

describe('computePatternTrends', () => {
  it('aggregates rotating alternates of one pattern into a single series', () => {
    // Three different curl-ez alternates on three days — the rotation
    // scenario that left per-exercise charts with one point each.
    const trends = computePatternTrends([
      log('ez-bar-curl', '2026-08-04', 45, 10),
      log('band-standing-curl', '2026-08-11', 20, 12),
      log('barbell-curl', '2026-08-18', 50, 10),
    ]);
    expect(trends).toHaveLength(1);
    expect(trends[0].pattern).toBe('curl-ez');
    expect(trends[0].loadVolume).toEqual([
      { dateKey: '2026-08-04', value: 450 },
      { dateKey: '2026-08-11', value: 240 },
      { dateKey: '2026-08-18', value: 500 },
    ]);
    expect(trends[0].bwReps).toEqual([]);
    expect(trends[0].exercises).toHaveLength(3);
    // Per-exercise summaries are most-recent first.
    expect(trends[0].exercises.map((e) => e.exerciseId)).toEqual([
      'barbell-curl',
      'band-standing-curl',
      'ez-bar-curl',
    ]);
  });

  it('charts bodyweight-only patterns as reps per session, not zero load', () => {
    const trends = computePatternTrends([
      log('close-grip-pushup-board-narrow', '2026-08-03', 0, 10, 0),
      log('close-grip-pushup-board-narrow', '2026-08-03', 0, 10, 1),
      log('band-resisted-close-grip-pushup', '2026-08-08', 0, 12),
    ]);
    expect(trends).toHaveLength(1);
    expect(trends[0].pattern).toBe('close-grip-pushup');
    expect(trends[0].loadVolume).toEqual([]);
    expect(trends[0].bwReps).toEqual([
      { dateKey: '2026-08-03', value: 20 },
      { dateKey: '2026-08-08', value: 12 },
    ]);
  });

  it('gives mixed patterns separate day axes per series (no zero-dip days)', () => {
    // Dip pattern: bodyweight day, weighted day, bodyweight day.
    const trends = computePatternTrends([
      log('bench-dip-chairs', '2026-08-03', 0, 10),
      log('weighted-bench-dip', '2026-08-08', 25, 8),
      log('band-resisted-bench-dip', '2026-08-10', 0, 12),
    ]);
    expect(trends[0].loadVolume).toEqual([{ dateKey: '2026-08-08', value: 200 }]);
    expect(trends[0].bwReps).toEqual([
      { dateKey: '2026-08-03', value: 10 },
      { dateKey: '2026-08-10', value: 12 },
    ]);
  });

  it('counts a bodyweight set with added weight in both series', () => {
    const trends = computePatternTrends([log('band-resisted-close-grip-pushup', '2026-08-03', 10, 12)]);
    expect(trends[0].loadVolume).toEqual([{ dateKey: '2026-08-03', value: 120 }]);
    expect(trends[0].bwReps).toEqual([{ dateKey: '2026-08-03', value: 12 }]);
    expect(trends[0].exercises[0].lastTopWeight).toBe(10);
  });

  it('merges same-exercise sets on the same local day into one point', () => {
    const trends = computePatternTrends([
      log('ez-bar-curl', '2026-08-04', 45, 10, 0),
      log('ez-bar-curl', '2026-08-04', 45, 8, 1),
    ]);
    expect(trends[0].loadVolume).toEqual([{ dateKey: '2026-08-04', value: 810 }]);
    expect(trends[0].exercises[0].sessions).toBe(1);
    expect(trends[0].exercises[0].lastTotalReps).toBe(18);
  });

  it('skips log rows whose exercise id no longer resolves', () => {
    const trends = computePatternTrends([
      log('deleted-exercise', '2026-08-03', 100, 10),
      log('ez-bar-curl', '2026-08-04', 45, 10),
    ]);
    expect(trends).toHaveLength(1);
    expect(trends[0].pattern).toBe('curl-ez');
  });

  it('orders patterns by the canonical MOVEMENT_PATTERNS order regardless of log order', () => {
    const trends = computePatternTrends([
      log('timed-bar-holds', '2026-08-06', 20, 30),
      log('ez-bar-curl', '2026-08-04', 45, 10),
      log('db-hammer-curl', '2026-08-04', 30, 10),
    ]);
    expect(trends.map((t) => t.pattern)).toEqual(['curl-ez', 'curl-hammer', 'grip-isometric']);
  });

  it('summarizes each exercise: distinct days, last top weight (null for pure bodyweight), last total reps', () => {
    const trends = computePatternTrends([
      log('bench-dip-chairs', '2026-08-03', 0, 10, 0),
      log('bench-dip-chairs', '2026-08-03', 0, 9, 1),
      log('bench-dip-chairs', '2026-08-10', 0, 12, 0),
    ]);
    const summary = trends[0].exercises[0];
    expect(summary.sessions).toBe(2);
    expect(summary.lastDateKey).toBe('2026-08-10');
    expect(summary.lastTopWeight).toBeNull();
    expect(summary.lastTotalReps).toBe(12);
  });
});

describe('seriesDelta', () => {
  const pts = (...values: number[]) =>
    values.map((value, i) => ({ dateKey: `2026-08-0${i + 1}`, value }));

  it('needs at least two points', () => {
    expect(seriesDelta(pts())).toBeNull();
    expect(seriesDelta(pts(450))).toBeNull();
  });

  it('reports gains as up with rounded percent', () => {
    expect(seriesDelta(pts(400, 500))).toEqual({ direction: 'up', pct: 25 });
    expect(seriesDelta(pts(400, 400))).toEqual({ direction: 'up', pct: 0 });
  });

  it('reports declines as down with the magnitude, not a negative number', () => {
    expect(seriesDelta(pts(500, 400))).toEqual({ direction: 'down', pct: 20 });
  });

  it('returns null when the first value is zero (no meaningful base)', () => {
    expect(seriesDelta(pts(0, 400))).toBeNull();
  });
});
