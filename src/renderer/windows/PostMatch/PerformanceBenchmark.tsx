import React, { memo } from 'react';
import { TrendIndicator } from '../../components/TrendIndicator';
import { useMatchStore } from '../../stores/match-store';
import { useSessionStore } from '../../stores/session-store';
import { formatCompact, kdRatio } from '../../../shared/utils';

/**
 * Performance benchmark comparing this match's stats to session averages.
 * Only visible when there are at least 1 previous match to compare against.
 */
export const PerformanceBenchmark = memo(function PerformanceBenchmark() {
  const kills = useMatchStore((s) => s.kills);
  const deaths = useMatchStore((s) => s.deaths);
  const damage = useMatchStore((s) => s.damage);
  const assists = useMatchStore((s) => s.assists);

  const avgKills = useSessionStore((s) => s.avgKills);
  const avgDamage = useSessionStore((s) => s.avgDamage);
  const matchesPlayed = useSessionStore((s) => s.matchesPlayed);
  const sessionKd = useSessionStore((s) => s.kd);

  const thisMatchKd = kdRatio(kills, deaths);

  // Only show comparison when there are prior matches to compare against
  if (matchesPlayed === 0) {
    return (
      <div>
        <h3 className="overlay-header">vs Your Averages</h3>
        <div className="overlay-card p-3 text-center">
          <span className="text-overlay-xs text-white/40">
            Play more matches to see comparisons
          </span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="overlay-header">vs Your Averages</h3>
      <div className="grid grid-cols-4 gap-2">
        <div className="overlay-card text-center p-2">
          <div className="overlay-label">Kills</div>
          <div className="overlay-value">{kills}</div>
          <TrendIndicator current={kills} previous={avgKills} />
          <div className="text-overlay-xs text-white/30 mt-1">avg {avgKills.toFixed(1)}</div>
        </div>
        <div className="overlay-card text-center p-2">
          <div className="overlay-label">Damage</div>
          <div className="overlay-value">{formatCompact(damage)}</div>
          <TrendIndicator current={damage} previous={avgDamage} />
          <div className="text-overlay-xs text-white/30 mt-1">avg {formatCompact(Math.round(avgDamage))}</div>
        </div>
        <div className="overlay-card text-center p-2">
          <div className="overlay-label">K/D</div>
          <div className="overlay-value">{thisMatchKd}</div>
          <div className="text-overlay-xs text-white/30 mt-1">session {sessionKd}</div>
        </div>
        <div className="overlay-card text-center p-2">
          <div className="overlay-label">Assists</div>
          <div className="overlay-value">{assists}</div>
          <div className="text-overlay-xs text-white/30 mt-1">{matchesPlayed} games</div>
        </div>
      </div>
    </div>
  );
});
