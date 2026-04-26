import { create } from 'zustand';
import { kdRatio } from '../../shared/utils';

export interface SessionState {
  matchesPlayed: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalDamage: number;
  totalHeadshots: number;
  totalKnockdowns: number;
  avgKills: number;
  avgDamage: number;
  bestPlacement: number | null;
  kd: string;

  // Actions
  updateFromIpc: (data: Record<string, unknown>) => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  matchesPlayed: 0,
  totalKills: 0,
  totalDeaths: 0,
  totalAssists: 0,
  totalDamage: 0,
  totalHeadshots: 0,
  totalKnockdowns: 0,
  avgKills: 0,
  avgDamage: 0,
  bestPlacement: null,
  kd: '0.00',

  updateFromIpc: (data) => {
    set((state) => {
      const totalKills = (data.totalKills as number) ?? state.totalKills;
      const totalDeaths = (data.totalDeaths as number) ?? state.totalDeaths;
      const matchesPlayed = (data.matchesPlayed as number) ?? state.matchesPlayed;
      const totalDamage = (data.totalDamage as number) ?? state.totalDamage;

      return {
        ...state,
        matchesPlayed,
        totalKills,
        totalDeaths,
        totalAssists: (data.totalAssists as number) ?? state.totalAssists,
        totalDamage,
        totalHeadshots: (data.totalHeadshots as number) ?? state.totalHeadshots,
        totalKnockdowns: (data.totalKnockdowns as number) ?? state.totalKnockdowns,
        avgKills: matchesPlayed > 0 ? totalKills / matchesPlayed : 0,
        avgDamage: matchesPlayed > 0 ? totalDamage / matchesPlayed : 0,
        bestPlacement: (data.bestPlacement as number) ?? state.bestPlacement,
        kd: kdRatio(totalKills, totalDeaths),
      };
    });
  },

  resetSession: () => {
    set({
      matchesPlayed: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalAssists: 0,
      totalDamage: 0,
      totalHeadshots: 0,
      totalKnockdowns: 0,
      avgKills: 0,
      avgDamage: 0,
      bestPlacement: null,
      kd: '0.00',
    });
  },
}));
