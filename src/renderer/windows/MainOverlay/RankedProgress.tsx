import React from 'react';
import { ProgressBar } from '../../components/ProgressBar';

export function RankedProgress() {
  // TODO: Connect to ranked store
  const rankName = 'Gold II';
  const currentRP = 4200;
  const tierFloor = 4000;
  const tierCeiling = 4500;

  return (
    <div className="overlay-card">
      <div className="overlay-label mb-1">Ranked</div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-overlay-sm font-semibold text-rank-gold">{rankName}</span>
        <span className="text-overlay-xs text-white/50">{currentRP} RP</span>
      </div>
      <ProgressBar
        current={currentRP - tierFloor}
        max={tierCeiling - tierFloor}
        color="gold"
      />
    </div>
  );
}
