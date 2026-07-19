import { useEffect, useMemo, useRef, useState } from 'react';
import { generateSession, type SessionSlot } from '../../engine/generateSession';
import { parseRepRangeMax, parseTargetRIR, suggestProgression } from '../../engine/progression';
import { TRAINING_DAYS } from '../../data/program';
import { getMostRecentSessionSets } from '../../storage/sessionHistory';
import {
  addSetLog,
  completeSession as completeSessionInStorage,
  getSessionProgress,
  getSetLogsForExercise,
  saveSessionProgress,
  type ProgramState,
  type SessionProgress,
} from '../../storage/db';

interface Props {
  programState: ProgramState;
  onProgramStateChange: (next: ProgramState) => void;
}

function emptyProgress(programState: ProgramState): SessionProgress {
  return {
    variant: programState.variant,
    week: programState.week,
    day: programState.day,
    checkedSteps: [],
    setInputs: {},
    updatedAt: Date.now(),
  };
}

function isLastTrainingDayOfWeek(variant: ProgramState['variant'], day: string): boolean {
  const days = TRAINING_DAYS[variant];
  return days[days.length - 1] === day;
}

// Sane input bounds (QA should-fix 5): reject garbage before it ever
// reaches an append-only set log, rather than trying to clean it up after.
const MAX_WEIGHT_LB = 1000;
const MAX_REPS = 200;

function isValidWeight(weight: number): boolean {
  return Number.isFinite(weight) && weight >= 0 && weight <= MAX_WEIGHT_LB;
}

function isValidReps(reps: number): boolean {
  return Number.isInteger(reps) && reps >= 1 && reps <= MAX_REPS;
}

/** Whether a set's typed inputs are complete/valid enough to log — weight is optional for bodyweight exercises. */
function canLogSet(bodyweight: boolean, inputs: { weight?: number; reps?: number }): boolean {
  if (inputs.reps === undefined || !isValidReps(inputs.reps)) return false;
  if (bodyweight) return inputs.weight === undefined || isValidWeight(inputs.weight);
  return inputs.weight !== undefined && isValidWeight(inputs.weight);
}

