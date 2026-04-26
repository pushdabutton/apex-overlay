import React from 'react';
import { formatDuration } from '../../shared/utils';

interface MapCardProps {
  map: string;
  remainingSeconds?: number;
  durationMinutes?: number;
  current: boolean;
}

export function MapCard({ map, remainingSeconds, durationMinutes, current }: MapCardProps) {
  return (
    <div className={`flex-1 rounded px-2 py-1 ${current ? 'bg-apex-blue/20 border border-apex-blue/30' : 'bg-white/5'}`}>
      <div className="text-overlay-xs text-white/40">{current ? 'NOW' : 'NEXT'}</div>
      <div className="text-overlay-sm font-semibold text-white/80 truncate">{map}</div>
      <div className="text-overlay-xs text-white/40">
        {remainingSeconds !== undefined
          ? formatDuration(remainingSeconds)
          : durationMinutes !== undefined
            ? `${durationMinutes}m`
            : '--'}
      </div>
    </div>
  );
}
