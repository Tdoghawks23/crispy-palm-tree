/**
 * Exercise catalog — PRD R2/R3.
 *
 * `authored: false` entries are the 17 named exercises that appear in
 * `docs/source/program_full.json` (14 distinct catalog rows; the EZ-bar curl
 * row alone accounts for 4 of the 17 source names via its `gripVariants`,
 * matching the source file's own weekly grip rotation — see R2's own
 * example). `authored: true` entries are new pool-expansion alternates
 * (R3), capped at 3 total per movement pattern including the original(s),
 * built only from: EZ-bar + plates, dumbbells, barbell, resistance bands,
 * chairs, push-up board.
 *
 * Form cues on `authored: false` entries are quoted from the source file's
 * `notes` column (the mesocycle-invariant baseline cue; per-week variations
 * such as the deload RIR suffix or M2 intensifier text live in
 * `program.ts`, verbatim per slot, not here).
 */

export type MovementPattern =
  | 'curl-ez'
  | 'curl-hammer'
  | 'curl-spider'
  | 'curl-reverse'
  | 'triceps-skull-crusher'
  | 'triceps-overhead'
  | 'triceps-jm-press'
  | 'close-grip-pushup'
  | 'dip'
  | 'row-horizontal'
  | 'row-unilateral'
  | 'grip-isometric'
  | 'wrist-flexion-extension';

export const MOVEMENT_PATTERNS: MovementPattern[] = [
  'curl-ez',
  'curl-hammer',
  'curl-spider',
  'curl-reverse',
  'triceps-skull-crusher',
  'triceps-overhead',
  'triceps-jm-press',
  'close-grip-pushup',
  'dip',
  'row-horizontal',
  'row-unilateral',
  'grip-isometric',
  'wrist-flexion-extension',
];

/**
 * Display names for the movement-pattern keys, for UI that aggregates
 * across rotating alternates (e.g. the Progress screen's pattern trends).
 * Display-only — the `pattern` keys above remain the single taxonomy
 * rotation and grouping logic key on (CLAUDE.md).
 */
export const PATTERN_LABELS: Record<MovementPattern, string> = {
  'curl-ez': 'Supinated curl',
  'curl-hammer': 'Hammer curl',
  'curl-spider': 'Spider curl',
  'curl-reverse': 'Reverse curl',
  'triceps-skull-crusher': 'Skull crusher',
  'triceps-overhead': 'Overhead extension',
  'triceps-jm-press': 'JM press',
  'close-grip-pushup': 'Close-grip push-up',
  dip: 'Dip',
  'row-horizontal': 'Horizontal row',
  'row-unilateral': 'Unilateral row',
  'grip-isometric': 'Grip hold',
  'wrist-flexion-extension': 'Wrist curls',
};

/** Equipment pool this whole app is allowed to assume the user owns (R3). */
export type Equipment =
  | 'ez-bar'
  | 'plates'
  | 'dumbbells'
  | 'barbell'
  | 'bands'
  | 'chairs'
  | 'pushup-board';

export interface Exercise {
  id: string;
  /** Canonical display name. */
  name: string;
  pattern: MovementPattern;
  primaryMuscles: string[];
  equipment: Equipment[];
  /** Baseline form cue, quoted/derived from source `notes` (see file header). */
  formCues: string;
  /**
   * Grip or stance variants the source file itself already rotates by week
   * (R2), e.g. EZ-bar curl's Narrow/Wide/Medium/Medium (Deload) grips, or
   * the two Spider curl setups (with bench vs no bench) used by the 4-day
   * vs 3-day variants respectively.
   */
  variants?: string[];
  /** false = one of the 17 source exercises; true = R3 pool-expansion alternate. */
  authored: boolean;
  /**
   * True for exercises whose primary load is the trainee's own bodyweight
   * (close-grip push-up and bodyweight dip variants). Drives two things:
   * the session screen treats the weight input as optional/de-emphasized
   * for these, and progression.ts suggests a harder variation at the top
   * of the rep range instead of a weight increment. Exercises that are
   * explicitly about adding external load (e.g. weighted bench-dip) are
   * NOT flagged bodyweight even though they share the pattern, since
   * tracking weight is the point of choosing that variation.
   */
  bodyweight?: boolean;
}

