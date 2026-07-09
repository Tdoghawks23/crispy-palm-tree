# PRD — Personal Arm-Growth Workout PWA

Reader: AI coding agents (senior-dev, qa-code-reviewer, ux-ui-designer, devops-engineer) implementing and verifying this build. Reference requirements by number ("R4 not met").

## 0. What this is

A single-user, phone-first, installable, offline-capable PWA that replaces an Excel-based 12-week arm-growth program. Opening the app shows today's complete session ready to go: warm-up checklist → main exercises (per-set checkboxes, weight/reps logging, progression suggestion, form cues) → cool-down checklist. Exercises rotate among equipment-compatible alternates day-to-day while the underlying 12-week periodization stays fixed. One user, forever. No accounts, no backend.

## 1. Sources of truth

- **Seed data**: `docs/source/program_full.json` (in this repo) — full extracted 12-week program (4-day and 3-day variants, all weeks, warm-up routine). Every set/rep/RIR/tempo number in `src/data/` must trace back to this file. **Never invent or approximate set/rep numbers** — if a value is ambiguous or missing, flag it, don't guess.
- **Human-readable analysis**: `docs/source/excel_analysis.txt` — useful for spot-checking, not a substitute for the JSON when writing data files.
- **Build plan**: `/root/.claude/plans/root-claude-uploads-35e077ad-7371-5e59-declarative-fiddle.md` — scope authority for this PRD. This PRD does not add or cut scope from that plan.

## 2. Mesocycle map (verified against `program_full.json`)

