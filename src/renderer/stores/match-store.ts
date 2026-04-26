import { create } from 'zustand';

interface MatchState {
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  headshots: number;
  knockdowns: number;
  legend: string;
  isInMatch: boolean;

  // Actions
  updateFromIpc: (data: Record<string, unknown>) => void;
  resetMatch: () => void;
}

export const useMatchStore = create<MatchState>((set) => ({
  kills: 0,
  deaths: 0,
  assists: 0,
  damage: 0,
  headshots: 0,
  knockdowns: 0,
  legend: 'Unknown',
  isInMatch: false,

  updateFromIpc: (data) => {
    set((state) => ({
      ...state,
      kills: (data.kills as number) ?? state.kills,
      deaths: (data.deaths as number) ?? state.deaths,
      assists: (data.assists as number) ?? state.assists,
      damage: (data.damage as number) ?? state.damage,
      headshots: (data.headshots as number) ?? state.headshots,
      knockdowns: (data.knockdowns as number) ?? state.knockdowns,
      legend: (data.legend as string) ?? state.legend,
      isInMatch: true,
    }));
  },

  resetMatch: () => {
    set({
      kills: 0,
      deaths: 0,
      assists: 0,
      damage: 0,
      headshots: 0,
      knockdowns: 0,
      legend: 'Unknown',
      isInMatch: false,
    });
  },
}));
