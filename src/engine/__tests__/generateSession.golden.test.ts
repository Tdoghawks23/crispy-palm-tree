import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { generateSession } from '../generateSession';
import { INITIAL_ROTATION_STATE } from '../rotation';

const sourcePath = path.join(__dirname, '..', '..', '..', 'docs', 'source', 'program_full.json');
const source = JSON.parse(readFileSync(sourcePath, 'utf-8'));

function sourceRows(key: '4-day' | '3-day', week: number, day: string) {
  const sourceKey = key === '4-day' ? 'Daily Plan (4-Day)' : 'Daily Plan (3-Day)';
  return source[sourceKey].filter(
    (r: { week: number; day: string }) => r.week === week && r.day === day,
  );
}

/**
 * Golden tests (R9): generateSession, with the default/initial rotation
 * state, must exactly match the extracted Week 1 / Week 9 ground truth in
 * program_full.json for both variants. 4 cases minimum.
 */
describe('generateSession golden tests (R9)', () => {
  it.each([
    ['4-day', 1, 'Mon'],
    ['4-day', 9, 'Sat'],
    ['3-day', 1, 'Fri'],
    ['3-day', 9, 'Wed'],
  ] as const)('%s week %i %s matches source exactly', (variant, week, day) => {
    const rows = sourceRows(variant, week, day);
    const generatedSession = generateSession(variant, week, day, INITIAL_ROTATION_STATE);

    expect(generatedSession.mainExercises).toHaveLength(rows.length);
    generatedSession.mainExercises.forEach((slot, i) => {
      // With the default rotation state, every slot must resolve to the
      // literal source exercise for that row — not a rotated alternate.
      // (Catalog exercise names are authored display names, not always a
      // verbatim copy of the raw source string, so compare against the
      // program layer's own source-name field rather than reconstructing
      // the raw string from name + gripVariant.)
      expect(slot.sets).toBe(rows[i].sets);
      expect(slot.reps).toBe(rows[i].reps);
      expect(slot.notes).toBe(rows[i].notes);
      // Default rotation state must never resolve to a pool-expansion
      // alternate — only the source's own original exercise (R9).
      expect(slot.exercise.authored).toBe(false);
    });

    expect(generatedSession.warmup.length).toBe(4);
    expect(generatedSession.cooldown.length).toBeGreaterThan(0);
  });

  it('4-day week 1 Mon: exact session shape', () => {
    const s = generateSession('4-day', 1, 'Mon', INITIAL_ROTATION_STATE);
    expect(s.session).toBe('Push');
    expect(s.mesoId).toBe('M1');
    expect(s.mainExercises.map((e) => e.exercise.name)).toEqual([
      'Close-grip push-up (board narrow)',
      'Floor EZ-bar skull crusher',
      'Bench-dip between chairs',
    ]);
  });

  it('4-day week 9 Sat: deload sets and Medium grip resolved from source', () => {
    const s = generateSession('4-day', 9, 'Sat', INITIAL_ROTATION_STATE);
    expect(s.mesoId).toBe('deload');
    const curlSlot = s.mainExercises.find((e) => e.pattern === 'curl-ez')!;
    expect(curlSlot.gripVariant).toBe('Medium grip');
    expect(curlSlot.sets).toBe(2);
  });

  it('4-day week 5 Tue: M2 quarter-rep intensifier flag present on EZ curl', () => {
    const s = generateSession('4-day', 5, 'Tue', INITIAL_ROTATION_STATE);
    const curlSlot = s.mainExercises.find((e) => e.pattern === 'curl-ez')!;
    expect(curlSlot.intensifiers?.quarterRepsSets).toEqual([1, 2]);
  });

  it('4-day week 5 Mon: M2 rest-pause intensifier flag present on close-grip push-up', () => {
    const s = generateSession('4-day', 5, 'Mon', INITIAL_ROTATION_STATE);
    const cgpuSlot = s.mainExercises.find((e) => e.pattern === 'close-grip-pushup')!;
    expect(cgpuSlot.intensifiers?.restPauseLastSet).toBe(true);
  });

  it('4-day week 11 Mon: M3 rest-cut guidance present', () => {
    const s = generateSession('4-day', 11, 'Mon', INITIAL_ROTATION_STATE);
    for (const slot of s.mainExercises) {
      expect(slot.restCutGuidance).toBeTruthy();
    }
  });

  it('throws for an invalid day/variant combination instead of returning an empty session', () => {
    expect(() => generateSession('3-day', 1, 'Tue', INITIAL_ROTATION_STATE)).toThrow();
  });
});
