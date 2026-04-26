import React from 'react';
import { percentChange } from '../../shared/utils';

interface TrendIndicatorProps {
  current: number;
  previous: number;
  format?: 'percent' | 'absolute';
}

export function TrendIndicator({ current, previous, format = 'percent' }: TrendIndicatorProps) {
  if (previous === 0 && current === 0) return null;

  const delta = format === 'percent'
    ? percentChange(current, previous)
    : current - previous;

  const isPositive = delta > 0;
  const isNeutral = Math.abs(delta) < 1;

  if (isNeutral) {
    return <span className="text-overlay-xs text-white/30">--</span>;
  }

  const color = isPositive ? 'text-apex-green' : 'text-apex-red';
  const arrow = isPositive ? '\u2191' : '\u2193';
  const displayDelta = format === 'percent'
    ? `${Math.abs(Math.round(delta))}%`
    : Math.abs(Math.round(delta)).toString();

  return (
    <span className={`text-overlay-xs ${color}`}>
      {arrow} {displayDelta}
    </span>
  );
}
