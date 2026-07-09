import { useCallback, useEffect, useState } from 'react';
import { getProgramState, type ProgramState } from '../storage/db';

/**
 * Loads program state on mount (initializing the R14 default on first run,
 * since getProgramState() does that itself) and exposes a setter so screens
 * can push a freshly-mutated state (from completeSession/skipDay/
 * switchVariant/setWeekDay, all of which already return the new state)
 * without a second round-trip read.
 */
export function useProgramState() {
  const [programState, setProgramState] = useState<ProgramState | null>(null);

  const refresh = useCallback(async () => {
    const state = await getProgramState();
    setProgramState(state);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { programState, setProgramState, refresh };
}
