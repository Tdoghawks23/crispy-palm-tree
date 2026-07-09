import { useState } from 'react';
import { useProgramState } from './useProgramState';
import { SessionScreen } from './screens/SessionScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { OverviewScreen } from './screens/OverviewScreen';
import './app.css';

type Tab = 'session' | 'progress' | 'overview';

/**
 * Root shell: loads program state (R14 default on first run), renders the
 * active screen with zero taps into today's session (R15), and provides a
 * simple bottom tab bar to reach Progress (R18) and Overview (R19).
 */
export function AppRoot() {
  const { programState, setProgramState } = useProgramState();
  const [tab, setTab] = useState<Tab>('session');

  if (!programState) {
    return <p className="loading">Loading…</p>;
  }

  return (
    <div className="app-root">
      <main>
        {tab === 'session' && (
          <SessionScreen programState={programState} onProgramStateChange={setProgramState} />
        )}
        {tab === 'progress' && <ProgressScreen programState={programState} />}
        {tab === 'overview' && (
          <OverviewScreen programState={programState} onProgramStateChange={setProgramState} />
        )}
      </main>
      <nav className="tab-bar" aria-label="Main navigation">
        <button
          type="button"
          className={tab === 'session' ? 'active' : ''}
          onClick={() => setTab('session')}
        >
          Session
        </button>
        <button
          type="button"
          className={tab === 'progress' ? 'active' : ''}
          onClick={() => setTab('progress')}
        >
          Progress
        </button>
        <button
          type="button"
          className={tab === 'overview' ? 'active' : ''}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>
      </nav>
    </div>
  );
}
