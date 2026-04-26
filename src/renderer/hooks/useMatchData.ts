import { useEffect } from 'react';
import { useMatchStore } from '../stores/match-store';
import { IPC } from '../../shared/ipc-channels';

/**
 * Hook to access live match data, auto-updates from IPC.
 */
export function useMatchData() {
  const match = useMatchStore();

  useEffect(() => {
    const unsub = window.apexCoach.on(IPC.MATCH_UPDATE, (data) => {
      useMatchStore.getState().updateFromIpc(data as Record<string, unknown>);
    });
    return unsub;
  }, []);

  return match;
}
