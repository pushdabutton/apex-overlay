import React, { memo } from 'react';
import { legendIconUrl } from '../assets/legends';

interface LegendIconProps {
  legend: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
};

/**
 * Displays a legend's SVG icon inside a circular container.
 * Falls back to letter initials when no SVG is available (e.g. new/unknown legends).
 */
export const LegendIcon = memo(function LegendIcon({ legend, size = 'sm' }: LegendIconProps) {
  const sizeClass = SIZE_MAP[size];
  const iconUrl = legendIconUrl(legend);

  if (iconUrl) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-apex-purple/30 border border-apex-purple/50 flex items-center justify-center overflow-hidden`}
        title={legend}
      >
        <img
          src={iconUrl}
          alt={legend}
          className="w-[80%] h-[80%] object-contain"
          draggable={false}
        />
      </div>
    );
  }

  // Fallback: letter initials for unknown legends
  const initials = legend
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`${sizeClass} rounded-full bg-apex-purple/30 border border-apex-purple/50 flex items-center justify-center`}
      title={legend}
    >
      <span className="text-overlay-xs font-bold text-apex-purple">{initials}</span>
    </div>
  );
});
