import React, { memo, useEffect } from 'react';
import { PostMatchSummary } from './PostMatchSummary';
import { PerformanceBenchmark } from './PerformanceBenchmark';
import { CoachingTips } from './CoachingTips';
import { LegendComparison } from './LegendComparison';
import { useMatchStore } from '../../stores/match-store';
import { useSessionStore } from '../../stores/session-store';
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
        mode: payload.mode ?? null,
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

    // Listen for session stats updates so PerformanceBenchmark and
    // LegendComparison have real session averages to compare against.
    // Without this, the session store stays at zero in the post-match window
    // because it is a separate BrowserWindow with its own store instance.
    const unsubSession = window.apexCoach.on(IPC.SESSION_UPDATE, (data) => {
      useSessionStore.getState().updateFromIpc(data as Record<string, unknown>);
    });

    // Reset match store when a new match starts (clears stale post-match data)
    const unsubStart = window.apexCoach.on(IPC.MATCH_START, () => {
      useMatchStore.getState().resetMatch();
    });

    return () => {
      unsubEnd();
      unsubUpdate();
      unsubInsight();
      unsubSession();
      unsubStart();
    };
  }, []);

  return (
    <div className="overlay-panel-opaque w-[620px] max-h-[720px] overflow-y-auto flex flex-col">
      {/* Draggable header with gradient accent */}
      <div className="draggable-region flex items-center justify-between p-4 pb-3 border-b border-overlay-border bg-gradient-to-r from-apex-purple/10 to-transparent">
        <span className="text-overlay-lg font-bold text-white/90 tracking-wide">POST-MATCH ANALYSIS</span>
        <button
          className="no-drag text-overlay-xs text-white/30 hover:text-white/60 hover:bg-white/5 px-2 py-1 rounded transition-all"
          onClick={() => window.apexCoach.invoke(IPC.WINDOW_HIDE)}
        >
          DISMISS
        </button>
      </div>

      {/* Content with consistent padding and spacing */}
      <div className="p-4 flex flex-col gap-4">
        <PostMatchSummary />
        <PerformanceBenchmark />
        <CoachingTips />
        <LegendComparison />
      </div>
    </div>
  );
}

export const PostMatch = memo(PostMatchInner);
