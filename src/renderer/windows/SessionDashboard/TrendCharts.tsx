import React from 'react';

export function TrendCharts() {
  // TODO: Implement trend charts with lightweight charting library
  // Consider: recharts (React-native), lightweight-charts, or canvas-based
  return (
    <div>
      <h3 className="overlay-header">7-Day Trends</h3>
      <div className="grid grid-cols-3 gap-2">
        <div className="overlay-card h-[120px] flex items-center justify-center">
          <span className="text-overlay-xs text-white/30">Damage chart (coming soon)</span>
        </div>
        <div className="overlay-card h-[120px] flex items-center justify-center">
          <span className="text-overlay-xs text-white/30">Kills chart (coming soon)</span>
        </div>
        <div className="overlay-card h-[120px] flex items-center justify-center">
          <span className="text-overlay-xs text-white/30">Placement chart (coming soon)</span>
        </div>
      </div>
    </div>
  );
}
