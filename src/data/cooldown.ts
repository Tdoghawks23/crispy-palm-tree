/**
 * Cool-down routine — PRD R6.
 *
 * Does not exist in `docs/source/program_full.json` — authored new,
 * mirroring the warm-up's shape (component / dosage / what). Equipment-free
 * or band-only, per the R3 equipment pool. Marked `authored: true`.
 */

export interface CooldownStep {
  component: string;
  dosage: string;
  what: string;
  authored: true;
}

export const COOLDOWN_STEPS: CooldownStep[] = [
  {
    component: 'Down-regulation breathing',
    dosage: '1–2 min',
    what: 'Sit or stand tall; slow nasal breathing, 4s in / 6s out; let heart rate settle before stretching.',
    authored: true,
  },
  {
    component: 'Biceps/forearm stretch',
    dosage: '30–45s/side',
    what: 'Arm extended, palm up, gently pull fingers back with the other hand until a light stretch is felt in the biceps/forearm; no bounce.',
    authored: true,
  },
  {
    component: 'Triceps/lat stretch',
    dosage: '30–45s/side',
    what: 'Overhead triceps stretch: raise one arm, bend elbow behind head, gently pull elbow with the other hand; keep ribs down.',
    authored: true,
  },
  {
    component: 'Chest/anterior shoulder stretch',
    dosage: '30–45s/side',
    what: 'Band or doorway-free version: clasp hands behind back, gently lift and open chest; or band pull-apart 1×15 easy reps to unwind push volume.',
    authored: true,
  },
];
