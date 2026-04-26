import React, { memo } from 'react';
import { TrendIndicator } from './TrendIndicator';
import { formatCompact } from '../../shared/utils';

interface StatCardProps {
  label: string;
  value: number | string;
  previousValue?: number;
  compact?: boolean;
  trend?: 'up' | 'down' | 'neutral';
}

export const StatCard = memo(function StatCard({ label, value, previousValue, compact }: StatCardProps) {
  const displayValue = typeof value === 'number' ? formatCompact(value) : value;

  return (
    <div className={`overlay-card text-center ${compact ? 'p-2' : 'p-3'}`}>
      <div className="overlay-label">{label}</div>
      <div className={compact ? 'text-overlay-base font-bold text-white' : 'overlay-value'}>
        {displayValue}
      </div>
      {previousValue !== undefined && typeof value === 'number' && (
        <TrendIndicator current={value} previous={previousValue} />
      )}
    </div>
  );
});