| Weeks | Mesocycle | Rule |
|---|---|---|
| 1–4 | M1: Base/Skill | 3–4s eccentrics, focus technique. Full sets per exercise. |
| 5–8 | M2: Overload | Full sets. Add 1¼ reps on EZ-bar curls (sets 1–2). One mini rest-pause on the last close-grip push-up set. |
| 9 | Deload | Sets cut to ~50–60% of M1/M2 values (per-exercise values are in `program_full.json`, not a computed percentage — use the file's literal `sets` field for week 9). RIR target 3–4 (looser than the RIR 1–2 used elsewhere). No intensifiers (no 1¼ reps, no rest-pause). |
| 10–12 | M3: Density | Sets return to M2 values. Cut rest time ~15–20% (display-only guidance; the app does not enforce rest timers — see R21 out-of-scope). |

Both the 3-day and 4-day variants follow this same week→mesocycle mapping; only the day/session split and per-day exercise list differ.

## 3. Data requirements

**R1.** All program and exercise seed data lives under `src/data/` and is derived exclusively from `program_full.json`. Each seed record must be traceable to a source row (week, day, session, exercise) or explicitly marked `authored: true` for new content (R6 cool-down, R2 pool alternates).

**R2.** Exercise catalog (`src/data/exercises.ts` or equivalent) contains the 17 original exercises from the source file, each tagged with: movement pattern, primary muscle(s), equipment required, and any grip/stance variants already present in the source (e.g., EZ-bar curl — Narrow/Wide/Medium/Medium-Deload grip, which the source file itself already rotates by week). Movement patterns to tag, derived from the 17 exercises: biceps curl (EZ-bar supinated grip), biceps curl (neutral/hammer), biceps curl (stretch-position/spider), reverse curl (pronated), triceps extension (lying skull crusher), triceps extension (overhead), triceps compound press (JM press), close-grip push-up, dip, horizontal row (bent-over), unilateral row, isometric grip hold, wrist flexion/extension.

**R3.** Exercise pool expansion: for each movement pattern in R2, author up to 2–3 additional equipment-compatible alternates (hard cap — do not exceed 3 total per pattern including the original). Every alternate must be performable with only: EZ-bar + plates, dumbbells, barbell, resistance bands, chairs, push-up board. Mark these records `authored: true`. This is a one-time authoring pass, not an ongoing feature.

**R4.** Program schema (`src/data/program.ts` or equivalent) encodes, for both 3-day and 4-day variants: week (1–12) → day → session name → ordered list of exercise slots, each slot carrying sets/reps/RIR/tempo/notes for the active mesocycle (per the map in §2), pulled verbatim from `program_full.json`. The 3-day variant's source rows include `"day": "None"` / `"session": "None"` placeholders for non-training weekdays — these must NOT be imported as empty sessions; only Mon/Wed/Fri (3-day) and Mon/Tue/Thu/Sat (4-day) are real training days.

**R5.** Warm-up routine (`src/data/warmup.ts`) is imported verbatim from `program_full.json`'s `warmup` array (4 components: General warm-up, Elbow-health circuit, Ramp sets, Optional blood-flow), same for every session regardless of variant/week.

**R6.** Cool-down routine (`src/data/cooldown.ts`) does **not exist in the source file** and must be authored new. It must mirror the warm-up's shape (component / dosage / what-to-do) and use only the equipment list in R3. Mark `authored: true`. Minimum: address the muscle groups worked that day (arms/push/pull) with light stretching or down-regulation — exact content is a senior-dev authoring task, not specified further here (see Out of Scope, §7, for what NOT to add — no timers/audio).

## 4. Engine requirements

**R7.** `src/engine/` exposes a pure, deterministic function: `generateSession(variant, week, day, rotationState) → Session` where `Session` is the fully ordered warm-up steps + main exercises (with sets/reps/RIR/tempo/notes resolved for that week's mesocycle, including deload set reduction, M2 1¼-rep/rest-pause flags, M3 rest-cut notes) + cool-down steps. Same inputs must always produce the same output (no `Date.now()`, no unseeded `Math.random()` inside the engine).

**R8.** Exercise rotation selects one alternate per movement-pattern slot per session from the pool (R2+R3), respecting the cap of 2–3 alternates per pattern. A slot tagged as a curl-pattern movement in the source program must always resolve to a curl-pattern alternate (same for every other pattern) — rotation varies the specific movement, never the muscle group/pattern balance of the session.

**R9.** Golden tests (Vitest, `src/engine/__tests__/`) assert `generateSession` output against the extracted Week 1 and Week 9 ground truth in `program_full.json`/`excel_analysis.txt`, for both the 3-day and 4-day variants (4 golden cases minimum: 4-day W1, 4-day W9, 3-day W1, 3-day W9). These tests fail the build if session generation drifts from source data.

**R10.** Progression logic (`src/engine/progression.ts`): double progression. If the most recent logged set(s) for an exercise hit the top of its rep range at the session's target RIR, suggest a weight increase for next time; otherwise suggest +1 rep at the same weight. **No logged history for an exercise yet** → do not suggest a specific weight/rep number; fall back to displaying the exercise's rep-range and RIR target as plain guidance (e.g., "No history yet — aim for the middle of the rep range at RIR 1–2, pick a weight you can control for all sets"). No autoregulation beyond this; keep it simple per the build plan.

## 5. Persistence requirements

**R11.** `src/storage/` uses `idb` over IndexedDB. Program state record: active variant (3-day/4-day), current week, current day, and enough history to support advance/skip/repeat-day actions.

**R12.** Per-set logs: exercise id, set index, weight, reps, timestamp. One log entry per completed set, never overwritten — historical logs are the input to R10's progression logic and the R18 progress views.

**R13.** In-progress session state (which checkboxes are checked, which sets are logged) is persisted incrementally as the user interacts, not only on session completion. Closing the app mid-session and reopening it must restore exactly where the user left off — same session, same checked/unchecked state, same logged sets.

**R14.** First run (empty IndexedDB): initialize program state to variant = 4-day, week 1, day 1 (Mon). *(Assumption — no source material states a default variant; flag for human confirmation, see GAPS.)*

## 6. UI requirements

**R15.** Opening the app with an active program renders today's session immediately — zero taps to reach the warm-up checklist.

**R16.** Session screen order: warm-up checklist → main exercise cards (per-set checkboxes, weight/reps inputs, progression hint from R10, form cues from the exercise's `notes` field) → cool-down checklist. All three sections are visible/navigable in one session view; the user is never asked which section to start.

**R17.** Marking a session complete advances program state (day → next training day; last day of the week → next week; last week of variant's day-count aware week → per R4 mapping) and is the only action that advances state. Partial completion does not auto-advance.

**R18.** Progress screens: per-exercise weight/volume trend over time (from R12 logs), and a program-completion overview (weeks/days completed out of 12).

**R19.** Variant switcher (3-day ↔ 4-day) and a manual week/day override are both available from the program overview screen. See §8 for the switch-mid-program rule.

**R20.** Phone-first layout: usable one-handed, portrait, on a phone screen width first (desktop is not a target). Touch targets sized for mid-set sweaty-thumb use. The current/active set is the single most visually prominent element on the exercise card. Exact spacing/typography is the ux-ui-designer agent's task; this requirement is the constraint that pass must satisfy.

## 7. PWA / deployment requirements

**R21.** Stack: Vite + React + TypeScript, `vite-plugin-pwa` for manifest + service worker (Workbox), `idb` for storage, Vitest for tests. Chart rendering for R18: Chart.js or inline SVG, senior-dev's call per the project's solution ladder (see CLAUDE.md) — no other new runtime dependency without justification.

**R22.** GitHub Actions workflow builds and deploys to GitHub Pages. Vite `base` config must equal `/crispy-palm-tree/` (the repo name) or Pages asset paths 404.

**R23.** App shell (HTML/JS/CSS + cached data) loads with no network connection after the first successful visit, verified via Playwright's offline emulation in the smoke test (§9).

## 8. Defined edge behavior ("done" means these are handled, not just the happy path)

- **First run, empty DB** — see R14. No crash, no blank screen; the user lands on Week 1 Day 1 of the default variant.
- **Mid-session app close/reopen** — see R13. Reopening restores the exact in-progress session state.
- **End of week 12** — app detects program completion and offers "restart the 12-week program" (loop back to week 1, day 1). Logged history (R12) is preserved for progress views across a restart; program *state* (current week/day) resets. *(Assumption — the plan says "the cycle can be restarted" but does not specify whether history is wiped; flag for human confirmation, see GAPS.)*
- **Switching 3-day ↔ 4-day mid-program** — the mesocycle week number is preserved (switching in week 6 stays in week 6, now under the other variant's week-6 session list); the current day resets to that variant's first training day of the week. Rotation state (which alternates were recently used per movement pattern) carries over so the switch doesn't repeat the same exercise twice in a row. *(Assumption — the source material does not define a switch-mid-week rule; flag for human confirmation, see GAPS.)*
- **No logged history yet for an exercise** — see R10. Falls back to rep-range/RIR guidance, never a fabricated number.

## 9. Verification

Build is not "done" until all of the following pass:

1. `npm test` (Vitest) green, covering at minimum:
   - Engine golden tests (R9): 4-day W1, 4-day W9, 3-day W1, 3-day W9 vs extracted ground truth.
   - Progression logic tests (R10): weight-bump case, +1-rep case, no-history fallback case.
   - Rotation-balance tests (R8): every slot resolves to the correct movement pattern across repeated generations; cap of 2–3 alternates never exceeded.
2. `npm run build` completes clean (no type errors, no build warnings treated as fatal).
3. Headless smoke test (Playwright against the `vite preview` server) covers: app loads, today's session renders with warm-up/main/cool-down sections present, a set can be checked and a weight/reps value logged, reloading the page preserves that logged state (proves R13 + R11/R12 wired together).
4. PWA sanity: manifest is valid and linked, service worker registers, and the app shell loads with Playwright's network offline emulation on (R23).
5. Deployed GitHub Pages URL loads the app end-to-end; user manually installs to home screen on iOS Safari and Android Chrome and confirms (this step is not automatable in CI — devops-engineer documents the manual steps, user executes and confirms).

## 10. Out of scope (do not build; flag if asked to add)

- Backend, user accounts, cloud sync, data export/import. All data is on-device, one user, forever.
- Native app-store builds (App Store/Play Store packaging).
- Push notifications.
- Exercise videos or animations — text-based form cues only, matching the source file's format.
- A program builder or auto-generation of programs beyond this fixed 12-week cycle. The cycle can be restarted (§8) but not regenerated or customized week-by-week.
- Rest timers with audio/haptic alerts.
- Nutrition tracking, social features, sharing.

## Appendix: reference-only agent context

Not requirements — background for anyone implementing:

- **Full seed data**: `docs/source/program_full.json`
- **Human-readable analysis**: `docs/source/excel_analysis.txt`
