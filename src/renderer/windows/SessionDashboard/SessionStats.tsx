import React from 'react';
import { StatCard } from '../../components/StatCard';
import { useSessionStats } from '../../hooks/useSessionStats';

export function SessionStats() {
  const session = useSessionStats();

  return (
    <div>
      <h3 className="overlay-header">Session Overview</h3>
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Matches" value={session.matchesPlayed} />
        <StatCard label="Total Kills" value={session.totalKills} />
        <StatCard label="Total Deaths" value={session.totalDeaths} />
        <StatCard label="Total Damage" value={session.totalDamage} />
        <StatCard label="Avg Kills" value={session.avgKills?.toFixed(1) ?? '--'} />
        <StatCard label="Avg Damage" value={session.avgDamage?.toFixed(0) ?? '--'} />
        <StatCard label="KD Ratio" value={session.kd} />
        <StatCard label="Best Placement" value={session.bestPlacement ?? '--'} />
      </div>
    </div>
  );
}
