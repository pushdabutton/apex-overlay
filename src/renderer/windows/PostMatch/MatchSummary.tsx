import React from 'react';
import { StatCard } from '../../components/StatCard';

export function MatchSummary() {
  // TODO: Connect to match store
  return (
    <div>
      <h3 className="overlay-header">Match Summary</h3>
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Kills" value={0} />
        <StatCard label="Deaths" value={0} />
        <StatCard label="Damage" value={0} />
        <StatCard label="Assists" value={0} />
        <StatCard label="Headshots" value={0} />
        <StatCard label="Knockdowns" value={0} />
        <StatCard label="Revives" value={0} />
        <StatCard label="Placement" value={0} />
      </div>
    </div>
  );
}
