import React, { memo } from 'react';
import { InsightBadge } from '../../components/InsightBadge';
import { useCoachingInsights } from '../../hooks/useCoachingInsights';

function CoachingAlertInner() {
  const { latestInsight } = useCoachingInsights();

  if (!latestInsight) return null;

  return (
    <div className="animate-insight-in">
      <InsightBadge insight={latestInsight} />
    </div>
  );
}

export const CoachingAlert = memo(CoachingAlertInner);