export function SessionScreen({ programState, onProgramStateChange }: Props) {
  const session = useMemo(
    () =>
      generateSession(
        programState.variant,
        programState.week,
        programState.day,
        programState.rotationState,
      ),
    [programState.variant, programState.week, programState.day, programState.rotationState],
  );

  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const restartDialogRef = useRef<HTMLDialogElement>(null);

  // Guards against the double-tap "Complete session" bug (QA blocker): a
  // ref (not state) so the check is synchronous and immediate regardless
  // of React's render/batching timing — a second click, even one fired in
  // the same tick as the first, sees completingRef.current === true and
  // is ignored before it ever reaches storage. `isCompleting` (state)
  // mirrors it only for disabling the buttons visually.
  const completingRef = useRef(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Drive the native <dialog> imperatively (showModal/close) from the React
  // boolean state — gives real dialog semantics (focus trap, ::backdrop,
  // Escape-to-dismiss) instead of a plain styled <div> (R20 known weak spot).
  useEffect(() => {
    const dialog = restartDialogRef.current;
    if (!dialog) return;
    if (showRestartConfirm && !dialog.open) {
      dialog.showModal();
    } else if (!showRestartConfirm && dialog.open) {
      dialog.close();
    }
  }, [showRestartConfirm]);

  // Load (or start fresh) in-progress session state whenever the active
  // session identity changes — this is what restores exactly where the
  // user left off on a mid-session reopen (R13).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await getSessionProgress();
      const matchesCurrentSession =
        stored !== undefined &&
        stored.variant === programState.variant &&
        stored.week === programState.week &&
        stored.day === programState.day;
      if (!cancelled) {
        setProgress(matchesCurrentSession ? stored : emptyProgress(programState));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programState]);

  // Progression hints (R10) per main exercise, from the most recent
  // session's logged sets for that exercise.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const slot of session.mainExercises) {
        const repRangeMax = parseRepRangeMax(slot.reps);
        if (repRangeMax === undefined) continue;
        const targetRIR = parseTargetRIR(slot.reps) ?? 'the prescribed range';
        const logs = await getSetLogsForExercise(slot.exercise.id);
        const mostRecentSets = getMostRecentSessionSets(logs);
        const suggestion = suggestProgression({
          repRangeMax,
          targetRIR,
          mostRecentSets,
          bodyweight: slot.exercise.bodyweight,
          // slot.notes is already the verbatim/resolved form cue shown on
          // the card (see the form-cue paragraph below) — reuse it rather
          // than inventing a second progression-cue field (R1: no new
          // seed data beyond the source).
          progressionCue: slot.exercise.bodyweight ? slot.notes : undefined,
        });
        next[slot.exercise.id] = suggestion.message;
      }
      if (!cancelled) setSuggestions(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!progress) {
    return <p>Loading session…</p>;
  }

  async function persist(next: SessionProgress) {
    setProgress(next);
    await saveSessionProgress(next);
  }

  async function toggleSimpleStep(id: string) {
    if (!progress) return;
    const checked = progress.checkedSteps.includes(id);
    const checkedSteps = checked
      ? progress.checkedSteps.filter((s) => s !== id)
      : [...progress.checkedSteps, id];
    await persist({ ...progress, checkedSteps, updatedAt: Date.now() });
  }

  async function toggleMainSet(slot: SessionSlot, setIdx: number) {
    if (!progress) return;
    const id = `main-${slot.slotIndex}-set-${setIdx}`;
    const alreadyChecked = progress.checkedSteps.includes(id);
    if (alreadyChecked) {
      // Uncheck the box, but never delete the historical log entry — R12
      // per-set logs are append-only.
      await persist({
        ...progress,
        checkedSteps: progress.checkedSteps.filter((s) => s !== id),
        updatedAt: Date.now(),
      });
      return;
    }
    const inputs = progress.setInputs[id] ?? {};
    const bodyweight = slot.exercise.bodyweight === true;
    if (!canLogSet(bodyweight, inputs)) return;
    const weightToLog = inputs.weight ?? 0; // bodyweight exercise, no added weight logged
    const repsToLog = inputs.reps as number;
    // Update the checkbox state first (synchronously, before any await) so
    // the UI reflects the check immediately — the log write below doesn't
    // block that.
    await persist({
      ...progress,
      checkedSteps: [...progress.checkedSteps, id],
      updatedAt: Date.now(),
    });
    await addSetLog({
      exerciseId: slot.exercise.id,
      setIndex: setIdx,
      weight: weightToLog,
      reps: repsToLog,
      timestamp: Date.now(),
    });
  }

  function updateSetInput(id: string, field: 'weight' | 'reps', raw: string) {
    if (!progress) return;
    if (raw === '') {
      const nextInputs = {
        ...progress.setInputs,
        [id]: { ...progress.setInputs[id], [field]: undefined },
      };
      void persist({ ...progress, setInputs: nextInputs, updatedAt: Date.now() });
      return;
    }
    const value = Number(raw);
    const valid = field === 'weight' ? isValidWeight(value) : isValidReps(value);
    if (!valid) return; // reject negative/garbage/out-of-range values — never persisted, not even transiently
    const nextInputs = {
      ...progress.setInputs,
      [id]: { ...progress.setInputs[id], [field]: value },
    };
    void persist({ ...progress, setInputs: nextInputs, updatedAt: Date.now() });
  }

  const isLastDayOfProgram =
    programState.week === 12 && isLastTrainingDayOfWeek(programState.variant, programState.day);

  async function doComplete() {
    // Synchronous guard (BLOCKER fix, UI layer): ignore a re-entrant call
    // — from a double-tap on either "Complete session" or the restart
    // dialog's button — while a completion is already in flight. Paired
    // with the storage-layer idempotency fix in completeSession itself.
    if (completingRef.current) return;
    completingRef.current = true;
    setIsCompleting(true);
    try {
      const next = await completeSessionInStorage({
        variant: programState.variant,
        week: programState.week,
        day: programState.day,
      });
      setShowRestartConfirm(false);
      onProgramStateChange(next);
    } finally {
      completingRef.current = false;
      setIsCompleting(false);
    }
  }

  async function handleCompleteClick() {
    if (completingRef.current) return;
    if (isLastDayOfProgram) {
      setShowRestartConfirm(true);
      return;
    }
    await doComplete();
  }

  // Derived, display-only: the set-progress header (counter + dots). Keyed on
  // the same `main-${slotIndex}-set-${i}` ids the set checkboxes toggle, so it
  // reflects logged state without owning any of it.
  const mainSetIds = session.mainExercises.flatMap((slot) =>
    Array.from({ length: slot.sets }, (_, i) => `main-${slot.slotIndex}-set-${i}`),
  );
  const totalSets = mainSetIds.length;
  const doneCount = mainSetIds.filter((id) => progress.checkedSteps.includes(id)).length;

  return (
    <div className="screen session-screen">
      <header>
        <div className="session-header-top">
          <div>
            <h1>{session.session}</h1>
            <p className="meso-label">
              Week {session.week} · {session.day}
            </p>
            <p className="meso-note">{session.mesoLabel}</p>
          </div>
          <div>
            <div className="set-counter">
              {doneCount}
              <span className="den">/{totalSets}</span>
            </div>
            <div className="set-counter-label">Sets logged</div>
          </div>
        </div>
        <div className="set-dots" aria-hidden="true">
          {mainSetIds.map((id) => (
            <span
              key={id}
              className={`set-dot${progress.checkedSteps.includes(id) ? ' set-dot--on' : ''}`}
            />
          ))}
        </div>
      </header>

      <section aria-labelledby="warmup-heading">
        <h2 id="warmup-heading">Warm-up</h2>
        <ul className="checklist">
          {session.warmup.map((step, i) => {
            const id = `warmup-${i}`;
            return (
              <li key={id}>
                <label>
                  <input
                    type="checkbox"
                    checked={progress.checkedSteps.includes(id)}
                    onChange={() => void toggleSimpleStep(id)}
                  />
                  <div className="step-text">
                    <span className="step-component">{step.component}</span>{' '}
                    <span className="step-dosage">({step.dosage})</span>
                    <p className="step-what">{step.what}</p>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="main-heading">
        <h2 id="main-heading">Main exercises</h2>
        {session.mainExercises.map((slot) => (
          <article className="exercise-card" key={slot.slotIndex}>
            <h3>
              {slot.exercise.name}
              {slot.gripVariant ? ` — ${slot.gripVariant}` : ''}
            </h3>
            <p className="prescription">
              {slot.sets} sets × {slot.reps}
            </p>
            <p className="form-cue">{slot.notes}</p>
            {slot.intensifiers?.quarterRepsSets && (
              <p className="intensifier-flag">
                M2: add 1¼ reps on sets {slot.intensifiers.quarterRepsSets.join(', ')}.
              </p>
            )}
            {slot.intensifiers?.restPauseLastSet && (
              <p className="intensifier-flag">M2: mini rest-pause on the last set.</p>
            )}
            {slot.restCutGuidance && <p className="rest-cut-guidance">{slot.restCutGuidance}</p>}
            {suggestions[slot.exercise.id] && (
              <p className="progression-hint">{suggestions[slot.exercise.id]}</p>
            )}

            <ol className="set-list">
              {(() => {
                const setIds = Array.from(
                  { length: slot.sets },
                  (_, i) => `main-${slot.slotIndex}-set-${i}`,
                );
                const firstUncheckedIdx = setIds.findIndex(
                  (id) => !progress.checkedSteps.includes(id),
                );
                const bodyweight = slot.exercise.bodyweight === true;
                return setIds.map((id, setIdx) => {
                  const checked = progress.checkedSteps.includes(id);
                  const isCurrent = !checked && setIdx === firstUncheckedIdx;
                  const inputs = progress.setInputs[id] ?? {};
                  const rowClass = [
                    'set-row',
                    isCurrent && 'set-row--current',
                    checked && 'set-row--done',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <li key={id} className={rowClass}>
                      <div className="set-row-top">
                        <span className="set-number">Set {setIdx + 1}</span>
                        {isCurrent && <span className="set-current-badge">· up now</span>}
                        {checked && !isCurrent && <span className="set-done-badge">Logged</span>}
                        {isCurrent && <span className="set-count">of {slot.sets}</span>}
                      </div>
                      <div className="set-fields">
                        <label className="set-field">
                          <span className="set-field-label">
                            {bodyweight ? 'Added weight (lb, optional)' : 'Weight (lb)'}
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={MAX_WEIGHT_LB}
                            step={0.5}
                            aria-label={`Weight for set ${setIdx + 1}`}
                            placeholder={bodyweight ? 'optional' : 'lb'}
                            value={inputs.weight ?? ''}
                            onChange={(e) => updateSetInput(id, 'weight', e.target.value)}
                          />
                        </label>
                        <label className="set-field">
                          <span className="set-field-label">Reps</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={MAX_REPS}
                            step={1}
                            aria-label={`Reps for set ${setIdx + 1}`}
                            placeholder="reps"
                            value={inputs.reps ?? ''}
                            onChange={(e) => updateSetInput(id, 'reps', e.target.value)}
                          />
                        </label>
                        <label className={`set-check${checked ? ' set-check--done' : ''}`}>
                          <input
                            type="checkbox"
                            aria-label={`Mark set ${setIdx + 1} done`}
                            checked={checked}
                            disabled={!checked && !canLogSet(bodyweight, inputs)}
                            onChange={() => void toggleMainSet(slot, setIdx)}
                          />
                          <span className="set-check-label" aria-hidden="true">
                            {isCurrent ? 'Log set ✓' : checked ? '✓' : 'Done'}
                          </span>
                        </label>
                      </div>
                    </li>
                  );
                });
              })()}
            </ol>
          </article>
        ))}
      </section>

      <section aria-labelledby="cooldown-heading">
        <h2 id="cooldown-heading">Cool-down</h2>
        <ul className="checklist">
          {session.cooldown.map((step, i) => {
            const id = `cooldown-${i}`;
            return (
              <li key={id}>
                <label>
                  <input
                    type="checkbox"
                    checked={progress.checkedSteps.includes(id)}
                    onChange={() => void toggleSimpleStep(id)}
                  />
                  <div className="step-text">
                    <span className="step-component">{step.component}</span>{' '}
                    <span className="step-dosage">({step.dosage})</span>
                    <p className="step-what">{step.what}</p>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <button
        type="button"
        className="complete-session"
        disabled={isCompleting}
        onClick={() => void handleCompleteClick()}
      >
        {isCompleting ? 'Completing…' : 'Complete session'}
      </button>

      <dialog
        ref={restartDialogRef}
        className="restart-confirm"
        role="alertdialog"
        aria-labelledby="restart-confirm-heading"
        aria-describedby="restart-confirm-note"
        onCancel={(e) => {
          // Escape key fires the native `cancel` event before `close` —
          // intercept it so state (and thus dialog.close()) stays in sync.
          e.preventDefault();
          setShowRestartConfirm(false);
        }}
        onClose={() => setShowRestartConfirm(false)}
      >
        <p id="restart-confirm-heading">You've completed the 12-week program! Restart from Week 1?</p>
        <p id="restart-confirm-note" className="restart-note">
          Your logged history is kept — only the current week/day resets.
        </p>
        <div className="restart-confirm-actions">
          <button
            type="button"
            className="danger"
            disabled={isCompleting}
            onClick={() => void doComplete()}
          >
            {isCompleting ? 'Restarting…' : 'Restart from Week 1'}
          </button>
          <button type="button" disabled={isCompleting} onClick={() => setShowRestartConfirm(false)}>
            Not yet
          </button>
        </div>
      </dialog>
    </div>
  );
}
