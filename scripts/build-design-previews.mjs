#!/usr/bin/env node
/**
 * Generates the design/ preview-card library for Claude Design (claude.ai/design).
 *
 * Each output file is a self-contained HTML "card" whose FIRST line is a
 * `<!-- @dsCard group="…" -->` marker (that marker is what the Design System
 * pane indexes). The app's real design tokens (src/index.css) and component
 * CSS (src/ui/app.css) are inlined verbatim, so the seeded cards render exactly
 * like the live app — the accurate starting point to iterate on in Claude
 * Design, screen by screen.
 *
 * Re-run after the app's CSS changes to refresh the seed:  node scripts/build-design-previews.mjs
 * Then push to your Claude Design project with the /design-sync slash command.
 *
 * This script is tooling; it is NOT shipped in the app bundle and NOT part of
 * the smoke path. The generated cards live under design/.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'design');

const tokensCss = readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
const appCss = readFileSync(path.join(ROOT, 'src/ui/app.css'), 'utf8');

// Preview-only overrides: turn the fixed full-height app shell into a static
// 390px phone column that renders nicely as an isolated card.
const frameCss = `
/* ---- preview frame (not part of the app) ---- */
body { margin: 0; padding: 20px; background: #0e0e11;
  display: flex; justify-content: center; align-items: flex-start; }
.app-root { width: 390px; min-height: auto;
  border-radius: 28px; overflow: hidden; box-shadow: 0 0 0 1px var(--border), 0 24px 60px rgba(0,0,0,0.5); }
.app-root main { padding: var(--space-4); }
.app-root .tab-bar { position: static; }
.token-page { width: 390px; color: var(--text); }
`;

function page({ group, title, body, extraCss = '' }) {
  return `<!-- @dsCard group="${group}" -->
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=390, initial-scale=1" />
<title>${title}</title>
<style>
${tokensCss}
${appCss}
${frameCss}
${extraCss}
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

/* ------------------------------- helpers ------------------------------- */

const checklistItem = (component, dosage, what, checked = false) => `
        <li>
          <label>
            <input type="checkbox"${checked ? ' checked' : ''} />
            <div class="step-text">
              <span class="step-component">${component}</span>
              <span class="step-dosage">(${dosage})</span>
              <p class="step-what">${what}</p>
            </div>
          </label>
        </li>`;

const currentSet = (n, weightLabel, weightPlaceholder) => `
            <li class="set-row set-row--current">
              <div class="set-row-top">
                <span class="set-number">Set ${n}</span>
                <span class="set-current-badge">Up now</span>
              </div>
              <div class="set-fields">
                <label class="set-field">
                  <span class="set-field-label">${weightLabel}</span>
                  <input type="number" placeholder="${weightPlaceholder}" />
                </label>
                <label class="set-field">
                  <span class="set-field-label">Reps</span>
                  <input type="number" placeholder="reps" />
                </label>
                <label class="set-check">
                  <input type="checkbox" />
                  <span class="set-check-label">Done</span>
                </label>
              </div>
            </li>`;

const queuedSet = (n, weightLabel, weightPlaceholder) => `
            <li class="set-row">
              <div class="set-row-top"><span class="set-number">Set ${n}</span></div>
              <div class="set-fields">
                <label class="set-field">
                  <span class="set-field-label">${weightLabel}</span>
                  <input type="number" placeholder="${weightPlaceholder}" />
                </label>
                <label class="set-field">
                  <span class="set-field-label">Reps</span>
                  <input type="number" placeholder="reps" />
                </label>
                <label class="set-check">
                  <input type="checkbox" />
                  <span class="set-check-label">Done</span>
                </label>
              </div>
            </li>`;

/* ------------------------------- screens ------------------------------- */

