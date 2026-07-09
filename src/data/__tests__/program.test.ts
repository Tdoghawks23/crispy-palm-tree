import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getSession, TRAINING_DAYS } from '../program';

const sourcePath = path.join(__dirname, '..', '..', '..', 'docs', 'source', 'program_full.json');
const source = JSON.parse(readFileSync(sourcePath, 'utf-8'));

function sourceRows(key: '4-day' | '3-day', week: number, day: string) {
  const sourceKey = key === '4-day' ? 'Daily Plan (4-Day)' : 'Daily Plan (3-Day)';
  return source[sourceKey].filter(
    (r: { week: number; day: string }) => r.week === week && r.day === day,
  );
}

describe('program.generated.json (R4 — traces to program_full.json)', () => {
  it('never imports a "None" placeholder day/session', () => {
    for (const variant of ['4-day', '3-day'] as const) {
      for (let week = 1; week <= 12; week++) {
        for (const day of TRAINING_DAYS[variant]) {
          const session = getSession(variant, week, day);
          expect(session, `${variant} week ${week} ${day}`).toBeDefined();
          expect(session!.day).not.toBe('None');
          expect(session!.session).not.toBe('None');
        }
      }
    }
  });

  it('only uses the real training days per variant', () => {
    expect(TRAINING_DAYS['4-day']).toEqual(['Mon', 'Tue', 'Thu', 'Sat']);
    expect(TRAINING_DAYS['3-day']).toEqual(['Mon', 'Wed', 'Fri']);
  });

  it.each([
    ['4-day', 1, 'Mon'],
    ['4-day', 9, 'Sat'],
    ['3-day', 1, 'Fri'],
    ['3-day', 9, 'Wed'],
  ] as const)('%s week %i %s: sets/reps/notes match source rows verbatim', (variant, week, day) => {
    const rows = sourceRows(variant, week, day);
    const session = getSession(variant, week, day)!;
    expect(session.slots).toHaveLength(rows.length);
    session.slots.forEach((slot, i) => {
      expect(slot.sourceExerciseName).toBe(rows[i].exercise);
      expect(slot.sets).toBe(rows[i].sets);
      expect(slot.reps).toBe(rows[i].reps);
      expect(slot.notes).toBe(rows[i].notes);
    });
  });

  it('every row across both variants and all 12 weeks maps to a resolvable exercise/pattern', () => {
    for (const variant of ['4-day', '3-day'] as const) {
      for (let week = 1; week <= 12; week++) {
        for (const day of TRAINING_DAYS[variant]) {
          const session = getSession(variant, week, day)!;
          for (const slot of session.slots) {
            expect(slot.exerciseId).toBeTruthy();
            expect(slot.pattern).toBeTruthy();
          }
        }
      }
    }
  });

  it('flags M2 quarter-rep intensifier only on EZ-bar curl slots in weeks 5-8', () => {
    for (const variant of ['4-day', '3-day'] as const) {
      for (let week = 1; week <= 12; week++) {
        for (const day of TRAINING_DAYS[variant]) {
          const session = getSession(variant, week, day)!;
          for (const slot of session.slots) {
            if (slot.pattern === 'curl-ez' && week >= 5 && week <= 8) {
              expect(slot.intensifiers?.quarterRepsSets).toEqual([1, 2]);
            } else if (slot.pattern === 'curl-ez') {
              expect(slot.intensifiers?.quarterRepsSets).toBeUndefined();
            }
          }
        }
      }
    }
  });

  it('flags M2 rest-pause only on close-grip push-up slots in weeks 5-8', () => {
    for (const variant of ['4-day', '3-day'] as const) {
      for (let week = 1; week <= 12; week++) {
        for (const day of TRAINING_DAYS[variant]) {
          const session = getSession(variant, week, day)!;
          for (const slot of session.slots) {
            if (slot.pattern === 'close-grip-pushup' && week >= 5 && week <= 8) {
              expect(slot.intensifiers?.restPauseLastSet).toBe(true);
            } else if (slot.pattern === 'close-grip-pushup') {
              expect(slot.intensifiers?.restPauseLastSet).toBeUndefined();
            }
          }
        }
      }
    }
  });

  it('week 9 (deload) uses the literal source sets field, never a computed percentage', () => {
    for (const variant of ['4-day', '3-day'] as const) {
      for (const day of TRAINING_DAYS[variant]) {
        const session = getSession(variant, 9, day)!;
        expect(session.mesoId).toBe('deload');
        const rows = sourceRows(variant, 9, day);
        session.slots.forEach((slot, i) => {
          expect(slot.sets).toBe(rows[i].sets);
        });
      }
    }
  });

  it('gives M3 weeks (10-12) rest-cut guidance and M1/M2/deload none', () => {
    for (const variant of ['4-day', '3-day'] as const) {
      for (let week = 1; week <= 12; week++) {
        for (const day of TRAINING_DAYS[variant]) {
          const session = getSession(variant, week, day)!;
          for (const slot of session.slots) {
            if (week >= 10 && week <= 12) {
              expect(slot.restCutGuidance).toBeTruthy();
            } else {
              expect(slot.restCutGuidance).toBeUndefined();
            }
          }
        }
      }
    }
  });
});