export const EXERCISES: Exercise[] = [
  // ---------------------------------------------------------------------
  // curl-ez — biceps curl, EZ-bar supinated grip
  // Source notes (M1 baseline): "Strict form; 3-1-1 tempo."
  // ---------------------------------------------------------------------
  {
    id: 'ez-bar-curl',
    name: 'EZ-bar curl',
    pattern: 'curl-ez',
    primaryMuscles: ['biceps brachii'],
    equipment: ['ez-bar', 'plates'],
    formCues: 'Strict form; 3-1-1 tempo.',
    variants: ['Narrow grip', 'Wide grip', 'Medium grip', 'Medium (Deload) grip'],
    authored: false,
  },
  {
    id: 'barbell-curl',
    name: 'Barbell curl',
    pattern: 'curl-ez',
    primaryMuscles: ['biceps brachii'],
    equipment: ['barbell', 'plates'],
    formCues: 'Standing supinated grip; strict, no hip drive; 3-1-1 tempo.',
    authored: true,
  },
  {
    id: 'band-standing-curl',
    name: 'Band standing curl',
    pattern: 'curl-ez',
    primaryMuscles: ['biceps brachii'],
    equipment: ['bands'],
    formCues: 'Feet on band, supinated grip; strict, control the eccentric.',
    authored: true,
  },

  // ---------------------------------------------------------------------
  // curl-hammer — biceps curl, neutral/hammer grip
  // Source notes (M1 baseline): "Neutral grip; 1s squeeze; no swinging."
  // ---------------------------------------------------------------------
  {
    id: 'db-hammer-curl',
    name: 'DB hammer curl',
    pattern: 'curl-hammer',
    primaryMuscles: ['brachialis', 'brachioradialis', 'biceps brachii'],
    equipment: ['dumbbells'],
    formCues: 'Neutral grip; 1s squeeze; no swinging.',
    authored: false,
  },
  {
    id: 'band-hammer-curl',
    name: 'Band hammer curl',
    pattern: 'curl-hammer',
    primaryMuscles: ['brachialis', 'brachioradialis', 'biceps brachii'],
    equipment: ['bands'],
    formCues: 'Neutral grip; steady tension, no swinging.',
    authored: true,
  },
  {
    id: 'db-cross-body-hammer-curl',
    name: 'Cross-body hammer curl',
    pattern: 'curl-hammer',
    primaryMuscles: ['brachialis', 'brachioradialis', 'biceps brachii'],
    equipment: ['dumbbells'],
    formCues: 'Neutral grip, curl across body toward opposite shoulder; control down.',
    authored: true,
  },

  // ---------------------------------------------------------------------
  // curl-spider — biceps curl, stretch-position/spider
  // Source notes (M1 baseline): "3-1-1 tempo; constant tension." (4-day,
  // hinge/back-to-wall setup) / "Strict; constant tension." (3-day, no
  // bench setup) — both quoted verbatim in program.ts per slot; the two
  // setups are recorded here as `variants`.
  // ---------------------------------------------------------------------
  {
    id: 'spider-curl',
    name: "'Spider' curl",
    pattern: 'curl-spider',
    primaryMuscles: ['biceps brachii (short head)'],
    equipment: ['ez-bar', 'plates'],
    formCues: '3-1-1 tempo; constant tension; chest/arms supported, no swinging.',
    variants: ['hinge; chest to thighs / back-to-wall', 'no bench'],
    authored: false,
  },
  {
    id: 'db-seated-spider-curl',
    name: 'Seated DB spider curl (chair support)',
    pattern: 'curl-spider',
    primaryMuscles: ['biceps brachii (short head)'],
    equipment: ['dumbbells', 'chairs'],
    formCues: 'Chest against chair back, arms hanging; strict, constant tension.',
    authored: true,
  },
  {
    id: 'band-spider-curl',
    name: 'Band spider curl',
    pattern: 'curl-spider',
    primaryMuscles: ['biceps brachii (short head)'],
    equipment: ['bands', 'chairs'],
    formCues: 'Hinged over chair back, band anchored low; constant tension, no swinging.',
    authored: true,
  },

  // ---------------------------------------------------------------------
  // curl-reverse — reverse curl, pronated grip
  // Source notes (M1 baseline): "Knuckles up; control wrists."
  // ---------------------------------------------------------------------
  {
    id: 'ez-bar-reverse-curl',
    name: 'EZ-bar reverse curl',
    pattern: 'curl-reverse',
    primaryMuscles: ['brachioradialis', 'forearm extensors'],
    equipment: ['ez-bar', 'plates'],
    formCues: 'Knuckles up; control wrists.',
    authored: false,
  },
  {
    id: 'barbell-reverse-curl',
    name: 'Barbell reverse curl',
    pattern: 'curl-reverse',
    primaryMuscles: ['brachioradialis', 'forearm extensors'],
    equipment: ['barbell', 'plates'],
    formCues: 'Pronated grip, knuckles up; strict, control wrists.',
    authored: true,
  },
  {
    id: 'band-reverse-curl',
    name: 'Band reverse curl',
    pattern: 'curl-reverse',
    primaryMuscles: ['brachioradialis', 'forearm extensors'],
    equipment: ['bands'],
    formCues: 'Pronated grip, knuckles up; control wrists.',
    authored: true,
  },

  // ---------------------------------------------------------------------
  // triceps-skull-crusher — lying skull crusher
  // Source notes (M1 baseline): "Tempo 3-0-1; lower behind head; wrists
  // neutral."
  // ---------------------------------------------------------------------
  {
    id: 'floor-ez-bar-skull-crusher',
    name: 'Floor EZ-bar skull crusher',
    pattern: 'triceps-skull-crusher',
    primaryMuscles: ['triceps brachii (long head)'],
    equipment: ['ez-bar', 'plates'],
    formCues: 'Tempo 3-0-1; lower behind head; wrists neutral.',
    authored: false,
  },
  {
    id: 'db-floor-skull-crusher',
    name: 'DB floor skull crusher',
    pattern: 'triceps-skull-crusher',
    primaryMuscles: ['triceps brachii (long head)'],
    equipment: ['dumbbells'],
    formCues: 'Neutral grip, lower behind head; wrists neutral; controlled tempo.',
    authored: true,
  },
  {
    id: 'barbell-floor-skull-crusher',
    name: 'Barbell floor skull crusher',
    pattern: 'triceps-skull-crusher',
    primaryMuscles: ['triceps brachii (long head)'],
    equipment: ['barbell', 'plates'],
    formCues: 'Lower behind head; wrists neutral; controlled tempo.',
    authored: true,
  },

  // ---------------------------------------------------------------------
  // triceps-overhead — overhead triceps extension
  // Source notes (M1 baseline): "Deep stretch; ribs down; elbows in."
  // ---------------------------------------------------------------------
  {
    id: 'overhead-triceps-extension-db',
    name: 'Overhead triceps extension (single DB)',
    pattern: 'triceps-overhead',
    primaryMuscles: ['triceps brachii (long head)'],
    equipment: ['dumbbells'],
    formCues: 'Deep stretch; ribs down; elbows in.',
    authored: false,
  },
  {
    id: 'band-overhead-triceps-extension',
    name: 'Band overhead triceps extension',
    pattern: 'triceps-overhead',
    primaryMuscles: ['triceps brachii (long head)'],
    equipment: ['bands'],
    formCues: 'Deep stretch overhead; ribs down; elbows in, no flare.',
    authored: true,
  },
  {
    id: 'ez-bar-overhead-triceps-extension',
    name: 'EZ-bar overhead triceps extension',
    pattern: 'triceps-overhead',
    primaryMuscles: ['triceps brachii (long head)'],
    equipment: ['ez-bar', 'plates'],
    formCues: 'Two-hand grip overhead; deep stretch; elbows in, ribs down.',
    authored: true,
  },

  // ---------------------------------------------------------------------
  // triceps-jm-press — triceps compound press (JM press)
  // Source notes (M1 baseline): "Bar path nose→chest; neutral wrists."
  // ---------------------------------------------------------------------
  {
    id: 'ez-bar-jm-press',
    name: 'EZ-bar JM press',
    pattern: 'triceps-jm-press',
    primaryMuscles: ['triceps brachii'],
    equipment: ['ez-bar', 'plates'],
    formCues: 'Bar path nose to chest; neutral wrists.',
    authored: false,
  },
  {
    id: 'barbell-jm-press',
    name: 'Barbell JM press',
    pattern: 'triceps-jm-press',
    primaryMuscles: ['triceps brachii'],
    equipment: ['barbell', 'plates'],
    formCues: 'Bar path nose to chest; elbows stay in; neutral wrists.',
    authored: true,
  },
  {
    id: 'db-close-grip-floor-press',
    name: 'Close-grip DB floor press',
    pattern: 'triceps-jm-press',
    primaryMuscles: ['triceps brachii'],
    equipment: ['dumbbells'],
    formCues: 'Elbows tucked, press to lockout over chest; controlled tempo.',
    authored: true,
  },

  // ---------------------------------------------------------------------
  // close-grip-pushup — close-grip push-up
  // Two source exercises share this pattern (progressions of the same
  // movement), so the pool is already at 2 of the 3-total cap; only one
  // authored alternate is added.
  // Source notes (M1 baseline): "3-1-1 tempo; elevate feet if 20 reps easy;
  // last set RIR 1-2." / "3-1-1 tempo; slight protraction at top."
  // ---------------------------------------------------------------------
  {
    id: 'close-grip-pushup-board-narrow',
    name: 'Close-grip push-up (board narrow)',
    pattern: 'close-grip-pushup',
    primaryMuscles: ['triceps brachii', 'pectoralis major (sternal)', 'anterior deltoid'],
    equipment: ['pushup-board'],
    formCues: 'Tempo 3-1-1; elevate feet if 20 reps easy; last set RIR 1-2.',
    authored: false,
    bodyweight: true,
  },
  {
    id: 'close-grip-pushup-feet-elevated',
    name: 'Close-grip push-up (feet elevated/weighted)',
    pattern: 'close-grip-pushup',
    primaryMuscles: ['triceps brachii', 'pectoralis major (sternal)', 'anterior deltoid'],
    equipment: ['pushup-board', 'plates'],
    formCues: '3-1-1 tempo; slight protraction at top.',
    authored: false,
    bodyweight: true,
  },
  {
    id: 'band-resisted-close-grip-pushup',
    name: 'Band-resisted close-grip push-up',
    pattern: 'close-grip-pushup',
    primaryMuscles: ['triceps brachii', 'pectoralis major (sternal)', 'anterior deltoid'],
    equipment: ['pushup-board', 'bands'],
    formCues: 'Band across upper back anchored under hands; 3-1-1 tempo, elbows tucked.',
    authored: true,
    bodyweight: true,
  },

  // ---------------------------------------------------------------------
  // dip — dip
  // Source notes (M1 baseline): "Knees bent->straight to progress;
  // shoulders packed."
  // ---------------------------------------------------------------------
  {
    id: 'bench-dip-chairs',
    name: 'Bench-dip between chairs',
    pattern: 'dip',
    primaryMuscles: ['triceps brachii', 'anterior deltoid'],
    equipment: ['chairs'],
    formCues: 'Knees bent to straight to progress; shoulders packed; smooth bottom, no shoulder glide.',
    authored: false,
    bodyweight: true,
  },
  {
    id: 'weighted-bench-dip',
    name: 'Weighted bench-dip',
    pattern: 'dip',
    primaryMuscles: ['triceps brachii', 'anterior deltoid'],
    equipment: ['chairs', 'plates'],
    formCues: 'Plate on lap; shoulders packed, smooth bottom, no shoulder glide.',
    authored: true,
    // Not flagged bodyweight: the point of this variation over the plain
    // bench-dip original is adding external load, so weight tracking stays
    // primary here.
  },
  {
    id: 'band-resisted-bench-dip',
    name: 'Band-resisted bench-dip',
    pattern: 'dip',
    primaryMuscles: ['triceps brachii', 'anterior deltoid'],
    equipment: ['chairs', 'bands'],
    formCues: 'Band anchored under front chair, looped over shoulders; shoulders packed, smooth bottom.',
    authored: true,
    bodyweight: true,
  },

  // ---------------------------------------------------------------------
  // row-horizontal — horizontal row (bent-over)
  // Source notes (M1 baseline): "Pause 1s at ribs; biceps bias."
  // ---------------------------------------------------------------------
  {
    id: 'underhand-barbell-row',
    name: 'Underhand barbell row from hinge',
    pattern: 'row-horizontal',
    primaryMuscles: ['latissimus dorsi', 'biceps brachii', 'rear deltoid'],
    equipment: ['barbell', 'plates'],
    formCues: 'Pause 1s at ribs; biceps bias; torso 30-45 degrees.',
    authored: false,
  },
  {
    id: 'underhand-ez-bar-row',
    name: 'Underhand EZ-bar row from hinge',
    pattern: 'row-horizontal',
    primaryMuscles: ['latissimus dorsi', 'biceps brachii', 'rear deltoid'],
    equipment: ['ez-bar', 'plates'],
    formCues: 'Pause 1s at ribs; biceps bias; torso 30-45 degrees.',
    authored: true,
  },
  {
    id: 'band-bent-over-row',
    name: 'Band bent-over row (underhand)',
    pattern: 'row-horizontal',
    primaryMuscles: ['latissimus dorsi', 'biceps brachii', 'rear deltoid'],
    equipment: ['bands'],
    formCues: 'Underhand grip, hinge torso 30-45 degrees; pause 1s at ribs.',
    authored: true,
  },

  // ---------------------------------------------------------------------
  // row-unilateral — unilateral row
  // Source notes (M1 baseline): "1s squeeze at top; control down. (Swap to
  // BAND pulldown 3x10-15 if purchased)" — the source note itself already
  // names the band swap; the pinned catalog note omits the parenthetical
  // since it's an in-session substitution hint, not a form cue.
  // ---------------------------------------------------------------------
  {
    id: 'one-arm-db-row',
    name: '1-arm DB row (long squeeze)',
    pattern: 'row-unilateral',
    primaryMuscles: ['latissimus dorsi', 'biceps brachii'],
    equipment: ['dumbbells'],
    formCues: '1s squeeze at top; control down.',
    authored: false,
  },
  {
    id: 'one-arm-band-row',
    name: '1-arm band row',
    pattern: 'row-unilateral',
    primaryMuscles: ['latissimus dorsi', 'biceps brachii'],
    equipment: ['bands'],
    formCues: 'Staggered stance, band anchored low; 1s squeeze at top, control back.',
    authored: true,
  },
  {
    id: 'chair-supported-one-arm-db-row',
    name: 'Chair-supported 1-arm DB row',
    pattern: 'row-unilateral',
    primaryMuscles: ['latissimus dorsi', 'biceps brachii'],
    equipment: ['dumbbells', 'chairs'],
    formCues: 'Opposite hand/knee braced on chair; 1s squeeze at top, control down.',
    authored: true,
  },

  // ---------------------------------------------------------------------
  // grip-isometric — isometric grip hold
  // Source notes (M1 baseline): "Shoulders packed; don't shrug. Use thick
  // sleeves if owned."
  // ---------------------------------------------------------------------
  {
    id: 'timed-bar-holds',
    name: 'Timed bar holds (double overhand)',
    pattern: 'grip-isometric',
    primaryMuscles: ['forearm flexors', 'grip'],
    equipment: ['barbell', 'plates'],
    formCues: "Shoulders packed; don't shrug. Use thick sleeves if owned.",
    authored: false,
  },
  {
    id: 'db-farmer-hold',
    name: "Farmer's hold (dumbbells)",
    pattern: 'grip-isometric',
    primaryMuscles: ['forearm flexors', 'grip'],
    equipment: ['dumbbells'],
    formCues: 'Stand tall, shoulders packed; grip crushed, no shrugging.',
    authored: true,
  },
  {
    id: 'plate-pinch-hold',
    name: 'Plate pinch hold',
    pattern: 'grip-isometric',
    primaryMuscles: ['forearm flexors', 'grip (pinch)'],
    equipment: ['plates'],
    formCues: 'Pinch grip both plate faces, arm at side; shoulders packed, don’t shrug.',
    authored: true,
  },

  // ---------------------------------------------------------------------
  // wrist-flexion-extension — wrist flexion/extension
  // Source notes (M1 baseline): "Controlled; full ROM; no bounce."
  // ---------------------------------------------------------------------
  {
    id: 'wrist-curl-superset',
    name: 'Wrist curl + reverse wrist curl (superset)',
    pattern: 'wrist-flexion-extension',
    primaryMuscles: ['forearm flexors', 'forearm extensors'],
    equipment: ['ez-bar', 'plates'],
    formCues: 'Controlled; full ROM; no bounce.',
    authored: false,
  },
  {
    id: 'band-wrist-curl-superset',
    name: 'Band wrist curl + reverse wrist curl (superset)',
    pattern: 'wrist-flexion-extension',
    primaryMuscles: ['forearm flexors', 'forearm extensors'],
    equipment: ['bands'],
    formCues: 'Controlled; full ROM; no bounce.',
    authored: true,
  },
  {
    id: 'barbell-wrist-curl-superset',
    name: 'Barbell wrist curl + reverse wrist curl (superset)',
    pattern: 'wrist-flexion-extension',
    primaryMuscles: ['forearm flexors', 'forearm extensors'],
    equipment: ['barbell', 'plates'],
    formCues: 'Controlled; full ROM; no bounce.',
    authored: true,
  },
];

export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

export function getExercisesByPattern(pattern: MovementPattern): Exercise[] {
  return EXERCISES.filter((e) => e.pattern === pattern);
}
