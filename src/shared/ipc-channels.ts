// ============================================================
// IPC Channel Constants -- Single source of truth for all
// main <-> renderer communication channel names
// ============================================================

export const IPC = {
  // Main -> Renderer (broadcasts)
  MATCH_UPDATE: 'match:update',
  MATCH_START: 'match:start',
  MATCH_END: 'match:end',
  SESSION_UPDATE: 'session:update',
  COACHING_INSIGHT: 'coaching:insight',
  API_MAP_ROTATION: 'api:map-rotation',
  API_CRAFTING: 'api:crafting',
  API_PLAYER_PROFILE: 'api:player-profile',
  GAME_PHASE: 'game:phase',
  LIVE_STATS: 'match:live-stats',
  WEAPONS_UPDATE: 'match:weapons',
  PLAYER_NAME: 'player:name',
  GAME_MODE: 'match:game-mode',
  PLAYER_LOCATION: 'player:location',

  // Renderer -> Main (requests)
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:get-all',
  SESSION_HISTORY: 'session:history',
  MATCH_HISTORY: 'match:history',
  LEGEND_STATS: 'legend:stats',
  INSIGHTS_HISTORY: 'insights:history',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
