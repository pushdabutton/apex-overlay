import React, { memo, useEffect } from 'react';
import { PostMatchSummary } from './PostMatchSummary';
import { PerformanceBenchmark } from './PerformanceBenchmark';
import { CoachingTips } from './CoachingTips';
import { LegendComparison } from './LegendComparison';
import { useMatchStore } from '../../stores/match-store';
import { IPC } from '../../../shared/ipc-channels';
import type { CoachingInsight } from '../../../shared/types';

function PostMatchInner() {
  // Wire IPC listeners for match end data and coaching insights.
  // The post-match window is a separate BrowserWindow with its own store,
  // so it must independently listen for IPC broadcasts to populate data.
  useEffect(() => {
    const unsubEnd = window.apexCoach.on(IPC.MATCH_END, (data) => {
      console.log('[PostMatch] Received MATCH_END:', JSON.stringify(data));
      const payload = data as {
        matchId: number | null;
        sessionId: number | null;
        stats: { kills: number; deaths: number; assists: number; damage: number; headshots: number; knockdowns: number };
        legend?: string;
        map?: string | null;
        mode?: string;
        timestamp: number;
      };
      useMatchStore.getState().setMatchResult({
        placement: null,
        kills: payload.stats.kills,
        deaths: payload.stats.deaths,
        assists: payload.stats.assists,
        damage: payload.stats.damage,
        legend: payload.legend ?? 'Unknown',
        map: payload.map ?? null,
      });
    });

    // Also listen for MATCH_UPDATE so placement and legend get picked up
    const unsubUpdate = window.apexCoach.on(IPC.MATCH_UPDATE, (data) => {
      useMatchStore.getState().updateFromIpc(data as Record<string, unknown>);
    });

    // Listen for coaching insights generated after match end
    const unsubInsight = window.apexCoach.on(IPC.COACHING_INSIGHT, (data) => {
      console.log('[PostMatch] Received COACHING_INSIGHT:', JSON.stringify(data));
      useMatchStore.getState().addCoachingInsight(data as CoachingInsight);
    });

    // Reset match store when a new match starts (clears stale post-match data)
    const unsubStart = window.apexCoach.on(IPC.MATCH_START, () => {
      useMatchStore.getState().resetMatch();
    });

    return () => {
      unsubEnd();
      unsubUpdate();
      unsubInsight();
      unsubStart();
    };
  }, []);

  return (
    <div className="overlay-panel p-4 w-[600px] max-h-[700px] overflow-y-auto flex flex-col gap-3">
      {/* Draggable header */}
      <div className="draggable-region flex items-center justify-between pb-2 border-b border-overlay-border">
        <span className="text-overlay-lg font-bold text-white/90">POST-MATCH ANALYSIS</span>
        <button className="no-drag text-overlay-xs text-white/30 hover:text-white/60 transition-colors">
          DISMISS
        </button>
      </div>

      <PostMatchSummary />
      <PerformanceBenchmark />
      <CoachingTips />
      <LegendComparison />
    </div>
  );
}

export const PostMatch = memo(PostMatchInner);
