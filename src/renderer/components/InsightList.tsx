import React, { memo, useMemo } from 'react';
import { InsightCard } from './InsightCard';

interface InsightItem {
  id: number;
  message: string;
  severity: 'info' | 'warning' | 'suggestion' | 'achievement';
  type: string;
  ruleId: string;
}

interface InsightListProps {
  insights: InsightItem[];
  maxVisible?: number;
  onDismiss?: (id: number) => void;
}

// Severity priority: higher = shown first
const SEVERITY_ORDER: Record<string, number> = {
  warning: 4,
  suggestion: 3,
  achievement: 2,
  info: 1,
};

// Type-to-icon mapping
const TYPE_ICONS: Record<string, string> = {
  session_vs_average: '\u{1F525}',        // fire (legacy)
  session_vs_average_kills: '\u{1F525}',  // fire
  session_vs_average_damage: '\u{1F4A5}', // collision/damage
  trend_improving: '\u{1F4C8}',      // chart up
  trend_declining: '\u{1F4C9}',      // chart down
  trend_plateau: '\u{2796}',         // minus
  legend_recommendation: '\u{1F3AE}', // game controller
  death_timing: '\u{1F480}',          // skull
  weapon_performance: '\u{1F52B}',    // gun
  warm_up_pattern: '\u{2615}',        // coffee
  ranked_milestone: '\u{1F3C6}',      // trophy
  achievement: '\u{2B50}',            // star
  placement_pattern: '\u{1F5FA}',     // map
};

export const InsightList = memo(function InsightList({
  insights,
  maxVisible = 3,
  onDismiss,
}: InsightListProps) {
  // Sort by severity (most severe first) and limit to maxVisible
  const visible = useMemo(() => {
    const sorted = [...insights].sort(
      (a, b) => (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0),
    );
    return sorted.slice(0, maxVisible);
  }, [insights, maxVisible]);

  return (
    <div className="flex flex-col gap-1.5">
      {visible.map((insight) => (
        <div key={insight.id} className="flex items-start gap-2">
          <span
            data-testid="insight-icon"
            className="text-sm shrink-0 mt-0.5"
            aria-hidden="true"
          >
            {TYPE_ICONS[insight.type] ?? '\u{1F4A1}'}
          </span>
          <div className="flex-1">
            <InsightCard
              message={insight.message}
              severity={insight.severity}
              onDismiss={onDismiss ? () => onDismiss(insight.id) : undefined}
            />
          </div>
        </div>
      ))}
    </div>
  );
});
