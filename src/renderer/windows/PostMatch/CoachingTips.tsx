import React from 'react';
import { InsightBadge } from '../../components/InsightBadge';
import { useCoachingInsights } from '../../hooks/useCoachingInsights';

export function CoachingTips() {
  const { matchInsights } = useCoachingInsights();

  if (matchInsights.length === 0) {
    return (
      <div>
        <h3 className="overlay-header">Coaching</h3>
        <p className="text-overlay-sm text-white/40">
          Play more matches to unlock coaching insights.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="overlay-header">Coaching Tips</h3>
      <div className="flex flex-col gap-2">
        {matchInsights.slice(0, 3).map((insight) => (
          <InsightBadge key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
}
