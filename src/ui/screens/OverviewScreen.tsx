import { useState, type FormEvent } from 'react';
import { TRAINING_DAYS, TOTAL_WEEKS, type Variant } from '../../data/program';
import { setWeekDay, switchVariant, type ProgramState } from '../../storage/db';

interface Props {
  programState: ProgramState;
  onProgramStateChange: (next: ProgramState) => void;
}

export function OverviewScreen({ programState, onProgramStateChange }: Props) {
  const [week, setWeek] = useState(programState.week);
  const [day, setDay] = useState(programState.day);

  async function handleVariantSwitch(next: Variant) {
    if (next === programState.variant) return;
    const updated = await switchVariant(next);
    onProgramStateChange(updated);
    setWeek(updated.week);
    setDay(updated.day);
  }

  async function handleJump(e: FormEvent) {
    e.preventDefault();
    const updated = await setWeekDay(week, day);
    onProgramStateChange(updated);
  }

  const days = TRAINING_DAYS[programState.variant];

  return (
    <div className="screen overview-screen">
      <header>
        <h1>Program overview</h1>
      </header>

      <section aria-labelledby="variant-heading">
        <h2 id="variant-heading">Variant</h2>
        <div className="variant-switcher" role="group" aria-label="Program variant">
          <button
            type="button"
            aria-pressed={programState.variant === '4-day'}
            className={programState.variant === '4-day' ? 'active' : ''}
            onClick={() => void handleVariantSwitch('4-day')}
          >
            4-day
          </button>
          <button
            type="button"
            aria-pressed={programState.variant === '3-day'}
            className={programState.variant === '3-day' ? 'active' : ''}
            onClick={() => void handleVariantSwitch('3-day')}
          >
            3-day
          </button>
        </div>
        <p className="current-state">
          Currently: {programState.variant}, Week {programState.week}, {programState.day}
        </p>
      </section>

      <section aria-labelledby="jump-heading">
        <h2 id="jump-heading">Manual week/day override</h2>
        <form onSubmit={(e) => void handleJump(e)}>
          <label>
            Week
            <select value={week} onChange={(e) => setWeek(Number(e.target.value))}>
              {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
          <label>
            Day
            <select value={day} onChange={(e) => setDay(e.target.value)}>
              {days.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Jump</button>
        </form>
      </section>
    </div>
  );
}
