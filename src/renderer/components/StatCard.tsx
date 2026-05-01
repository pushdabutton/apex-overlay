import React, { memo } from 'react';
import { TrendIndicator } from './TrendIndicator';
import { formatCompact } from '../../shared/utils';

interface StatCardProps {
  label: string;
  value: number | string;
  previousValue?: number;
  compact?: boolean;
  highlight?: boolean;
  trend?: 'up' | 'down' | 'neutral';
}

/**
 * Determine the border color class based on comparison to a previous value.
 * Green = above average, red = below average, default = neutral/no comparison.
 * Uses a 5% threshold to avoid flickering on near-equal values.
 */
function getBorderColor(value: number | string, previousValue?: number): string {
  if (previousValue === undefined || typeof value !== 'number') return 'border-overlay-border';
  if (previousValue === 0 && value === 0) return 'border-overlay-border';
  const delta = previousValue === 0 ? (value > 0 ? 100 : 0) : ((value - previousValue) / previousValue) * 100;
  if (delta > 5) return 'border-apex-green/50';
  if (delta < -5) return 'border-apex-red/50';
  return 'border-overlay-border';
}

export const StatCard = memo(function StatCard({ label, value, previousValue, compact, highlight }: StatCardProps) {
  const displayValue = typeof value === 'number' ? formatCompact(value) : value;
  const borderColor = highlight
    ? 'border-apex-gold/40'
    : getBorderColor(value, previousValue);

  const valueClass = highlight && !compact
    ? 'overlay-value-highlight'
    : compact
      ? 'text-overlay-base font-bold text-white'
      : 'overlay-value';

  return (
    <div className={`overlay-card text-center border ${borderColor} ${compact ? 'p-2' : 'p-3'}`}>
      <div className="overlay-label">{label}</div>
      <div className={valueClass}>
        {displayValue}
      </div>
      {previousValue !== undefined && typeof value === 'number' && (
        <TrendIndicator current={value} previous={previousValue} />
      )}
    </div>
  );
});
