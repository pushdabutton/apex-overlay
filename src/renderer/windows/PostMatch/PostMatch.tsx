import React, { memo } from 'react';
import { PostMatchSummary } from './PostMatchSummary';
import { PerformanceBenchmark } from './PerformanceBenchmark';
import { CoachingTips } from './CoachingTips';
import { LegendComparison } from './LegendComparison';

function PostMatchInner() {
  return (
    <div className="overlay-panel p-4 w-[600px] max-h-[700px] overflow-y-auto flex flex-col gap-3">
      {/* Draggable header */}
      <div className="draggable-region flex items-center justify-between pb-2 border-b border-overlay-border">
        <span className="text-overlay-lg font-bold text-white/90">POST-MATCH ANALYSIS</span>
        <button className="no-drag text-overlay-xs text-white/30 hover:text-white/60 transition-colors">
          DISMISS
        </button>
      </div>

      <PostMatchSummary />
      <PerformanceBenchmark />
      <CoachingTips />
      <LegendComparison />
    </div>
  );
}

export const PostMatch = memo(PostMatchInner);
