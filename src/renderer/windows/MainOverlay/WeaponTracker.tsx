import React, { memo } from 'react';
import { useMatchStore } from '../../stores/match-store';

function WeaponTrackerInner() {
  const weapons = useMatchStore((s) => s.weapons);

  // GEP sends weapon slots in multiple key formats. The main process normalizes
  // to "weapon0"/"weapon1", but check all variants as defense-in-depth.
  const weapon0 = weapons.weapon0 ?? weapons.weapon_0 ?? weapons['0'] ?? null;
  const weapon1 = weapons.weapon1 ?? weapons.weapon_1 ?? weapons['1'] ?? null;

  // Hide when no weapons data is available
  if (!weapon0 && !weapon1) return null;

  return (
    <div className="overlay-card">
      <div className="overlay-label mb-1">Weapons</div>
      <div className="flex gap-2">
        <WeaponSlot slot={1} name={weapon0} />
        <WeaponSlot slot={2} name={weapon1} />
      </div>
    </div>
  );
}

interface WeaponSlotProps {
  slot: number;
  name: string | null;
}

const WeaponSlot = memo(function WeaponSlot({ slot, name }: WeaponSlotProps) {
  if (!name) {
    return (
      <div className="flex-1 px-2 py-1 rounded bg-white/5 text-center">
        <span className="text-overlay-xs text-white/20">Slot {slot}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 px-2 py-1 rounded bg-white/10 text-center">
      <span className="text-overlay-xs text-white/70">{name}</span>
    </div>
  );
});

export const WeaponTracker = memo(WeaponTrackerInner);
