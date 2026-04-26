import React, { memo } from 'react';
import { StatCard } from '../../components/StatCard';
import { useSessionStore } from '../../stores/session-store';
import { useMatchHistory } from '../../hooks/useMatchHistory';
import { formatCompact } from '../../../shared/utils';

interface MatchHistoryItem {
  id: number;
  legend: string;
  kills: number;
  deaths?: number;
  damage: number;
  placement?: number | null;
  map?: string | null;
  startedAt?: string;
}

interface LegendBreakdown {
  legend: string;
  games: number;
  totalKills: number;
  totalDamage: number;
}

/**
 * Session dashboard view showing:
 * - Session stats summary
 * - Match history list
 * - Legend breakdown
 * - Empty state when no matches yet
 */
export const SessionDashboardView = memo(function SessionDashboardView() {
  const matchesPlayed = useSessionStore((s) => s.matchesPlayed);
  const totalKills = useSessionStore((s) => s.totalKills);
  const totalDeaths = useSessionStore((s) => s.totalDeaths);
  const totalDamage = useSessionStore((s) => s.totalDamage);
  const totalAssists = useSessionStore((s) => s.totalAssists);
  const kd = useSessionStore((s) => s.kd);

  const { matches, loading } = useMatchHistory();

  // Empty state: show when no matches played and data finished loading
  if (matchesPlayed === 0 && !loading && matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8">
        <span className="text-overlay-lg text-white/40">No matches yet</span>
        <span className="text-overlay-sm text-white/30">
          Play a match to see your session stats here.
        </span>
      </div>
    );
  }

  // Loading state
  if (loading && matchesPlayed === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8">
        <span className="text-overlay-sm text-white/30">Loading...</span>
      </div>
    );
  }

  // Compute legend breakdown from match history
  const legendMap = new Map<string, LegendBreakdown>();
  (matches as MatchHistoryItem[]).forEach((m) => {
    const existing = legendMap.get(m.legend);
    if (existing) {
      existing.games += 1;
      existing.totalKills += m.kills;
      existing.totalDamage += m.damage;
    } else {
      legendMap.set(m.legend, {
        legend: m.legend,
        games: 1,
        totalKills: m.kills,
        totalDamage: m.damage,
      });
    }
  });
  const legends = Array.from(legendMap.values()).sort((a, b) => b.games - a.games);

  return (
    <div className="flex flex-col gap-4">
      {/* Session stats summary */}
      <div>
        <h3 className="overlay-header">Session Summary</h3>
        <div className="grid grid-cols-4 gap-2">
          <StatCard label="Matches" value={matchesPlayed} />
          <StatCard label="Kills" value={totalKills} />
          <StatCard label="Deaths" value={totalDeaths} />
          <StatCard label="Damage" value={totalDamage} />
          <StatCard label="Assists" value={totalAssists} />
          <StatCard label="K/D" value={kd} />
        </div>
      </div>

      {/* Match history list */}
      {(matches as MatchHistoryItem[]).length > 0 && (
        <div>
          <h3 className="overlay-header">Match History</h3>
          <div className="flex flex-col gap-1">
            {(matches as MatchHistoryItem[]).map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between px-2 py-1 bg-white/5 rounded"
              >
                <span className="text-overlay-sm text-white/80">{m.legend}</span>
                <div className="flex gap-3 text-overlay-xs text-white/60">
                  {m.placement && <span>#{m.placement}</span>}
                  <span>{m.kills}K</span>
                  <span>{formatCompact(m.damage)}D</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend breakdown */}
      {legends.length > 0 && (
        <div>
          <h3 className="overlay-header">Legend Breakdown</h3>
          <div className="flex flex-col gap-1">
            {legends.map((l) => (
              <div
                key={l.legend}
                className="flex items-center justify-between px-2 py-1 bg-white/5 rounded"
              >
                <span className="text-overlay-sm text-white/80">{l.legend}</span>
                <div className="flex gap-3 text-overlay-xs text-white/60">
                  <span>{l.games} games</span>
                  <span>{l.totalKills} kills</span>
                  <span>{formatCompact(l.totalDamage)} dmg</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
