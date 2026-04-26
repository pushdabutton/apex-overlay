import React from 'react';
import { StatCard } from '../../components/StatCard';
import { TrendIndicator } from '../../components/TrendIndicator';

export function PerformanceBenchmark() {
  // TODO: Connect to session/aggregate stores
  return (
    <div>
      <h3 className="overlay-header">vs Your Averages</h3>
      <div className="grid grid-cols-3 gap-2">
        <div className="overlay-card text-center">
          <div className="overlay-label">Kills</div>
          <div className="overlay-value">0</div>
          <TrendIndicator current={0} previous={0} />
        </div>
        <div className="overlay-card text-center">
          <div className="overlay-label">Damage</div>
          <div className="overlay-value">0</div>
          <TrendIndicator current={0} previous={0} />
        </div>
        <div className="overlay-card text-center">
          <div className="overlay-label">Placement</div>
          <div className="overlay-value">--</div>
          <TrendIndicator current={0} previous={0} />
        </div>
      </div>
    </div>
  );
}
