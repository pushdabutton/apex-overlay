import React, { memo } from 'react';
import { StatCard } from '../../components/StatCard';
import { useSessionStore } from '../../stores/session-store';

/**
 * Compact in-game HUD overlay showing session K/D, total kills, total damage.
 * Extremely lightweight -- React.memo on everything, no animations.
 * Fixed dimensions, no overflow.
 */
export const MainOverlayHUD = memo(function MainOverlayHUD() {
  const kd = useSessionStore((s) => s.kd);
  const totalKills = useSessionStore((s) => s.totalKills);
  const totalDamage = useSessionStore((s) => s.totalDamage);

  return (
    <div className="w-[200px] overflow-hidden bg-black/70 rounded-md p-2 flex flex-col gap-1">
      <div className="grid grid-cols-3 gap-1">
        <StatCard label="K/D" value={kd} compact />
        <StatCard label="Kills" value={totalKills} compact />
        <StatCard label="Damage" value={totalDamage} compact />
      </div>
    </div>
  );
});
