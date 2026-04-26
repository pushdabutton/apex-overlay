import React, { memo } from 'react';

interface InsightCardProps {
  message: string;
  severity: 'info' | 'warning' | 'suggestion' | 'achievement';
  onDismiss: () => void;
}

const SEVERITY_CLASSES: Record<string, string> = {
  info: 'insight-card-info border-l-blue-400 bg-blue-900/20',
  warning: 'insight-card-warning border-l-amber-400 bg-amber-900/20',
  suggestion: 'insight-card-suggestion border-l-purple-400 bg-purple-900/20',
  achievement: 'insight-card-achievement border-l-green-400 bg-green-900/20',
};

export const InsightCard = memo(function InsightCard({
  message,
  severity,
  onDismiss,
}: InsightCardProps) {
  const severityClass = SEVERITY_CLASSES[severity] ?? SEVERITY_CLASSES.info;

  return (
    <div
      className={`${severityClass} rounded-md px-3 py-2 border-l-4 flex items-start justify-between gap-2`}
    >
      <span className="text-overlay-sm text-white/90">{message}</span>
      <button
        onClick={onDismiss}
        className="text-white/40 hover:text-white/70 text-xs shrink-0"
        aria-label="Dismiss"
      >
        X
      </button>
    </div>
  );
});
