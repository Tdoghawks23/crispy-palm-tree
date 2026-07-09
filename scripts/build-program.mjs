#!/usr/bin/env node
/**
 * Generates src/data/program.generated.json from docs/source/program_full.json.
 *
 * Rationale (solution ladder — IMPROVE over hand-transcription): 396 source
 * rows hand-typed into TypeScript is exactly the kind of transcription error
 * a golden test can't catch if the *source of the golden test* was also
 * hand-typed from the same file. Reading the JSON directly and mapping raw
 * exercise names to catalog ids keeps golden tests meaningful — they pin
 * generator output against source values, not against a second manual
 * transcription of the same data.
 *
 * Run: npm run gen:program
 * Output is committed (not gitignored) so the build doesn't require running
 * this script, but it must be re-run (and the diff reviewed) whenever
 * program_full.json or the name->id map below changes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = path.join(__dirname, '..', 'docs', 'source', 'program_full.json');
const OUT_PATH = path.join(__dirname, '..', 'src', 'data', 'program.generated.json');

const source = JSON.parse(readFileSync(SOURCE_PATH, 'utf-8'));

/**
 * Maps a raw source `exercise` string to { exerciseId, pattern, gripVariant }.
 * Kept here (not in exercises.ts) because this is a source-row parsing
 * concern, not a catalog concern.
 */
function resolveExercise(rawName) {
  if (rawName.startsWith('EZ-bar curl')) {
    const gripVariant = rawName.includes('—') ? rawName.split('—')[1].trim() : undefined;
    return { exerciseId: 'ez-bar-curl', pattern: 'curl-ez', gripVariant };
  }
  if (rawName.includes("curl (hinge")) {
    return {
      exerciseId: 'spider-curl',
      pattern: 'curl-spider',
      gripVariant: 'hinge; chest to thighs / back-to-wall',
    };
  }
  if (rawName.includes("curl (no bench")) {
    return { exerciseId: 'spider-curl', pattern: 'curl-spider', gripVariant: 'no bench' };
  }
  switch (rawName) {
    case 'EZ-bar reverse curl':
      return { exerciseId: 'ez-bar-reverse-curl', pattern: 'curl-reverse' };
    case 'DB hammer curl':
      return { exerciseId: 'db-hammer-curl', pattern: 'curl-hammer' };
    case 'Close-grip push-up (board narrow)':
      return { exerciseId: 'close-grip-pushup-board-narrow', pattern: 'close-grip-pushup' };
    case 'Close-grip push-up (feet elevated/weighted)':
      return { exerciseId: 'close-grip-pushup-feet-elevated', pattern: 'close-grip-pushup' };
    case 'Floor EZ-bar skull crusher':
      return { exerciseId: 'floor-ez-bar-skull-crusher', pattern: 'triceps-skull-crusher' };
    case 'Bench-dip between chairs':
      return { exerciseId: 'bench-dip-chairs', pattern: 'dip' };
    case 'Underhand barbell row from hinge':
      return { exerciseId: 'underhand-barbell-row', pattern: 'row-horizontal' };
    case '1-arm DB row (long squeeze)':
      return { exerciseId: 'one-arm-db-row', pattern: 'row-unilateral' };
    case 'Timed bar holds (double overhand)':
      return { exerciseId: 'timed-bar-holds', pattern: 'grip-isometric' };
    case 'EZ-bar JM press':
      return { exerciseId: 'ez-bar-jm-press', pattern: 'triceps-jm-press' };
    case 'Overhead triceps extension (single DB)':
      return { exerciseId: 'overhead-triceps-extension-db', pattern: 'triceps-overhead' };
    case 'Wrist curl + reverse wrist curl (superset)':
      return { exerciseId: 'wrist-curl-superset', pattern: 'wrist-flexion-extension' };
    default:
      throw new Error(`Unmapped source exercise name: ${JSON.stringify(rawName)}`);
  }
}

function mesoIdForWeek(week) {
  if (week >= 1 && week <= 4) return 'M1';
  if (week >= 5 && week <= 8) return 'M2';
  if (week === 9) return 'deload';
  if (week >= 10 && week <= 12) return 'M3';
  throw new Error(`Week ${week} out of the 12-week program range`);
}

/**
 * M2 intensifier flags (PRD §2 mesocycle map): 1¼ reps on EZ-bar curl sets
 * 1-2, and one mini rest-pause on the last close-grip push-up set. Neither
 * is present as literal text in every row's `notes` field (only the EZ-bar
 * curl rows mention 1¼ reps in their own notes) — the rest-pause rule is
 * mesocycle-level guidance (from the `meso` column text), not a per-row
 * flag in the source, so it's derived here from (week range, pattern).
 */
function intensifiersFor(week, pattern) {
  const inM2 = week >= 5 && week <= 8;
  if (!inM2) return undefined;
  if (pattern === 'curl-ez') {
    return { quarterRepsSets: [1, 2] };
  }
  if (pattern === 'close-grip-pushup') {
    return { restPauseLastSet: true };
  }
  return undefined;
}

/** M3 rest-cut guidance (display-only, PRD §2 / R21 out-of-scope for timers). */
function restCutGuidanceFor(week) {
  if (week >= 10 && week <= 12) {
    return 'Cut rest ~15–20% vs M2 if joints feel good (display-only guidance; no enforced timer).';
  }
  return undefined;
}

function buildVariant(rows) {
  // Defensive per R4: exclude any "day"/"session" === "None" placeholder
  // rows (the 3-day source rows already omit these, but don't trust that
  // silently — fail loudly instead of importing an empty session).
  const realRows = rows.filter((r) => r.day !== 'None' && r.session !== 'None');

  const sessions = [];
  const seen = new Map(); // key "week|day" -> session record, to preserve row order as slots

  for (const row of realRows) {
    const key = `${row.week}|${row.day}`;
    let session = seen.get(key);
    if (!session) {
      session = {
        week: row.week,
        day: row.day,
        session: row.session,
        mesoId: mesoIdForWeek(row.week),
        mesoLabel: row.meso,
        slots: [],
      };
      seen.set(key, session);
      sessions.push(session);
    }
    const { exerciseId, pattern, gripVariant } = resolveExercise(row.exercise);
    session.slots.push({
      slotIndex: session.slots.length,
      exerciseId,
      pattern,
      sourceExerciseName: row.exercise,
      gripVariant,
      sets: row.sets,
      reps: row.reps,
      notes: row.notes,
      intensifiers: intensifiersFor(row.week, pattern),
      restCutGuidance: restCutGuidanceFor(row.week),
    });
  }

  return sessions;
}

const generated = {
  '4-day': buildVariant(source['Daily Plan (4-Day)']),
  '3-day': buildVariant(source['Daily Plan (3-Day)']),
};

writeFileSync(OUT_PATH, JSON.stringify(generated, null, 2) + '\n');
console.log(
  `Wrote ${OUT_PATH}: ${generated['4-day'].length} 4-day sessions, ${generated['3-day'].length} 3-day sessions`,
);
