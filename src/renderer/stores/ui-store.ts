import { create } from 'zustand';

interface UIState {
  overlayVisible: boolean;
  postMatchVisible: boolean;
  dashboardVisible: boolean;
  settingsVisible: boolean;

  // Actions
  toggleOverlay: () => void;
  showPostMatch: () => void;
  hidePostMatch: () => void;
  toggleDashboard: () => void;
  toggleSettings: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  overlayVisible: true,
  postMatchVisible: false,
  dashboardVisible: false,
  settingsVisible: false,

  toggleOverlay: () => set((s) => ({ overlayVisible: !s.overlayVisible })),
  showPostMatch: () => set({ postMatchVisible: true }),
  hidePostMatch: () => set({ postMatchVisible: false }),
  toggleDashboard: () => set((s) => ({ dashboardVisible: !s.dashboardVisible })),
  toggleSettings: () => set((s) => ({ settingsVisible: !s.settingsVisible })),
}));
