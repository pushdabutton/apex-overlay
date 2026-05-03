// ============================================================
// Game Constants -- Apex Legends reference data
// ============================================================

// ow-native uses 21170, but ow-electron uses 21566 for Apex Legends
export const APEX_GAME_ID = 21566;

// All 17 documented Apex Legends GEP features.
// CRITICAL: Missing features = silent data loss. GEP drops events for unregistered features.
// Must be registered via setRequiredFeatures BEFORE the game phase that emits them.
// legendSelect_X (legend detection) fires during 'legend_selection' phase via 'team' feature.
export const GEP_REQUIRED_FEATURES: string[] = [
  'gep_internal',
  'me',
  'localization',
  'game_info',
  'match_info',
  'match_state',
  'team',
  'roster',
  'location',
  'rank',
  'match_summary',
  'damage',
  'inventory',
  'kill',
  'revive',
  'death',
  'kill_feed',
];

// All legends as of Season 24
export const LEGENDS = [
  'Alter',
  'Ash',
  'Ballistic',
  'Bangalore',
  'Bloodhound',
  'Catalyst',
  'Caustic',
  'Conduit',
  'Crypto',
  'Fuse',
  'Gibraltar',
  'Horizon',
  'Lifeline',
  'Loba',
  'Mad Maggie',
  'Mirage',
  'Newcastle',
  'Octane',
  'Pathfinder',
  'Rampart',
  'Revenant',
  'Seer',
  'Sparrow',
  'Valkyrie',
  'Vantage',
  'Wattson',
  'Wraith',
] as const;

export type LegendName = (typeof LEGENDS)[number];

// Rank tiers and RP thresholds
// Last verified: Season 24 (2026). Calibrated against in-game screenshot data.
// Ground truth: Alex = Gold II with 339/750 RP shown in-game, API total = 7339.
//   -> Gold II floor = 7339 - 339 = 7000, Gold per division = 750.
//   -> Gold IV floor = 7000 - 2*750 = 5500.
//   -> Rookie(1000) + Bronze(2000) + Silver(2500) = 5500.
// Tier floors: Rookie=0, Bronze=1000, Silver=3000, Gold=5500, Plat=8500, Diamond=12000, Master=16000
// NOTE: Web sources (overboost.pro, gametree.me, eloboss.net) conflict with each other
// and with in-game data. In-game screenshot is the authoritative source.
export const RANK_TIERS = [
  { name: 'Rookie', divisions: 4, rpPerDivision: 250, color: '#808080' },
  { name: 'Bronze', divisions: 4, rpPerDivision: 500, color: '#cd7f32' },
  { name: 'Silver', divisions: 4, rpPerDivision: 625, color: '#c0c0c0' },
  { name: 'Gold', divisions: 4, rpPerDivision: 750, color: '#ffd700' },
  { name: 'Platinum', divisions: 4, rpPerDivision: 875, color: '#00ced1' },
  { name: 'Diamond', divisions: 4, rpPerDivision: 1000, color: '#00bfff' },
  { name: 'Master', divisions: 1, rpPerDivision: null, color: '#9b59b6' },
  { name: 'Predator', divisions: 1, rpPerDivision: null, color: '#e74c3c' },
] as const;

// Maps (as of Season 20)
export const MAPS = [
  'Kings Canyon',
  "World's Edge",
  'Olympus',
  'Storm Point',
  'Broken Moon',
  'E-District',
] as const;

// Session gap threshold: if no match for this many seconds, start new session
export const DEFAULT_SESSION_GAP_SECONDS = 1800; // 30 minutes

// API polling intervals (milliseconds)
export const API_POLL_INTERVALS = {
  MAP_ROTATION: 60_000,      // 1 minute
  CRAFTING: 300_000,          // 5 minutes
  PLAYER_PROFILE: 300_000,   // 5 minutes
} as const;

// Coaching thresholds
export const COACHING_THRESHOLDS = {
  SIGNIFICANT_POSITIVE_DELTA: 0.15,   // +15%
  SIGNIFICANT_NEGATIVE_DELTA: -0.15,  // -15%
  HOT_STREAK_DELTA: 0.30,            // +30% for hot streak
  COLD_STREAK_DELTA: -0.30,          // -30% for cold streak
  NEUTRAL_BAND: 0.05,                 // +/- 5%
  MIN_GAMES_FOR_LEGEND_COMPARE: 5,
  MIN_LEGENDS_FOR_COMPARISON: 3,
  MIN_DEATHS_FOR_TIMING: 10,
  TREND_SESSIONS_REQUIRED: 3,
  TREND_PLATEAU_BAND: 0.08,          // +/- 8% considered stable
  LEGEND_PERFORMANCE_GAP: 0.20,       // 20% gap triggers suggestion
  LEGEND_SWITCH_KD_GAP: 0.25,        // 25% K/D gap triggers switch suggestion
  UNDERPLAYED_LEGEND_MAX_GAMES: 10,   // "underplayed" if fewer than this
  UNDERPLAYED_LEGEND_MIN_WIN_RATE: 0.20, // good win rate for underplayed
  WEAPON_MIN_KILLS: 5,               // minimum kills with a weapon for analysis
  WARMUP_MIN_SESSIONS: 5,            // sessions needed for warm-up detection
  WARMUP_MIN_MATCHES_PER_SESSION: 3, // matches per session for warm-up data
  WARMUP_GAMES_TO_CHECK: 2,          // first N games considered "warm-up"
  WARMUP_DEFICIT_THRESHOLD: 0.30,    // 30% less damage = warm-up pattern
  RANKED_DEMOTION_WARNING_RP: 120,   // warn when within this RP of demotion (~2-3 bad games buffer)
} as const;
