import React, { memo } from 'react';
import { StatCard } from '../../components/StatCard';
import { InsightList } from '../../components/InsightList';
import { LegendIcon } from '../../components/LegendIcon';
import { useMatchStore } from '../../stores/match-store';
import { useSessionStore } from '../../stores/session-store';
import { formatCompact } from '../../../shared/utils';

/**
 * Post-match summary showing:
 * - Prominent legend name with icon, placement badge
 * - Color-coded stat cards (green/red border vs averages)
 * - Coaching insights (max 3, sorted by severity, with icons)
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
  const mode = useMatchStore((s) => s.mode);
  const coachingInsights = useMatchStore((s) => s.coachingInsights);

  const avgKills = useSessionStore((s) => s.avgKills);
  const avgDamage = useSessionStore((s) => s.avgDamage);
  const matchesPlayed = useSessionStore((s) => s.matchesPlayed);

  // Determine placement badge color
  const placementColor = placement !== null
    ? placement === 1 ? 'text-apex-gold' : placement <= 3 ? 'text-apex-orange' : 'text-white'
    : 'text-white';

  return (
    <div className="flex flex-col gap-3">
      {/* Header with prominent legend display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LegendIcon legend={legend} size="lg" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              {placement !== null && (
                <span className={`text-2xl font-bold ${placementColor}`}>#{placement}</span>
              )}
              <span className="text-overlay-lg font-bold text-white">{legend}</span>
            </div>
            <div className="flex items-center gap-2">
              {mode && mode !== 'unknown' && (
                <span className="text-overlay-xs text-white/40 uppercase">{mode.replace(/_/g, ' ')}</span>
              )}
              {map && <span className="text-overlay-xs text-white/40">{map}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Core stats grid with color-coded borders.
          Kills and Damage are highlighted as primary stats. */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Kills" value={kills} previousValue={avgKills} highlight />
        <StatCard label="Deaths" value={deaths} />
        <StatCard label="Assists" value={assists} />
        <StatCard label="Damage" value={damage} previousValue={avgDamage} highlight />
      </div>

      {/* vs averages comparison */}
      {matchesPlayed > 0 && (
        <div className="text-overlay-xs text-white/50">
          <span>vs avg: {formatCompact(avgKills)} kills, {formatCompact(avgDamage)} dmg ({matchesPlayed} games)</span>
        </div>
      )}

      {/* Coaching insights -- max 3, severity-sorted, with icons */}
      {coachingInsights.length > 0 && (
        <InsightList
          insights={coachingInsights.map((insight) => ({
            id: insight.id,
            message: insight.message,
            severity: insight.severity as 'info' | 'warning' | 'suggestion' | 'achievement',
            type: insight.type,
            ruleId: insight.ruleId,
          }))}
          maxVisible={3}
        />
      )}
    </div>
  );
});
