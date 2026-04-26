import React, { memo } from 'react';
import { StatCard } from '../../components/StatCard';
import { InsightCard } from '../../components/InsightCard';
import { useMatchStore } from '../../stores/match-store';
import { useSessionStore } from '../../stores/session-store';
import { formatCompact } from '../../../shared/utils';

/**
 * Post-match summary showing:
 * - Placement, kills, deaths, assists, damage, legend
 * - Coaching insights if available
 * - Comparison to personal averages
 */
export const PostMatchSummary = memo(function PostMatchSummary() {
  const placement = useMatchStore((s) => s.placement);
  const kills = useMatchStore((s) => s.kills);
  const deaths = useMatchStore((s) => s.deaths);
  const assists = useMatchStore((s) => s.assists);
  const damage = useMatchStore((s) => s.damage);
  const legend = useMatchStore((s) => s.legend);
  const map = useMatchStore((s) => s.map);
  const coachingInsights = useMatchStore((s) => s.coachingInsights);

  const avgKills = useSessionStore((s) => s.avgKills);
  const avgDamage = useSessionStore((s) => s.avgDamage);
  const matchesPlayed = useSessionStore((s) => s.matchesPlayed);

  return (
    <div className="flex flex-col gap-3">
      {/* Header with placement and legend */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {placement !== null && (
            <span className="text-2xl font-bold text-white">#{placement}</span>
          )}
          <span className="text-overlay-sm text-white/60">{legend}</span>
        </div>
        {map && <span className="text-overlay-xs text-white/40">{map}</span>}
      </div>

      {/* Core stats grid */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Kills" value={kills} previousValue={avgKills} />
        <StatCard label="Deaths" value={deaths} />
        <StatCard label="Assists" value={assists} />
        <StatCard label="Damage" value={damage} previousValue={avgDamage} />
      </div>

      {/* vs averages comparison */}
      {matchesPlayed > 0 && (
        <div className="text-overlay-xs text-white/50">
          <span>vs avg: {formatCompact(avgKills)} kills, {formatCompact(avgDamage)} dmg</span>
        </div>
      )}

      {/* Coaching insights */}
      {coachingInsights.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {coachingInsights.map((insight) => (
            <InsightCard
              key={insight.id}
              message={insight.message}
              severity={insight.severity as 'info' | 'warning' | 'suggestion' | 'achievement'}
            />
          ))}
        </div>
      )}
    </div>
  );
});
