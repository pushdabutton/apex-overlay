import { create } from 'zustand';

export type OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface SettingsState {
  overlayPosition: OverlayPosition;
  apiKey: string;

  // Actions
  setOverlayPosition: (position: OverlayPosition) => void;
  setApiKey: (key: string) => void;
  reset: () => void;
}

const DEFAULTS = {
  overlayPosition: 'top-right' as OverlayPosition,
  apiKey: '',
};

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULTS,

  setOverlayPosition: (position) => set({ overlayPosition: position }),
  setApiKey: (key) => set({ apiKey: key }),
  reset: () => set({ ...DEFAULTS }),
}));
