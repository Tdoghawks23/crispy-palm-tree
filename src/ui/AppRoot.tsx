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
          <svg
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6.5 6.5v11M17.5 6.5v11M6.5 12h11M3.5 9v6M20.5 9v6" />
          </svg>
          Session
        </button>
        <button
          type="button"
          className={tab === 'progress' ? 'active' : ''}
          onClick={() => setTab('progress')}
        >
          <svg
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 19V5M4 15l4.5-4.5 3.5 3L20 6" />
          </svg>
          Progress
        </button>
        <button
          type="button"
          className={tab === 'overview' ? 'active' : ''}
          onClick={() => setTab('overview')}
        >
          <svg
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
            <path d="M3.5 9h17M8 3v3M16 3v3" />
          </svg>
          Overview
        </button>
      </nav>
    </div>
  );
}
