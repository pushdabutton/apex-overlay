import React from 'react';
import { LegendIcon } from '../../components/LegendIcon';

export function LegendComparison() {
  // TODO: Connect to legend stats store
  return (
    <div>
      <h3 className="overlay-header">Legend Performance</h3>
      <div className="flex gap-3 items-center">
        <div className="overlay-card flex-1 text-center">
          <LegendIcon legend="Wraith" size="md" />
          <div className="overlay-label mt-1">This Match</div>
          <div className="text-overlay-sm text-white/60">--</div>
        </div>
        <div className="text-overlay-xs text-white/30">vs</div>
        <div className="overlay-card flex-1 text-center">
          <LegendIcon legend="Horizon" size="md" />
          <div className="overlay-label mt-1">Your Best</div>
          <div className="text-overlay-sm text-white/60">--</div>
        </div>
      </div>
    </div>
  );
}
