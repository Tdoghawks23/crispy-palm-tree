import { useEffect, useState } from 'react';
import { getAllSetLogs, type ProgramState, type SetLogEntry } from '../../storage/db';
import { groupLogsByDay, localDateKey } from '../../storage/sessionHistory';
import { EXERCISES } from '../../data/exercises';
import { TRAINING_DAYS, TOTAL_WEEKS } from '../../data/program';
import { SparklineChart } from '../components/SparklineChart';

interface Props {
  programState: ProgramState;
}

function exerciseName(id: string): string {
  return EXERCISES.find((e) => e.id === id)?.name ?? id;
}

function groupByExercise(logs: SetLogEntry[]): Map<string, SetLogEntry[]> {
  const byExercise = new Map<string, SetLogEntry[]>();
  for (const log of logs) {
    const bucket = byExercise.get(log.exerciseId);
    if (bucket) bucket.push(log);
    else byExercise.set(log.exerciseId, [log]);
  }
  return byExercise;
}

/** Improvement from first to last session as an "▲ N%" pill string, or null when there's no gain (or too little data) to show. */
function pctDelta(vals: number[]): string | null {
  if (vals.length < 2) return null;
  const first = vals[0];
  const last = vals[vals.length - 1];
  if (first === 0) return null;
  const d = Math.round(((last - first) / first) * 100);
  return d >= 0 ? `▲ ${d}%` : null;
}

/** Most recent value as a display label (thousands-separated for volume), or an em dash when empty. */
function lastLabel(vals: number[], thousands = false): string {
  if (vals.length === 0) return '—';
  const v = vals[vals.length - 1];
  return thousands ? v.toLocaleString() : String(v);
}

export function ProgressScreen({ programState }: Props) {
  const [logs, setLogs] = useState<SetLogEntry[] | null>(null);

  useEffect(() => {
    void getAllSetLogs().then(setLogs);
  }, []);

  if (!logs) {
    return <p>Loading progress…</p>;
  }

  const byExercise = groupByExercise(logs);
  const totalTrainingDays = TRAINING_DAYS[programState.variant].length * TOTAL_WEEKS;
  const distinctLoggedDays = new Set(logs.map((l) => localDateKey(l.timestamp))).size;
  const weeksCompleted = Math.max(0, programState.week - 1);
  const progPct = Math.round((weeksCompleted / TOTAL_WEEKS) * 100);

  return (
    <div className="screen progress-screen">
      <header>
        <h1>Progress</h1>
      </header>

      <div className="completion-card">
        <div className="completion-head">
          <span className="caps">Program completion</span>
          <span className="completion-pct">{progPct}%</span>
        </div>
        <div className="completion-week">
          Week {programState.week} <span className="of">of {TOTAL_WEEKS}</span>
        </div>
        <div
          className="week-ticks"
          role="img"
          aria-label={`${weeksCompleted} of ${TOTAL_WEEKS} weeks completed`}
        >
          {Array.from({ length: TOTAL_WEEKS }, (_, i) => (
            <span key={i} className={`week-tick${i < weeksCompleted ? ' week-tick--on' : ''}`} />
          ))}
        </div>
        <p className="completion-caption">
          {distinctLoggedDays} training days logged · a full {programState.variant} cycle is{' '}
          {totalTrainingDays} days
        </p>
      </div>

      <section aria-labelledby="exercises-heading">
        <h2 id="exercises-heading">Per-exercise trends</h2>
        {byExercise.size === 0 && (
          <p className="no-data">No sets logged yet — complete a session to start tracking.</p>
        )}
        {[...byExercise.entries()].map(([exerciseId, exerciseLogs]) => {
          const groups = groupLogsByDay(exerciseLogs);
          const topWeightPerDay = groups.map((g) => Math.max(...g.sets.map((s) => s.weight)));
          const volumePerDay = groups.map((g) =>
            g.sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
          );
          const name = exerciseName(exerciseId);
          const topDelta = pctDelta(topWeightPerDay);
          const volDelta = pctDelta(volumePerDay);
          return (
            <article className="exercise-trend" key={exerciseId}>
              <h3>{name}</h3>
              <div className="trend-stat">
                <div>
                  <div className="trend-label">Top load / session</div>
                  <div className="trend-value">{lastLabel(topWeightPerDay)}</div>
                </div>
                {topDelta && <span className="delta-pill">{topDelta}</span>}
              </div>
              <SparklineChart values={topWeightPerDay} label={`${name} weight trend`} />
              <div className="trend-stat">
                <div>
                  <div className="trend-label">Volume / session</div>
                  <div className="trend-value">{lastLabel(volumePerDay, true)}</div>
                </div>
                {volDelta && <span className="delta-pill">{volDelta}</span>}
              </div>
              <SparklineChart values={volumePerDay} label={`${name} volume trend`} />
            </article>
          );
        })}
      </section>
    </div>
  );
}
