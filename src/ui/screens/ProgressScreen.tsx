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

  return (
    <div className="screen progress-screen">
      <header>
        <h1>Progress</h1>
      </header>

      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading">Program completion</h2>
        <p>
          Week {programState.week} of {TOTAL_WEEKS} ({weeksCompleted} weeks completed)
        </p>
        <progress
          className="completion-bar"
          value={weeksCompleted}
          max={TOTAL_WEEKS}
          aria-label={`${weeksCompleted} of ${TOTAL_WEEKS} weeks completed`}
        />
        <p>
          {distinctLoggedDays} training days logged (all time) — a full {programState.variant} cycle is{' '}
          {totalTrainingDays} days
        </p>
      </section>

      <section aria-labelledby="exercises-heading">
        <h2 id="exercises-heading">Per-exercise trends</h2>
        {byExercise.size === 0 && <p>No sets logged yet — complete a session to start tracking.</p>}
        {[...byExercise.entries()].map(([exerciseId, exerciseLogs]) => {
          const groups = groupLogsByDay(exerciseLogs);
          const topWeightPerDay = groups.map((g) => Math.max(...g.sets.map((s) => s.weight)));
          const volumePerDay = groups.map((g) =>
            g.sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
          );
          const name = exerciseName(exerciseId);
          return (
            <article className="exercise-trend" key={exerciseId}>
              <h3>{name}</h3>
              <p className="trend-label">Top weight per session</p>
              <SparklineChart values={topWeightPerDay} label={`${name} weight trend`} />
              <p className="trend-label">Volume per session (weight × reps)</p>
              <SparklineChart values={volumePerDay} label={`${name} volume trend`} />
            </article>
          );
        })}
      </section>
    </div>
  );
}
