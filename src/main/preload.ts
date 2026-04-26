// ============================================================
// Preload Script -- Exposes safe IPC bridge to renderer
// ============================================================

import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type IpcChannel } from '../shared/ipc-channels';

// Type-safe API exposed to renderer windows
const api = {
  // Send request to main process and await response
  invoke: (channel: IpcChannel, ...args: unknown[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },

  // Subscribe to broadcasts from main process
  on: (channel: IpcChannel, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
      callback(...args);
    };
    ipcRenderer.on(channel, subscription);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },

  // One-time listener
  once: (channel: IpcChannel, callback: (...args: unknown[]) => void) => {
    ipcRenderer.once(channel, (_event, ...args) => callback(...args));
  },

  // Expose channel constants so renderer can reference them
  channels: IPC,
};

contextBridge.exposeInMainWorld('apexCoach', api);

// TypeScript declaration for renderer access
declare global {
  interface Window {
    apexCoach: typeof api;
  }
}
