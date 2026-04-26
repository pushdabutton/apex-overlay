import { useEffect, useState, useCallback } from 'react';
import type { Match } from '../../shared/types';
import { IPC } from '../../shared/ipc-channels';

/**
 * Hook to fetch recent match history via IPC.
 * Automatically refreshes when a match ends.
 */
export function useMatchHistory() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await window.apexCoach.invoke(IPC.MATCH_HISTORY);
      setMatches(data as Match[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Auto-refresh when a match ends
    const unsub = window.apexCoach.on(IPC.MATCH_END, () => {
      refresh();
    });

    return unsub;
  }, [refresh]);

  return { matches, loading, refresh };
}
