import React from 'react';
import { MapCard } from '../../components/MapCard';
import { useMapRotation } from '../../hooks/useMapRotation';

export function MapRotation() {
  const rotation = useMapRotation();

  if (!rotation) return null;

  return (
    <div className="overlay-card">
      <div className="overlay-label mb-1">Map Rotation</div>
      <div className="flex gap-2">
        <MapCard
          map={rotation.current.map}
          remainingSeconds={rotation.current.remainingTimer}
          current
        />
        <MapCard
          map={rotation.next.map}
          durationMinutes={rotation.next.durationMinutes}
          current={false}
        />
      </div>
    </div>
  );
}
