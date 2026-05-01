import React, { memo } from 'react';
import { LegendIcon } from '../../components/LegendIcon';
import { useMatchStore } from '../../stores/match-store';
import { useSessionStore } from '../../stores/session-store';
import { kdRatio, formatCompact } from '../../../shared/utils';

/**
 * Legend comparison showing this match's performance with the selected legend.
 * Displays the current legend's match stats alongside session totals.
 */
export const LegendComparison = memo(function LegendComparison() {
  const legend = useMatchStore((s) => s.legend);
  const kills = useMatchStore((s) => s.kills);
  const deaths = useMatchStore((s) => s.deaths);
  const damage = useMatchStore((s) => s.damage);
  const assists = useMatchStore((s) => s.assists);
  const headshots = useMatchStore((s) => s.headshots);
  const knockdowns = useMatchStore((s) => s.knockdowns);

  const sessionKills = useSessionStore((s) => s.totalKills);
  const sessionDeaths = useSessionStore((s) => s.totalDeaths);
  const sessionDamage = useSessionStore((s) => s.totalDamage);
  const matchesPlayed = useSessionStore((s) => s.matchesPlayed);

  return (
    <div>
      <h3 className="overlay-header">Legend Performance</h3>
      <div className="flex gap-3 items-stretch">
        {/* This Match */}
        <div className="overlay-card flex-1 p-3">
          <div className="flex items-center gap-2 mb-2">
            <LegendIcon legend={legend} size="md" />
            <div>
              <div className="text-overlay-sm font-bold text-white">{legend}</div>
              <div className="text-overlay-xs text-white/40">This Match</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 text-overlay-xs">
            <div>
              <span className="text-white/40">K/D: </span>
              <span className="text-white/80">{kdRatio(kills, deaths)}</span>
            </div>
            <div>
              <span className="text-white/40">DMG: </span>
              <span className="text-white/80">{formatCompact(damage)}</span>
            </div>
            <div>
              <span className="text-white/40">KDA: </span>
              <span className="text-white/80">
                {deaths === 0 ? (kills + assists).toFixed(1) : ((kills + assists) / deaths).toFixed(1)}
              </span>
            </div>
            <div>
              <span className="text-white/40">HS: </span>
              <span className="text-white/80">{headshots}</span>
            </div>
            {knockdowns > 0 && (
              <div>
                <span className="text-white/40">KD: </span>
                <span className="text-white/80">{knockdowns}</span>
              </div>
            )}
          </div>
        </div>

        {/* Session summary */}
        {matchesPlayed > 0 && (
          <>
            <div className="flex items-center text-overlay-xs text-white/20">vs</div>
            <div className="overlay-card flex-1 p-3">
              <div className="flex items-center gap-2 mb-2">
                <LegendIcon legend={legend} size="md" />
                <div>
                  <div className="text-overlay-sm font-bold text-white/70">Session</div>
                  <div className="text-overlay-xs text-white/40">{matchesPlayed} games</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 text-overlay-xs">
                <div>
                  <span className="text-white/40">K/D: </span>
                  <span className="text-white/60">{kdRatio(sessionKills, sessionDeaths)}</span>
                </div>
                <div>
                  <span className="text-white/40">DMG: </span>
                  <span className="text-white/60">{formatCompact(sessionDamage)}</span>
                </div>
                <div>
                  <span className="text-white/40">Avg K: </span>
                  <span className="text-white/60">{(sessionKills / matchesPlayed).toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-white/40">Avg D: </span>
                  <span className="text-white/60">{formatCompact(Math.round(sessionDamage / matchesPlayed))}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
});
