# CLAUDE.md

Single-user, phone-first, offline-capable PWA replacing an Excel-based 12-week arm-growth workout program. Full requirements: `docs/PRD.md` (numbered R1–R23 — reference by number, e.g. "R9 not met"). Read the PRD before implementing or reviewing anything here.

## Hard constraints — never violate these

1. **Single user, no backend, ever.** No accounts, no auth, no server, no cloud sync, no data export/import feature. All persistence is on-device IndexedDB. Do not add a backend "for later" — see PRD §10 Out of Scope.
2. **GitHub Pages base path must be `/crispy-palm-tree/`.** Vite's `base` config must match the repo name exactly or every asset 404s on Pages. If the repo is ever renamed, this must be updated in the same commit.
3. **All program/exercise seed data lives in `src/data/` and derives from `docs/source/program_full.json`.** Never invent, round, or approximate a set/rep/RIR number — if it's not in that file, it's either a verbatim warm-up import, or new content explicitly marked `authored: true` (cool-down routine, pool alternates — capped at 2–3 per movement pattern, PRD R2/R3/R6). When in doubt, quote the source row in a code comment.
4. **The session engine (`src/engine/`) must be deterministic.** No `Date.now()`, no unseeded `Math.random()`, no hidden mutable module state inside `generateSession`. Same `(variant, week, day, rotationState)` in → same session out, always. It is golden-tested against extracted Week 1 and Week 9 ground truth (PRD R9) — a red golden test means the engine is wrong, not the test.
5. **No new runtime dependency beyond the approved stack** (React, Vite, `vite-plugin-pwa`, `idb`) **without one line of justification in your report.** The one open choice the plan leaves to senior-dev is the chart library for progress views (Chart.js vs inline SVG) — decide via the solution ladder (proven → improve → new) and say which and why.
6. A wrong workout is the worst possible bug here — it breaks the one thing this app promises. Engine correctness (PRD §4) outranks UI polish every time; build and golden-test the engine before touching screens.

## Repo layout (target, post-scaffold)

```
src/
  data/       # exercise catalog, program schema (3-day/4-day), warm-up, cool-down — PRD §3
  engine/     # generateSession, rotation, progression.ts — PRD §4
    __tests__/
  storage/    # idb wrapper: program state + per-set logs — PRD §5
  ui/ (or components/, screens/)  # session screen, progress screen, overview screen — PRD §6
docs/
  PRD.md
```

Scaffold does not exist yet at the time of writing. The commands below are the target state once the Vite+React+TS scaffold, `vite-plugin-pwa`, and Vitest are wired in (build plan step 2) — if `package.json` is missing, that scaffold step comes first.

## Commands

```
npm install        # install deps
npm run dev         # local dev server (Vite)
npm test            # Vitest — engine golden tests, progression tests, rotation tests
npm run build        # production build (must be clean — no type errors)
npm run preview      # serve the production build locally, for the Playwright smoke test
```

Exact script names may differ slightly once scaffolded (e.g. `vitest run` vs `vitest`) — check `package.json` scripts before assuming; update this section if they diverge.

## Targets

- **Phone-first PWA.** Design and test at phone viewport widths first; desktop is not a target layout.
- **Browsers**: iOS Safari and Android Chrome (current versions). No IE/legacy support, no native app-store builds.
- **Dev host**: Linux. Do not assume macOS/Windows tooling (no `open`, no PowerShell) in scripts or CI.
- **CI/deploy**: GitHub Actions → GitHub Pages, static hosting only, no server runtime.

## Conventions

- TypeScript everywhere in `src/`. No implicit `any` in new code.
- Engine functions are pure; storage and UI are the only layers allowed side effects (IndexedDB reads/writes, DOM).
- Movement-pattern tags on exercises (PRD R2) are the unit rotation logic keys on — don't introduce a second parallel taxonomy.
- Match existing patterns before introducing new ones once code exists; this file governs constraints, `docs/PRD.md` governs scope, existing code governs style.

## Git / commits

- Small, single-concern commits, imperative mood ("Add session golden tests", not "added stuff").
- Every commit made by an agent must end with these two lines, verbatim, as the last lines of the commit message:

```
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013DmTzkFfvCycXB4WH3HqxM
```

- Never force-push or rewrite pushed history without explicit approval.
- Never commit secrets or `.env` files.

## Out of scope — do not build even if asked mid-implementation

Backend/accounts/cloud sync/export, native app packaging, push notifications, exercise videos/animations, a program builder beyond the fixed 12-week cycle (restart only), rest timers with audio/haptics, nutrition tracking, social features. Full list: `docs/PRD.md` §10. If a request would add one of these, flag it and point to this section instead of building it.
