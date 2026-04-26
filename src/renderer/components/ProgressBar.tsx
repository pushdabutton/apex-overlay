import React, { memo } from 'react';
import { clamp } from '../../shared/utils';

interface ProgressBarProps {
  /** Percentage (0-100). Takes priority over current/max if provided. */
  percent?: number;
  /** Current value (legacy API, used with max) */
  current?: number;
  /** Max value (legacy API, used with current) */
  max?: number;
  label?: string;
  color?: 'blue' | 'green' | 'gold' | 'red' | 'purple';
}

const COLOR_MAP = {
  blue: 'bg-apex-blue',
  green: 'bg-apex-green',
  gold: 'bg-apex-gold',
  red: 'bg-apex-red',
  purple: 'bg-apex-purple',
};

export const ProgressBar = memo(function ProgressBar({
  percent,
  current,
  max,
  label,
  color = 'blue',
}: ProgressBarProps) {
  // Support both percent prop and current/max calculation
  const rawPercent = percent !== undefined
    ? percent
    : (current !== undefined && max !== undefined)
      ? (current / Math.max(max, 1)) * 100
      : 0;

  const percentage = clamp(rawPercent, 0, 100);
  const barColor = COLOR_MAP[color] ?? COLOR_MAP.blue;

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="overlay-label">{label}</span>
          <span className="text-overlay-xs text-white/40">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
});
