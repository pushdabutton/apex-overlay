import React from 'react';

interface LegendIconProps {
  legend: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
};

export function LegendIcon({ legend, size = 'sm' }: LegendIconProps) {
  const sizeClass = SIZE_MAP[size];

  // In MVP, use initials as placeholder. Phase 2: actual legend portraits.
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
}
