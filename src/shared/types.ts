// ============================================================
// Domain Types -- Shared between main and renderer processes
// ============================================================

// --- Game Enums ---

export type GameMode = 'battle_royale' | 'ranked' | 'arenas' | 'ltm' | 'unknown';

export type GamePhase = 'lobby' | 'legend_select' | 'playing' | 'post_match';

export enum InsightType {
  SESSION_VS_AVERAGE = 'session_vs_average',
  SESSION_VS_AVERAGE_KILLS = 'session_vs_average_kills',
  SESSION_VS_AVERAGE_DAMAGE = 'session_vs_average_damage',
  TREND_IMPROVING = 'trend_improving',
  TREND_DECLINING = 'trend_declining',
  TREND_PLATEAU = 'trend_plateau',
  LEGEND_RECOMMENDATION = 'legend_recommendation',
  DEATH_TIMING = 'death_timing',
  WEAPON_PERFORMANCE = 'weapon_performance',
  PLACEMENT_PATTERN = 'placement_pattern',
  ACHIEVEMENT = 'achievement',
  RANKED_MILESTONE = 'ranked_milestone',
  WARM_UP_PATTERN = 'warm_up_pattern',
}

export enum InsightSeverity {
  INFO = 'info',
  SUGGESTION = 'suggestion',
  WARNING = 'warning',
  ACHIEVEMENT = 'achievement',
}

// --- Data Models ---

export interface Match {
  id: number;
  matchId: string | null;
  sessionId: number;
  legend: string;
  map: string | null;
  mode: GameMode;
  placement: number | null;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  headshots: number;
  shotsFired: number;
  shotsHit: number;
  knockdowns: number;
  revives: number;
  respawns: number;
  survivalTime: number;
  rpChange: number | null;
  duration: number;
  startedAt: string;
  endedAt: string | null;
}

export interface Session {
  id: number;
  startedAt: string;
  endedAt: string | null;
  matchesPlayed: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalDamage: number;
  totalHeadshots: number;
  avgPlacement: number | null;
  bestPlacement: number | null;
  totalRpChange: number;
}

export interface LegendStats {
  legend: string;
  gamesPlayed: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalDamage: number;
  totalHeadshots: number;
  totalWins: number;
  avgDamage: number;
  avgKills: number;
  avgPlacement: number | null;
  bestDamage: number;
  bestKills: number;
  winRate: number;
  lastPlayed: string | null;
}

export interface CoachingInsight {
  id: number;
  matchId: number | null;
  sessionId: number | null;
  type: InsightType;
  ruleId: string;
  message: string;
  severity: InsightSeverity;
  dataJson: Record<string, unknown> | null;
  dismissed: boolean;
  createdAt: string;
}

export interface DailyAggregate {
  date: string;
  gamesPlayed: number;
  totalKills: number;
  totalDeaths: number;
  totalDamage: number;
  totalHeadshots: number;
  avgPlacement: number | null;
  totalRpChange: number;
}

// --- API Types ---

export interface MapRotation {
  current: {
    map: string;
    remainingTimer: number;
    asset: string;
  };
  next: {
    map: string;
    durationMinutes: number;
  };
}

export interface CraftingItem {
  item: string;
  cost: number;
  itemType: {
    name: string;
    rarity: string;
  };
}

export interface PlayerProfile {
  platform: string;
  playerName: string;
  uid: string;
  level: number;
  rankName: string;
  rankScore: number;
  rankDivision: number;
}

// --- Domain Events (emitted by EventProcessor) ---

export type DomainEvent =
  | { type: 'MATCH_START'; timestamp: number; mode: GameMode }
  | { type: 'MATCH_END'; timestamp: number }
  | { type: 'PLAYER_KILL'; victim: string; weapon: string; headshot: boolean; timestamp: number; matchTime: number }
  | { type: 'PLAYER_DEATH'; attacker: string; weapon: string; timestamp: number; matchTime: number }
  | { type: 'PLAYER_ASSIST'; timestamp: number; matchTime: number }
  | { type: 'PLAYER_KNOCKDOWN'; victim: string; timestamp: number; matchTime: number }
  | { type: 'DAMAGE_DEALT'; amount: number; target: string; weapon: string; timestamp: number }
  | { type: 'PLAYER_REVIVE'; teammate: string; timestamp: number }
  | { type: 'PLAYER_RESPAWN'; teammate: string; timestamp: number }
  | { type: 'LEGEND_SELECTED'; legend: string; timestamp: number }
  | { type: 'RANK_UPDATE'; rankName: string; rankScore: number; timestamp: number }
  | { type: 'MATCH_PLACEMENT'; position: number; timestamp: number }
  | { type: 'GAME_PHASE'; phase: GamePhase; timestamp: number };

// --- Live Match State (in-memory, not persisted until match end) ---

export interface LiveMatchState {
  matchId: string | null;
  sessionId: number;
  legend: string;
  map: string | null;
  mode: GameMode;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  headshots: number;
  shotsFired: number;
  shotsHit: number;
  knockdowns: number;
  revives: number;
  respawns: number;
  startedAt: number;
  phase: GamePhase;
}
