import React, { memo, useMemo } from 'react';
import { ProgressBar } from '../../components/ProgressBar';
import { useMatchStore } from '../../stores/match-store';
import { getRankInfo, rankColorClass, formatCompact } from '../../../shared/utils';

function RankedProgressInner() {
  const rankName = useMatchStore((s) => s.rankName);
  const rankScore = useMatchStore((s) => s.rankScore);

  const rankInfo = useMemo(() => {
    if (!rankName || rankScore === null) return null;
    return getRankInfo(rankName, rankScore);
  }, [rankName, rankScore]);

  // Hide when no rank data is available
  if (!rankInfo || rankScore === null) return null;

  const colorClass = rankColorClass(rankInfo.tierName);

  // Format display name: "Gold II" or just "Master"
  const displayName =
    rankInfo.division > 1 || (rankInfo.divisionCeiling !== null && rankInfo.division === 1)
      ? `${rankInfo.tierName} ${'I'.repeat(rankInfo.division)}`
      : rankInfo.tierName;

  // Calculate progress percentage
  const hasProgress = rankInfo.divisionCeiling !== null;
  const progressPercent = hasProgress
    ? ((rankScore - rankInfo.divisionFloor) / (rankInfo.divisionCeiling! - rankInfo.divisionFloor)) * 100
    : 0;

  // Map tier name to ProgressBar color prop
  const progressColor = (() => {
    const lower = rankInfo.tierName.toLowerCase();
    if (lower === 'gold') return 'gold' as const;
    if (lower === 'predator' || lower === 'apex-red') return 'red' as const;
    if (lower === 'master') return 'purple' as const;
    if (lower === 'diamond' || lower === 'platinum') return 'blue' as const;
    return 'blue' as const;
  })();

  return (
    <div className="overlay-card">
      <div className="overlay-label mb-1">Ranked</div>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-overlay-sm font-semibold ${colorClass}`}>
          {displayName}
        </span>
        <span className="text-overlay-xs text-white/50">
          {formatCompact(rankScore)} RP
        </span>
      </div>
      {hasProgress ? (
        <ProgressBar
          current={rankScore - rankInfo.divisionFloor}
          max={rankInfo.divisionCeiling! - rankInfo.divisionFloor}
          color={progressColor}
        />
      ) : (
        <div className="text-overlay-xs text-white/30">
          {rankScore} RP total
        </div>
      )}
    </div>
  );
}

export const RankedProgress = memo(RankedProgressInner);
