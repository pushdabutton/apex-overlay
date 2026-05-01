import { create } from 'zustand';

interface MatchInsight {
  id: number;
  matchId: number | null;
  sessionId: number | null;
  type: string;
  ruleId: string;
  message: string;
  severity: string;
  dataJson: Record<string, unknown> | null;
  dismissed: boolean;
  createdAt: string;
}

interface MatchResult {
  placement: number | null;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  legend: string;
  map: string | null;
  mode: string | null;
}

export interface MatchState {
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  headshots: number;
  knockdowns: number;
  legend: string;
  map: string | null;
  mode: string | null;
  placement: number | null;
  isInMatch: boolean;
  coachingInsights: MatchInsight[];

  // Actions
  updateFromIpc: (data: Record<string, unknown>) => void;
  setMatchResult: (result: MatchResult) => void;
  addCoachingInsight: (insight: MatchInsight) => void;
  resetMatch: () => void;
}

const INITIAL_STATE = {
  kills: 0,
  deaths: 0,
  assists: 0,
  damage: 0,
  headshots: 0,
  knockdowns: 0,
  legend: 'Unknown',
  map: null as string | null,
  mode: null as string | null,
  placement: null as number | null,
  isInMatch: false,
  coachingInsights: [] as MatchInsight[],
};

export const useMatchStore = create<MatchState>((set) => ({
  ...INITIAL_STATE,

  updateFromIpc: (data) => {
    set((state) => {
      // Handle live-stats updates from ow-electron GEP tabs data
      // Shape: { type: 'live-stats', stats: { kills, assists, damage, teams, players } }
      if (data.type === 'live-stats' && typeof data.stats === 'object' && data.stats !== null) {
        const stats = data.stats as Record<string, unknown>;
        return {
          ...state,
          kills: (stats.kills as number) ?? state.kills,
          assists: (stats.assists as number) ?? state.assists,
          damage: (stats.damage as number) ?? state.damage,
          isInMatch: true,
        };
      }

      // Handle standard stat updates (from domain events like PLAYER_KILL etc.)
      // Shape: { type: 'stats', stats: { kills, deaths, assists, ... }, lastEvent: ... }
      if (data.type === 'stats' && typeof data.stats === 'object' && data.stats !== null) {
        const stats = data.stats as Record<string, unknown>;
        return {
          ...state,
          kills: (stats.kills as number) ?? state.kills,
          deaths: (stats.deaths as number) ?? state.deaths,
          assists: (stats.assists as number) ?? state.assists,
          damage: (stats.damage as number) ?? state.damage,
          headshots: (stats.headshots as number) ?? state.headshots,
          knockdowns: (stats.knockdowns as number) ?? state.knockdowns,
          isInMatch: true,
        };
      }

      // Handle legend updates
      if (data.type === 'legend' && typeof data.legend === 'string') {
        return { ...state, legend: data.legend };
      }

      // Handle placement updates
      if (data.type === 'placement' && typeof data.position === 'number') {
        return { ...state, placement: data.position as number };
      }

      // Fallback: apply flat keys directly (backward compatible with older format)
      return {
        ...state,
        kills: (data.kills as number) ?? state.kills,
        deaths: (data.deaths as number) ?? state.deaths,
        assists: (data.assists as number) ?? state.assists,
        damage: (data.damage as number) ?? state.damage,
        headshots: (data.headshots as number) ?? state.headshots,
        knockdowns: (data.knockdowns as number) ?? state.knockdowns,
        legend: (data.legend as string) ?? state.legend,
        isInMatch: true,
      };
    });
  },

  setMatchResult: (result) => {
    set({
      placement: result.placement,
      kills: result.kills,
      deaths: result.deaths,
      assists: result.assists,
      damage: result.damage,
      legend: result.legend,
      map: result.map,
      mode: result.mode ?? null,
      isInMatch: false,
    });
  },

  addCoachingInsight: (insight) => {
    set((state) => {
      // Deduplicate: skip if we already have an insight with the same ruleId+type
      const isDupe = state.coachingInsights.some(
        (existing) => existing.ruleId === insight.ruleId && existing.type === insight.type,
      );
      if (isDupe) return state;
      return { coachingInsights: [...state.coachingInsights, insight] };
    });
  },

  resetMatch: () => {
    set({ ...INITIAL_STATE });
  },
}));
