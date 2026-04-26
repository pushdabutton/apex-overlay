import React, { memo } from 'react';
import { SessionDashboardView } from './SessionDashboardView';

function SessionDashboardInner() {
  return (
    <div className="overlay-panel p-4 w-[800px] max-h-[600px] overflow-y-auto flex flex-col gap-3">
      <div className="draggable-region flex items-center justify-between pb-2 border-b border-overlay-border">
        <span className="text-overlay-lg font-bold text-white/90">SESSION DASHBOARD</span>
        <span className="text-overlay-xs text-white/30">BETWEEN MATCHES</span>
      </div>

      <SessionDashboardView />
    </div>
  );
}

export const SessionDashboard = memo(SessionDashboardInner);
