import React from 'react';
import type { CraftingItem } from '../../shared/types';

interface CraftingRotationProps {
  items: CraftingItem[];
  compact?: boolean;
}

export function CraftingRotation({ items, compact }: CraftingRotationProps) {
  if (items.length === 0) return null;

  return (
    <div className="overlay-card">
      <div className="overlay-label mb-1">Crafting</div>
      <div className={`flex ${compact ? 'gap-1 flex-wrap' : 'gap-2 flex-col'}`}>
        {items.slice(0, compact ? 4 : 8).map((item, i) => (
          <div
            key={i}
            className="text-overlay-xs text-white/60 bg-white/5 rounded px-1.5 py-0.5"
          >
            {item.item} ({item.cost})
          </div>
        ))}
      </div>
    </div>
  );
}
