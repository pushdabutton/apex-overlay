import { useEffect, useState } from 'react';
import type { CoachingInsight } from '../../shared/types';
import { IPC } from '../../shared/ipc-channels';

/**
 * Hook to access coaching insights, auto-updates from IPC.
 */
export function useCoachingInsights() {
  const [latestInsight, setLatestInsight] = useState<CoachingInsight | null>(null);
  const [matchInsights, setMatchInsights] = useState<CoachingInsight[]>([]);

  useEffect(() => {
    const unsub = window.apexCoach.on(IPC.COACHING_INSIGHT, (data) => {
      const insight = data as CoachingInsight;
      setLatestInsight(insight);
      setMatchInsights((prev) => [insight, ...prev]);

      // Auto-dismiss latest insight after 5 seconds
      setTimeout(() => {
        setLatestInsight((current) => (current?.id === insight.id ? null : current));
      }, 5000);
    });

    // Clear match insights on new match
    const unsubMatch = window.apexCoach.on(IPC.MATCH_START, () => {
      setMatchInsights([]);
      setLatestInsight(null);
    });

    return () => {
      unsub();
      unsubMatch();
    };
  }, []);

  return { latestInsight, matchInsights };
}
