import { useEffect, useMemo, useState } from 'react';
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
                  <span className="step-component">{step.component}</span>{' '}
                  <span className="step-dosage">({step.dosage})</span>
                  <p className="step-what">{step.what}</p>
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
              {Array.from({ length: slot.sets }, (_, setIdx) => {
                const id = `main-${slot.slotIndex}-set-${setIdx}`;
                const checked = progress.checkedSteps.includes(id);
                const inputs = progress.setInputs[id] ?? {};
                return (
                  <li key={id} className="set-row">
                    <span className="set-number">Set {setIdx + 1}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      aria-label={`Weight for set ${setIdx + 1}`}
                      placeholder="lb"
                      value={inputs.weight ?? ''}
                      onChange={(e) => updateSetInput(id, 'weight', e.target.value)}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      aria-label={`Reps for set ${setIdx + 1}`}
                      placeholder="reps"
                      value={inputs.reps ?? ''}
                      onChange={(e) => updateSetInput(id, 'reps', e.target.value)}
                    />
                    <label className="set-check">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && (inputs.weight === undefined || inputs.reps === undefined)}
                        onChange={() => void toggleMainSet(slot, setIdx)}
                      />
                      Done
                    </label>
                  </li>
                );
              })}
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
                  <span className="step-component">{step.component}</span>{' '}
                  <span className="step-dosage">({step.dosage})</span>
                  <p className="step-what">{step.what}</p>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <button type="button" className="complete-session" onClick={() => void handleCompleteClick()}>
        Complete session
      </button>

      {showRestartConfirm && (
        <div className="restart-confirm" role="dialog" aria-label="Program complete">
          <p>You've completed the 12-week program! Restart from Week 1?</p>
          <p className="restart-note">Your logged history is kept — only the current week/day resets.</p>
          <button type="button" onClick={() => void doComplete()}>
            Restart from Week 1
          </button>
          <button type="button" onClick={() => setShowRestartConfirm(false)}>
            Not yet
          </button>
        </div>
      )}
    </div>
  );
}
