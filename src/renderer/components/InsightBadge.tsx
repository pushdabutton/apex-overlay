import React from 'react';
import type { CoachingInsight } from '../../shared/types';
import { InsightSeverity } from '../../shared/types';

interface InsightBadgeProps {
  insight: CoachingInsight;
}

const SEVERITY_STYLES: Record<string, string> = {
  [InsightSeverity.INFO]: 'badge-info',
  [InsightSeverity.SUGGESTION]: 'badge-suggestion',
  [InsightSeverity.WARNING]: 'badge-warning',
  [InsightSeverity.ACHIEVEMENT]: 'badge-achievement',
};

const SEVERITY_ICONS: Record<string, string> = {
  [InsightSeverity.INFO]: '\u2139\uFE0F',
  [InsightSeverity.SUGGESTION]: '\uD83D\uDCA1',
  [InsightSeverity.WARNING]: '\u26A0\uFE0F',
  [InsightSeverity.ACHIEVEMENT]: '\u2B50',
};

export function InsightBadge({ insight }: InsightBadgeProps) {
  const badgeClass = SEVERITY_STYLES[insight.severity] ?? 'badge-info';
  const icon = SEVERITY_ICONS[insight.severity] ?? '';

  return (
    <div className={`${badgeClass} rounded-md px-3 py-2 text-overlay-sm`}>
      <span className="mr-1">{icon}</span>
      {insight.message}
    </div>
  );
}
