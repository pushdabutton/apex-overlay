// ============================================================
// Game Constants -- Apex Legends reference data
// ============================================================

export const APEX_GAME_ID = 21170;

// All legends as of Season 20
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
  'Valkyrie',
  'Vantage',
  'Wattson',
  'Wraith',
] as const;

export type LegendName = (typeof LEGENDS)[number];

// Rank tiers and RP thresholds
export const RANK_TIERS = [
  { name: 'Rookie', divisions: 4, rpPerDivision: 250, color: '#808080' },
  { name: 'Bronze', divisions: 4, rpPerDivision: 300, color: '#cd7f32' },
  { name: 'Silver', divisions: 4, rpPerDivision: 400, color: '#c0c0c0' },
  { name: 'Gold', divisions: 4, rpPerDivision: 500, color: '#ffd700' },
  { name: 'Platinum', divisions: 4, rpPerDivision: 600, color: '#00ced1' },
  { name: 'Diamond', divisions: 4, rpPerDivision: 700, color: '#00bfff' },
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
  NEUTRAL_BAND: 0.05,                 // +/- 5%
  MIN_GAMES_FOR_LEGEND_COMPARE: 5,
  MIN_LEGENDS_FOR_COMPARISON: 3,
  MIN_DEATHS_FOR_TIMING: 10,
  TREND_SESSIONS_REQUIRED: 3,
  LEGEND_PERFORMANCE_GAP: 0.20,       // 20% gap triggers suggestion
} as const;
