import React from 'react';
import { clamp } from '../../shared/utils';

interface ProgressBarProps {
  current: number;
  max: number;
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

export function ProgressBar({ current, max, label, color = 'blue' }: ProgressBarProps) {
  const percentage = clamp((current / Math.max(max, 1)) * 100, 0, 100);
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
          className={`h-full ${barColor} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
