import React from 'react';
import { ProgressBar } from '../../components/ProgressBar';

export function RankedTracker() {
  // TODO: Connect to ranked store
  return (
    <div>
      <h3 className="overlay-header">Ranked Progress</h3>
      <div className="overlay-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-overlay-base font-semibold text-rank-gold">Gold II</span>
          <span className="text-overlay-sm text-white/50">4,200 RP</span>
        </div>
        <ProgressBar current={200} max={500} color="gold" />
        <div className="mt-2 text-overlay-xs text-white/40">
          Session RP change: <span className="text-apex-green">+120</span>
        </div>
      </div>
    </div>
  );
}
