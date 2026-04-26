import { create } from 'zustand';
import type { MapRotation, CraftingItem, PlayerProfile } from '../../shared/types';

interface ApiState {
  mapRotation: MapRotation | null;
  craftingItems: CraftingItem[];
  playerProfile: PlayerProfile | null;

  // Actions
  setMapRotation: (rotation: MapRotation) => void;
  setCraftingItems: (items: CraftingItem[]) => void;
  setPlayerProfile: (profile: PlayerProfile) => void;
}

export const useApiStore = create<ApiState>((set) => ({
  mapRotation: null,
  craftingItems: [],
  playerProfile: null,

  setMapRotation: (rotation) => set({ mapRotation: rotation }),
  setCraftingItems: (items) => set({ craftingItems: items }),
  setPlayerProfile: (profile) => set({ playerProfile: profile }),
}));
