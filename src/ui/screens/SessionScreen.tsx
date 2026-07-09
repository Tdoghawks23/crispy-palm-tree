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
        const suggestion = suggestProgression({ repRangeMax, targetRIR, mostRecentSets });
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
    if (inputs.weight === undefined || inputs.reps === undefined) return;
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
      weight: inputs.weight,
      reps: inputs.reps,
      timestamp: Date.now(),
    });
  }

  function updateSetInput(id: string, field: 'weight' | 'reps', raw: string) {
    if (!progress) return;
    const value = raw === '' ? undefined : Number(raw);
    const nextInputs = {
      ...progress.setInputs,
      [id]: { ...progress.setInputs[id], [field]: value },
    };
    void persist({ ...progress, setInputs: nextInputs, updatedAt: Date.now() });
  }

  const isLastDayOfProgram =
    programState.week === 12 && isLastTrainingDayOfWeek(programState.variant, programState.day);

  async function doComplete() {
    const next = await completeSessionInStorage();
    setShowRestartConfirm(false);
    onProgramStateChange(next);
  }

  async function handleCompleteClick() {
    if (isLastDayOfProgram) {
      setShowRestartConfirm(true);
      return;
    }
    await doComplete();
  }

  return (
    <div className="screen session-screen">
      <header>
        <h1>
          {session.session} — Week {session.week}, {session.day}
        </h1>
        <p className="meso-label">{session.mesoLabel}</p>
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
                        {isCurrent && <span className="set-current-badge">Up now</span>}
                        {checked && !isCurrent && <span className="set-done-badge">Logged</span>}
                      </div>
                      <div className="set-fields">
                        <label className="set-field">
                          <span className="set-field-label">Weight (lb)</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            aria-label={`Weight for set ${setIdx + 1}`}
                            placeholder="lb"
                            value={inputs.weight ?? ''}
                            onChange={(e) => updateSetInput(id, 'weight', e.target.value)}
                          />
                        </label>
                        <label className="set-field">
                          <span className="set-field-label">Reps</span>
                          <input
                            type="number"
                            inputMode="numeric"
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
                            disabled={
                              !checked && (inputs.weight === undefined || inputs.reps === undefined)
                            }
                            onChange={() => void toggleMainSet(slot, setIdx)}
                          />
                          <span className="set-check-label" aria-hidden="true">
                            Done
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

      <button type="button" className="complete-session" onClick={() => void handleCompleteClick()}>
        Complete session
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
          <button type="button" className="danger" onClick={() => void doComplete()}>
            Restart from Week 1
          </button>
          <button type="button" onClick={() => setShowRestartConfirm(false)}>
            Not yet
          </button>
        </div>
      </dialog>
    </div>
  );
}
