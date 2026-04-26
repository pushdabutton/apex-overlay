import { useEffect } from 'react';
import { useApiStore } from '../stores/api-store';
import { IPC } from '../../shared/ipc-channels';
import type { MapRotation } from '../../shared/types';

/**
 * Hook to access map rotation data, auto-updates from IPC.
 */
export function useMapRotation(): MapRotation | null {
  const mapRotation = useApiStore((s) => s.mapRotation);

  useEffect(() => {
    const unsub = window.apexCoach.on(IPC.API_MAP_ROTATION, (data) => {
      useApiStore.getState().setMapRotation(data as MapRotation);
    });
    return unsub;
  }, []);

  return mapRotation;
}