const sessionBody = `
<div class="app-root">
  <main>
    <div class="screen session-screen">
      <header>
        <h1>Push — Week 1, Mon</h1>
        <p class="meso-label">M1: Base/Skill — 3–4s eccentrics; focus technique.</p>
      </header>

      <section aria-labelledby="warmup-heading">
        <h2 id="warmup-heading">Warm-up</h2>
        <ul class="checklist">${checklistItem(
          'General warm-up',
          '2–3 min',
          'Brisk arm swings, shoulder circles; 5–10 easy push-ups (RIR 4–5).',
        )}${checklistItem(
          'Elbow-health circuit',
          '2–3 min',
          'Prone Y-T-W or wall slides 1×10; overhead reach/lat stretch 30–45s/side; light reverse curls 1×20.',
        )}${checklistItem(
          'Ramp sets',
          '2–3 sets',
          'First arm move: 2–3 lighter ramp sets to ~RIR 4–3 before working sets; grease the groove.',
        )}
        </ul>
      </section>

      <section aria-labelledby="main-heading">
        <h2 id="main-heading">Main exercises</h2>

        <article class="exercise-card">
          <h3>Close-grip push-up — board narrow</h3>
          <p class="prescription">3 sets × 10-20 reps @ RIR 1-2 (last set)</p>
          <p class="form-cue">Elbows tucked ~45°; full range, chest to board; brace hard.</p>
          <p class="progression-hint">No history yet — aim for the middle of the rep range at RIR 1-2 with strict form.</p>
          <ol class="set-list">${currentSet(1, 'Added weight (lb, optional)', 'optional')}${queuedSet(
            2,
            'Added weight (lb, optional)',
            'optional',
          )}${queuedSet(3, 'Added weight (lb, optional)', 'optional')}
          </ol>
        </article>

        <article class="exercise-card">
          <h3>Floor EZ-bar skull crusher</h3>
          <p class="prescription">3 sets × 8-15 reps @ RIR 1-2</p>
          <p class="form-cue">Tempo 3-0-1; lower behind head; wrists neutral.</p>
          <p class="progression-hint">No history yet — aim for the middle of the rep range at RIR 1-2, pick a weight you can control for all sets.</p>
          <ol class="set-list">${currentSet(1, 'Weight (lb)', 'lb')}${queuedSet(
            2,
            'Weight (lb)',
            'lb',
          )}${queuedSet(3, 'Weight (lb)', 'lb')}
          </ol>
        </article>
      </section>

      <section aria-labelledby="cooldown-heading">
        <h2 id="cooldown-heading">Cool-down</h2>
        <ul class="checklist">${checklistItem(
          'Down-regulation breathing',
          '1–2 min',
          'Sit or stand tall; slow nasal breathing, 4s in / 6s out; let heart rate settle before stretching.',
        )}${checklistItem(
          'Biceps/forearm stretch',
          '30–45s/side',
          'Arm extended, palm up, gently pull fingers back with the other hand until a light stretch is felt; no bounce.',
        )}${checklistItem(
          'Triceps/lat stretch',
          '30–45s/side',
          'Overhead triceps stretch: raise one arm, bend elbow behind head, gently pull elbow with the other hand; keep ribs down.',
        )}
        </ul>
      </section>

      <button type="button" class="complete-session">Complete session</button>
    </div>
  </main>
  <nav class="tab-bar" aria-label="Main navigation">
    <button type="button" class="active">Session</button>
    <button type="button">Progress</button>
    <button type="button">Overview</button>
  </nav>
</div>`;

// Illustrative sparkline (the app renders these from SparklineChart; sample
// data here so the populated Progress state is visible to design in.)
const sparkline = (points, area) => `
              <svg class="sparkline" viewBox="0 0 300 64" width="100%" height="64" preserveAspectRatio="none" aria-hidden="true">
                <path d="${area}" fill="currentColor" opacity="0.14" />
                <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>`;

