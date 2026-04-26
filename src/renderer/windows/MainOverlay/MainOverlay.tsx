import React from 'react';
import { SessionTracker } from './SessionTracker';
import { MapRotation } from './MapRotation';
import { RankedProgress } from './RankedProgress';
import { CoachingAlert } from './CoachingAlert';
import { CraftingRotation } from '../../components/CraftingRotation';

export function MainOverlay() {
  return (
    <div className="overlay-panel p-3 w-[320px] min-h-[400px] flex flex-col gap-2">
      {/* Draggable header */}
      <div className="draggable-region flex items-center justify-between pb-1 border-b border-overlay-border">
        <span className="text-overlay-sm font-bold text-white/70">APEX COACH</span>
        <span className="text-overlay-xs text-white/30">LIVE</span>
      </div>

      {/* Session stats */}
      <SessionTracker />

      {/* Coaching alerts (toast-style) */}
      <CoachingAlert />

      {/* Map rotation */}
      <MapRotation />

      {/* Ranked progress (if in ranked) */}
      <RankedProgress />

      {/* Crafting rotation (compact) */}
      <CraftingRotation items={[]} compact />
    </div>
  );
}
