import React from 'react';
import { StatCard } from '../../components/StatCard';
import { useMatchData } from '../../hooks/useMatchData';
import { useSessionStats } from '../../hooks/useSessionStats';

export function SessionTracker() {
  const match = useMatchData();
  const session = useSessionStats();

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <StatCard
        label="Kills"
        value={match.kills}
        previousValue={session.avgKills}
        compact
      />
      <StatCard
        label="Deaths"
        value={match.deaths}
        compact
      />
      <StatCard
        label="Damage"
        value={match.damage}
        previousValue={session.avgDamage}
        compact
      />
      <StatCard
        label="Assists"
        value={match.assists}
        compact
      />
    </div>
  );
}
