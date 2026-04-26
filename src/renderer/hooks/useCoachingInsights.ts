import { useEffect, useRef, useState } from 'react';
import type { CoachingInsight } from '../../shared/types';
import { IPC } from '../../shared/ipc-channels';

/**
 * Hook to access coaching insights, auto-updates from IPC.
 */
export function useCoachingInsights() {
  const [latestInsight, setLatestInsight] = useState<CoachingInsight | null>(null);
  const [matchInsights, setMatchInsights] = useState<CoachingInsight[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = window.apexCoach.on(IPC.COACHING_INSIGHT, (data) => {
      const insight = data as CoachingInsight;
      setLatestInsight(insight);
      setMatchInsights((prev) => [insight, ...prev]);

      // Clear any existing auto-dismiss timer
      if (timerRef.current) clearTimeout(timerRef.current);

      // Auto-dismiss latest insight after 5 seconds
      timerRef.current = setTimeout(() => {
        setLatestInsight((current) => (current?.id === insight.id ? null : current));
        timerRef.current = null;
      }, 5000);
    });

    // Clear match insights on new match
    const unsubMatch = window.apexCoach.on(IPC.MATCH_START, () => {
      setMatchInsights([]);
      setLatestInsight(null);
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      unsub();
      unsubMatch();
    };
  }, []);

  return { latestInsight, matchInsights };
}
