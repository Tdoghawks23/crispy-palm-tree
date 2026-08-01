import { useEffect, useRef, useState, type FormEvent } from 'react';
import { TRAINING_DAYS, TOTAL_WEEKS, type Variant } from '../../data/program';
import {
  isStoragePersisted,
  repeatDay,
  requestPersistentStorage,
  setWeekDay,
  skipDay,
  switchVariant,
  type ProgramState,
} from '../../storage/db';

interface Props {
  programState: ProgramState;
  onProgramStateChange: (next: ProgramState) => void;
}

export function OverviewScreen({ programState, onProgramStateChange }: Props) {
  const [week, setWeek] = useState(programState.week);
  const [day, setDay] = useState(programState.day);

  // Same in-flight guard pattern as SessionScreen's "Complete session" fix
  // (QA blocker): a ref, checked/set synchronously, so a double-tap on
  // Skip/Repeat day is a no-op instead of a second real state transition.
  const actionInFlightRef = useRef(false);
  const [actionInFlight, setActionInFlight] = useState(false);

  // Storage durability status: with no export/backup by design (PRD §10),
  // a denied persist() grant is the one silent way to lose all history —
  // so re-request on mount (idempotent) and show the result instead of
  // hiding it. null = still checking.
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void requestPersistentStorage()
      .then(() => isStoragePersisted())
      .then((persisted) => {
        if (!cancelled) setStoragePersisted(persisted);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function handleSkipDay() {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setActionInFlight(true);
    try {
      const updated = await skipDay({
        variant: programState.variant,
        week: programState.week,
        day: programState.day,
      });
      onProgramStateChange(updated);
      setWeek(updated.week);
      setDay(updated.day);
    } finally {
      actionInFlightRef.current = false;
      setActionInFlight(false);
    }
  }

  async function handleRepeatDay() {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setActionInFlight(true);
    try {
      const updated = await repeatDay();
      onProgramStateChange(updated);
      setWeek(updated.week);
      setDay(updated.day);
    } finally {
      actionInFlightRef.current = false;
      setActionInFlight(false);
    }
  }

  const days = TRAINING_DAYS[programState.variant];

  return (
    <div className="screen overview-screen">
      <header>
        <h1>Program</h1>
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

      <section aria-labelledby="day-actions-heading">
        <h2 id="day-actions-heading">Day actions</h2>
        <p className="current-state">
          Current day: Week {programState.week}, {programState.day} ({programState.variant})
        </p>
        <div className="day-actions">
          <button type="button" disabled={actionInFlight} onClick={() => void handleSkipDay()}>
            {actionInFlight ? 'Working…' : 'Skip day'}
          </button>
          <button type="button" disabled={actionInFlight} onClick={() => void handleRepeatDay()}>
            {actionInFlight ? 'Working…' : 'Repeat day'}
          </button>
        </div>
      </section>

      <section aria-labelledby="storage-heading">
        <h2 id="storage-heading">Data</h2>
        <p className="current-state storage-status">
          {storagePersisted === null && 'Storage: checking…'}
          {storagePersisted === true && 'Storage: protected — the browser won’t auto-delete your logs.'}
          {storagePersisted === false &&
            'Storage: best-effort — the browser may clear logs if space runs low. Installing to your home screen protects them.'}
        </p>
      </section>
    </div>
  );
}
