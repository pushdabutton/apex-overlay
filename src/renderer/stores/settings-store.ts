import { create } from 'zustand';

export type OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface SettingsState {
  overlayVisible: boolean;
  overlayPosition: OverlayPosition;
  apiKey: string;

  // Actions
  setOverlayVisible: (visible: boolean) => void;
  setOverlayPosition: (position: OverlayPosition) => void;
  setApiKey: (key: string) => void;
  reset: () => void;
}

const DEFAULTS = {
  overlayVisible: true,
  overlayPosition: 'top-right' as OverlayPosition,
  apiKey: '',
};

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULTS,

  setOverlayVisible: (visible) => set({ overlayVisible: visible }),
  setOverlayPosition: (position) => set({ overlayPosition: position }),
  setApiKey: (key) => set({ apiKey: key }),
  reset: () => set({ ...DEFAULTS }),
}));
