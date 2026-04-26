import { useEffect, useCallback } from 'react';
import type { IpcChannel } from '../../shared/ipc-channels';

/**
 * Generic hook for IPC communication with main process.
 */
export function useIpcListener<T>(channel: IpcChannel, callback: (data: T) => void): void {
  useEffect(() => {
    const unsubscribe = window.apexCoach.on(channel, (data) => {
      callback(data as T);
    });
    return unsubscribe;
  }, [channel, callback]);
}

/**
 * Invoke an IPC handler and return the result.
 */
export function useIpcInvoke() {
  return useCallback(
    async <T>(channel: IpcChannel, ...args: unknown[]): Promise<T> => {
      return (await window.apexCoach.invoke(channel, ...args)) as T;
    },
    [],
  );
}