const progressBody = `
<div class="app-root">
  <main>
    <div class="screen progress-screen">
      <header>
        <h1>Progress</h1>
      </header>

      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading">Program completion</h2>
        <p>Week 5 of 12 (4 weeks completed)</p>
        <progress class="completion-bar" value="4" max="12" aria-label="4 of 12 weeks completed"></progress>
        <p>11 training days logged (all time) — a full 4-day cycle is 48 days</p>
      </section>

      <section aria-labelledby="exercises-heading">
        <h2 id="exercises-heading">Per-exercise trends</h2>

        <article class="exercise-trend">
          <h3>Close-grip push-up</h3>
          <p class="trend-label">Top weight per session</p>${sparkline(
            '0,44 60,40 120,34 180,30 240,22 300,16',
            'M0,44 L60,40 L120,34 L180,30 L240,22 L300,16 L300,64 L0,64 Z',
          )}
          <p class="trend-label">Volume per session (weight × reps)</p>${sparkline(
            '0,50 60,46 120,38 180,40 240,28 300,18',
            'M0,50 L60,46 L120,38 L180,40 L240,28 L300,18 L300,64 L0,64 Z',
          )}
        </article>

        <article class="exercise-trend">
          <h3>Floor EZ-bar skull crusher</h3>
          <p class="trend-label">Top weight per session</p>${sparkline(
            '0,52 60,48 120,44 180,36 240,30 300,24',
            'M0,52 L60,48 L120,44 L180,36 L240,30 L300,24 L300,64 L0,64 Z',
          )}
          <p class="trend-label">Volume per session (weight × reps)</p>${sparkline(
            '0,56 60,50 120,46 180,34 240,32 300,20',
            'M0,56 L60,50 L120,46 L180,34 L240,32 L300,20 L300,64 L0,64 Z',
          )}
        </article>
      </section>
    </div>
  </main>
  <nav class="tab-bar" aria-label="Main navigation">
    <button type="button">Session</button>
    <button type="button" class="active">Progress</button>
    <button type="button">Overview</button>
  </nav>
</div>`;

const overviewBody = `
<div class="app-root">
  <main>
    <div class="screen overview-screen">
      <header>
        <h1>Program overview</h1>
      </header>

      <section aria-labelledby="variant-heading">
        <h2 id="variant-heading">Variant</h2>
        <div class="variant-switcher" role="group" aria-label="Program variant">
          <button type="button" class="active">4-day</button>
          <button type="button">3-day</button>
        </div>
        <p class="current-state">Currently: 4-day, Week 1, Mon</p>
      </section>

      <section aria-labelledby="jump-heading">
        <h2 id="jump-heading">Manual week/day override</h2>
        <form>
          <label>Week
            <select><option>1</option></select>
          </label>
          <label>Day
            <select><option>Mon</option></select>
          </label>
          <button type="submit">Jump</button>
        </form>
      </section>

      <section aria-labelledby="day-actions-heading">
        <h2 id="day-actions-heading">Day actions</h2>
        <p class="current-state">Current day: Week 1, Mon (4-day)</p>
        <div class="day-actions">
          <button type="button">Skip day</button>
          <button type="button">Repeat day</button>
        </div>
      </section>
    </div>
  </main>
  <nav class="tab-bar" aria-label="Main navigation">
    <button type="button">Session</button>
    <button type="button">Progress</button>
    <button type="button" class="active">Overview</button>
  </nav>
</div>`;

/* ---------------------------- foundations ---------------------------- */

const swatch = (name, varName, ink) => `
    <div style="border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;">
      <div style="height:64px;background:var(${varName});${ink ? `color:var(${ink});` : ''}display:flex;align-items:flex-end;padding:var(--space-2);font-size:var(--text-xs);font-weight:700;">${varName}</div>
      <div style="padding:var(--space-2);font-size:var(--text-xs);color:var(--text-muted);">${name}</div>
    </div>`;

const colorsBody = `
<div class="token-page">
  <h1 style="font-size:var(--text-xl);margin:0 0 var(--space-4);">Color roles</h1>
  <p style="color:var(--text-muted);font-size:var(--text-sm);margin:0 0 var(--space-4);">
    One committed dark look. Four semantic roles — action / success / danger / muted — plus surfaces and text. Do not add a fifth hue.
  </p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
    ${swatch('Background', '--bg')}
    ${swatch('Raised surface', '--bg-raised')}
    ${swatch('Inset surface', '--bg-inset')}
    ${swatch('Border', '--border')}
    ${swatch('Action (primary)', '--action', '--action-ink')}
    ${swatch('Action strong', '--action-strong', '--action-ink')}
    ${swatch('Success', '--success', '--success-ink')}
    ${swatch('Danger', '--danger', '--danger-ink')}
  </div>
  <div style="margin-top:var(--space-5);display:flex;flex-direction:column;gap:var(--space-2);">
    <span style="color:var(--text);">Text — primary</span>
    <span style="color:var(--text-muted);">Text — muted</span>
    <span style="color:var(--text-faint);">Text — faint</span>
  </div>
</div>`;

