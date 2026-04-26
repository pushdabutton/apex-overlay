import { useEffect } from 'react';
import { useSessionStore } from '../stores/session-store';
import { IPC } from '../../shared/ipc-channels';

/**
 * Hook to access session aggregate stats, auto-updates from IPC.
 */
export function useSessionStats() {
  const session = useSessionStore();

  useEffect(() => {
    const unsub = window.apexCoach.on(IPC.SESSION_UPDATE, (data) => {
      useSessionStore.getState().updateFromIpc(data as Record<string, unknown>);
    });
    return unsub;
  }, []);

  return session;
}
