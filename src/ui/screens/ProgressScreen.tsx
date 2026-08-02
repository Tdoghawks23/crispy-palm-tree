import { useEffect, useState } from 'react';
import { getAllSetLogs, type ProgramState, type SetLogEntry } from '../../storage/db';
import { localDateKey } from '../../storage/sessionHistory';
import { computePatternTrends, seriesDelta, type SeriesPoint } from '../../storage/trends';
import { PATTERN_LABELS } from '../../data/exercises';
import { TRAINING_DAYS, TOTAL_WEEKS } from '../../data/program';
import { SparklineChart } from '../components/SparklineChart';

interface Props {
  programState: ProgramState;
}

function DeltaPill({ points }: { points: SeriesPoint[] }) {
  const delta = seriesDelta(points);
  if (!delta) return null;
  return (
    <span className={`delta-pill${delta.direction === 'down' ? ' delta-pill--down' : ''}`}>
      {delta.direction === 'up' ? '▲' : '▼'} {delta.pct}%
    </span>
  );
}

/** One metric row (label + latest value + delta pill) with its sparkline. */
function TrendSeries({ label, points, chartLabel }: { label: string; points: SeriesPoint[]; chartLabel: string }) {
  const values = points.map((p) => p.value);
  return (
    <>
      <div className="trend-stat">
        <div>
          <div className="trend-label">{label}</div>
          <div className="trend-value">{values[values.length - 1].toLocaleString()}</div>
        </div>
        <DeltaPill points={points} />
      </div>
      <SparklineChart values={values} label={chartLabel} />
    </>
  );
}

export function ProgressScreen({ programState }: Props) {
  const [logs, setLogs] = useState<SetLogEntry[] | null>(null);

  useEffect(() => {
    void getAllSetLogs().then(setLogs);
  }, []);

  if (!logs) {
    return <p>Loading progress…</p>;
  }

  // Trends aggregate by movement pattern, not individual exercise —
  // rotation swaps alternates per session, so per-exercise series only
  // gain a point every 2-3 weeks (see storage/trends.ts).
  const trends = computePatternTrends(logs);
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

      <section aria-labelledby="patterns-heading">
        <h2 id="patterns-heading">Movement trends</h2>
        {trends.length === 0 && (
          <p className="no-data">No sets logged yet — complete a session to start tracking.</p>
        )}
        {trends.map((trend) => {
          const label = PATTERN_LABELS[trend.pattern];
          return (
            <article className="exercise-trend" key={trend.pattern}>
              <h3>{label}</h3>
              {trend.loadVolume.length > 0 && (
                <TrendSeries
                  label="Load volume / session"
                  points={trend.loadVolume}
                  chartLabel={`${label} load volume trend`}
                />
              )}
              {trend.bwReps.length > 0 && (
                <TrendSeries
                  label="Bodyweight reps / session"
                  points={trend.bwReps}
                  chartLabel={`${label} bodyweight reps trend`}
                />
              )}
              <ul className="pattern-exercises">
                {trend.exercises.map((ex) => (
                  <li key={ex.exerciseId}>
                    <span className="pattern-exercise-name">{ex.name}</span>
                    <span className="pattern-exercise-meta">
                      {ex.sessions}×{' · last: '}
                      {ex.lastTopWeight !== null && `${ex.lastTopWeight} lb top, `}
                      {ex.lastTotalReps} reps
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>
    </div>
  );
}