const typeSpaceBody = `
<div class="token-page">
  <h1 style="font-size:var(--text-xl);margin:0 0 var(--space-4);">Type &amp; spacing</h1>

  <h2 style="font-size:var(--text-sm);text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin:0 0 var(--space-3);">Type scale</h2>
  <div style="display:flex;flex-direction:column;gap:var(--space-2);">
    <div style="font-size:var(--text-xl);font-weight:700;">Display / xl — 1.4rem</div>
    <div style="font-size:var(--text-lg);font-weight:700;">Heading / lg — 1.15rem</div>
    <div style="font-size:var(--text-base);">Body / base — 1rem</div>
    <div style="font-size:var(--text-sm);color:var(--text-muted);">Small / sm — 0.9rem</div>
    <div style="font-size:var(--text-xs);color:var(--text-faint);">Caption / xs — 0.8rem</div>
  </div>

  <h2 style="font-size:var(--text-sm);text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin:var(--space-5) 0 var(--space-3);">Spacing scale</h2>
  <div style="display:flex;flex-direction:column;gap:var(--space-2);">
    <div style="display:flex;align-items:center;gap:var(--space-3);"><span style="width:3rem;font-size:var(--text-xs);color:var(--text-faint);">1</span><span style="height:14px;width:var(--space-1);background:var(--action);"></span></div>
    <div style="display:flex;align-items:center;gap:var(--space-3);"><span style="width:3rem;font-size:var(--text-xs);color:var(--text-faint);">2</span><span style="height:14px;width:var(--space-2);background:var(--action);"></span></div>
    <div style="display:flex;align-items:center;gap:var(--space-3);"><span style="width:3rem;font-size:var(--text-xs);color:var(--text-faint);">3</span><span style="height:14px;width:var(--space-3);background:var(--action);"></span></div>
    <div style="display:flex;align-items:center;gap:var(--space-3);"><span style="width:3rem;font-size:var(--text-xs);color:var(--text-faint);">4</span><span style="height:14px;width:var(--space-4);background:var(--action);"></span></div>
    <div style="display:flex;align-items:center;gap:var(--space-3);"><span style="width:3rem;font-size:var(--text-xs);color:var(--text-faint);">5</span><span style="height:14px;width:var(--space-5);background:var(--action);"></span></div>
    <div style="display:flex;align-items:center;gap:var(--space-3);"><span style="width:3rem;font-size:var(--text-xs);color:var(--text-faint);">6</span><span style="height:14px;width:var(--space-6);background:var(--action);"></span></div>
  </div>

  <h2 style="font-size:var(--text-sm);text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin:var(--space-5) 0 var(--space-3);">Radii</h2>
  <div style="display:flex;gap:var(--space-3);">
    <div style="width:72px;height:56px;background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-sm);"></div>
    <div style="width:72px;height:56px;background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-md);"></div>
    <div style="width:72px;height:56px;background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-lg);"></div>
  </div>
</div>`;

/* ------------------------------- emit ------------------------------- */

const files = [
  ['foundations/colors.html', page({ group: 'Foundations', title: 'Color roles', body: colorsBody })],
  ['foundations/type-and-space.html', page({ group: 'Foundations', title: 'Type & spacing', body: typeSpaceBody })],
  ['screens/session.html', page({ group: 'Screens', title: 'Session screen', body: sessionBody })],
  ['screens/progress.html', page({ group: 'Screens', title: 'Progress screen', body: progressBody })],
  ['screens/overview.html', page({ group: 'Screens', title: 'Overview screen', body: overviewBody })],
];

for (const [rel, html] of files) {
  const dest = path.join(OUT, rel);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, html);
  console.log(`wrote design/${rel}`);
}
