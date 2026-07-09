/**
 * Warm-up routine — PRD R5.
 *
 * Imported verbatim from `docs/source/program_full.json`'s `warmup` array
 * (4 components), identical for every session regardless of variant/week.
 */

export interface WarmupStep {
  component: string;
  dosage: string;
  what: string;
}

// Verbatim from docs/source/program_full.json `warmup`:
export const WARMUP_STEPS: WarmupStep[] = [
  {
    component: 'General warm-up',
    dosage: '2–3 min',
    what: 'Brisk arm swings, shoulder circles; 5–10 easy push-ups (RIR 4–5).',
  },
  {
    component: 'Elbow-health circuit',
    dosage: '2–3 min',
    what: 'Prone Y‑T‑W or wall slides 1×10; overhead reach/lat stretch 30–45s/side; light reverse curls 1×20.',
  },
  {
    component: 'Ramp sets',
    dosage: '2–3 sets',
    what: 'First arm move: 2–3 lighter ramp sets to ~RIR 4–3 before working sets; grease the groove.',
  },
  {
    component: 'Optional blood-flow',
    dosage: '1–2 min',
    what: 'Very light banded push-downs or curls 1×20–30 to pump elbows (if bands owned).',
  },
];
