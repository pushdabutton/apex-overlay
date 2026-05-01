import React from 'react';
import { InsightBadge } from '../../components/InsightBadge';
import { useMatchStore } from '../../stores/match-store';

/**
 * Additional coaching tips beyond the top 3 shown in PostMatchSummary.
 * Uses the match store's deduplicated insights to avoid showing the same
 * insight in both components.
 */
export function CoachingTips() {
  const coachingInsights = useMatchStore((s) => s.coachingInsights);

  // PostMatchSummary already shows the first 3 insights via InsightList.
  // This component shows any additional insights beyond those 3.
  const additionalInsights = coachingInsights.slice(3);

  if (additionalInsights.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="overlay-header">More Coaching Tips</h3>
      <div className="flex flex-col gap-2">
        {additionalInsights.slice(0, 3).map((insight) => (
          <InsightBadge key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
}
