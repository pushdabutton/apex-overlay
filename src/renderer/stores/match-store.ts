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
  placement: null as number | null,
  isInMatch: false,
  coachingInsights: [] as MatchInsight[],
};

export const useMatchStore = create<MatchState>((set) => ({
  ...INITIAL_STATE,

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

  setMatchResult: (result) => {
    set({
      placement: result.placement,
      kills: result.kills,
      deaths: result.deaths,
      assists: result.assists,
      damage: result.damage,
      legend: result.legend,
      map: result.map,
      isInMatch: false,
    });
  },

  addCoachingInsight: (insight) => {
    set((state) => ({
      coachingInsights: [...state.coachingInsights, insight],
    }));
  },

  resetMatch: () => {
    set({ ...INITIAL_STATE });
  },
}));
