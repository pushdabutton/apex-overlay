import React from 'react';
import { InsightBadge } from '../../components/InsightBadge';
import { useCoachingInsights } from '../../hooks/useCoachingInsights';

export function CoachingAlert() {
  const { latestInsight } = useCoachingInsights();

  if (!latestInsight) return null;

  return (
    <div className="animate-insight-in">
      <InsightBadge insight={latestInsight} />
    </div>
  );
}
