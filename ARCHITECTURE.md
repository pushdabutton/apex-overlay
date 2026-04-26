# Apex Legends Coaching Overlay -- Architecture Document

**Status:** Proposed
**Version:** 1.0.0
**Architect:** architect-agent
**Target Platform:** Overwolf Electron (ow-electron)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Project Structure](#2-project-structure)
3. [Data Flow Architecture](#3-data-flow-architecture)
4. [Overlay Window Architecture](#4-overlay-window-architecture)
5. [Database Schema](#5-database-schema)
6. [Coaching Engine](#6-coaching-engine)
7. [API Integration](#7-api-integration)
8. [Overwolf GEP Event Handling](#8-overwolf-gep-event-handling)
9. [Manifest & Configuration](#9-manifest--configuration)
10. [Component Hierarchy](#10-component-hierarchy)
11. [MVP Scope](#11-mvp-scope)
12. [Future Considerations](#12-future-considerations)

---

## 1. Overview

### Product Vision

An in-game coaching overlay for Apex Legends that delivers actionable performance insights -- not raw stat dumping, but contextual advice that helps players improve. The overlay watches your game, tracks your session, and tells you things like "your headshot rate dropped 5% this session" or "you perform 23% better on Horizon, consider switching."

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Runtime** | Overwolf Electron (ow-electron) | Anti-cheat safe, official game event pipeline, Electron-based for web tech |
| **UI Framework** | React 18 + TypeScript | Component model suits multi-window overlay architecture |
| **Styling** | Tailwind CSS 3 | Utility-first, small bundle, fast iteration |
| **Local Database** | better-sqlite3 | Synchronous SQLite for Electron main process, zero-config |
| **External API** | mozambiquehe.re (Apex Legends Status API) | Player stats, map rotation, crafting rotation |
| **Build** | Vite | Fast HMR, good Electron integration via electron-vite |
| **State Management** | Zustand | Lightweight, no boilerplate, works well across Electron windows |
| **IPC** | Electron IPC (contextBridge) | Secure main-renderer communication |

### Key Architectural Decisions

**ADR-001: SQLite over IndexedDB.** SQLite via better-sqlite3 runs in the main process with synchronous reads. Match data is written from the main process (where GEP events arrive), so keeping the DB in main avoids async IPC round-trips for every event. Renderer windows query via IPC request-response.

**ADR-002: Zustand over Redux.** The overlay has 4 windows sharing lightweight state (current match stats, session summary, settings). Zustand's 1KB footprint and zero-boilerplate API is appropriate. Redux's middleware ecosystem is unnecessary here.

**ADR-003: Rules-based coaching engine over ML.** MVP uses deterministic rules (thresholds, comparisons, trends). This is debuggable, transparent, and ships fast. ML-based insights are a Phase 2 concern.

**ADR-004: Event-driven architecture with local event bus.** GEP events from Overwolf flow into an EventProcessor in main, which emits normalized domain events. The DB layer, coaching engine, and UI notification system all subscribe independently. This decouples ingestion from processing.

---

## 2. Project Structure

```
apex-overlay/
|
|-- ARCHITECTURE.md              # This document
|-- package.json                 # Project manifest
|-- tsconfig.json                # TypeScript config
|-- tailwind.config.js           # Tailwind configuration
|-- postcss.config.js            # PostCSS for Tailwind
|-- vite.config.ts               # Vite build config
|-- electron-builder.yml         # Electron packaging config
|-- overwolf.manifest.json       # Overwolf app manifest (GEP declarations)
|
|-- src/
|   |-- main/                    # Electron main process
|   |   |-- index.ts             # Main entry: creates windows, initializes GEP
|   |   |-- windows.ts           # Window creation & management
|   |   |-- ipc-handlers.ts      # IPC handler registration
|   |   |
|   |   |-- gep/                 # Game Event Provider integration
|   |   |   |-- gep-manager.ts   # GEP lifecycle (init, register, listen)
|   |   |   |-- event-map.ts     # Apex event ID -> domain event mapping
|   |   |   |-- event-processor.ts  # Raw GEP event -> normalized domain events
|   |   |
|   |   |-- db/                  # Database layer (main process only)
|   |   |   |-- database.ts      # SQLite connection, migrations
|   |   |   |-- migrations/      # SQL migration files
|   |   |   |   |-- 001-initial-schema.sql
|   |   |   |-- repositories/    # Data access objects
|   |   |   |   |-- match-repo.ts
|   |   |   |   |-- session-repo.ts
|   |   |   |   |-- legend-stats-repo.ts
|   |   |   |   |-- coaching-repo.ts
|   |   |
|   |   |-- coaching/            # Coaching engine (main process)
|   |   |   |-- engine.ts        # Orchestrates all rule evaluators
|   |   |   |-- rules/           # Individual rule modules
|   |   |   |   |-- session-comparison.ts    # Current vs 7-day average
|   |   |   |   |-- trend-detection.ts       # Improving/declining detection
|   |   |   |   |-- legend-recommendation.ts # Legend-specific advice
|   |   |   |   |-- death-timing.ts          # Early vs late game deaths
|   |   |   |   |-- weapon-performance.ts    # Weapon accuracy trends
|   |   |   |-- types.ts         # Insight types, severity levels
|   |   |
|   |   |-- api/                 # External API integration
|   |   |   |-- mozambique-client.ts   # API client for mozambiquehe.re
|   |   |   |-- api-cache.ts           # Response caching layer
|   |   |   |-- api-scheduler.ts       # Polling intervals, rate limiting
|   |
|   |-- renderer/                # React UI (renderer processes)
|   |   |-- index.html           # HTML shell (shared by all windows)
|   |   |-- main.tsx             # React entry point
|   |   |-- App.tsx              # Router: renders correct window based on query param
|   |   |
|   |   |-- windows/             # One component tree per overlay window
|   |   |   |-- MainOverlay/     # Compact in-match HUD
|   |   |   |   |-- MainOverlay.tsx
|   |   |   |   |-- SessionTracker.tsx
|   |   |   |   |-- MapRotation.tsx
|   |   |   |   |-- RankedProgress.tsx
|   |   |   |   |-- CoachingAlert.tsx
|   |   |   |
|   |   |   |-- PostMatch/      # Post-match summary screen
|   |   |   |   |-- PostMatch.tsx
|   |   |   |   |-- MatchSummary.tsx
|   |   |   |   |-- PerformanceBenchmark.tsx
|   |   |   |   |-- CoachingTips.tsx
|   |   |   |   |-- LegendComparison.tsx
|   |   |   |
|   |   |   |-- SessionDashboard/ # Between-match dashboard
|   |   |   |   |-- SessionDashboard.tsx
|   |   |   |   |-- SessionStats.tsx
|   |   |   |   |-- TrendCharts.tsx
|   |   |   |   |-- RankedTracker.tsx
|   |   |   |
|   |   |   |-- Settings/       # Configuration panel
|   |   |   |   |-- Settings.tsx
|   |   |   |   |-- GeneralSettings.tsx
|   |   |   |   |-- OverlaySettings.tsx
|   |   |   |   |-- ApiKeySettings.tsx
|   |   |
|   |   |-- components/         # Shared UI components
|   |   |   |-- StatCard.tsx
|   |   |   |-- TrendIndicator.tsx
|   |   |   |-- InsightBadge.tsx
|   |   |   |-- ProgressBar.tsx
|   |   |   |-- LegendIcon.tsx
|   |   |   |-- MapCard.tsx
|   |   |   |-- CraftingRotation.tsx
|   |   |
|   |   |-- hooks/              # Custom React hooks
|   |   |   |-- useMatchData.ts
|   |   |   |-- useSessionStats.ts
|   |   |   |-- useCoachingInsights.ts
|   |   |   |-- useMapRotation.ts
|   |   |   |-- useIpc.ts       # Generic IPC hook
|   |   |
|   |   |-- stores/             # Zustand state stores
|   |   |   |-- match-store.ts   # Current match state
|   |   |   |-- session-store.ts # Session aggregates
|   |   |   |-- ui-store.ts      # Window visibility, positions
|   |   |   |-- api-store.ts     # Cached API data (map rotation, etc.)
|   |   |
|   |   |-- styles/
|   |   |   |-- globals.css      # Tailwind directives + overlay base styles
|   |   |   |-- overlay-theme.css # Semi-transparent dark theme for in-game
|   |
|   |-- shared/                  # Types/constants shared between main & renderer
|   |   |-- types.ts             # Domain types (Match, Session, Legend, Insight, etc.)
|   |   |-- constants.ts         # Game constants (legends list, rank tiers, etc.)
|   |   |-- ipc-channels.ts      # IPC channel name constants
|   |   |-- utils.ts             # Pure utility functions
|
|-- assets/                      # Static assets
|   |-- icons/                   # App icons (various sizes for Overwolf)
|   |-- legends/                 # Legend portrait thumbnails
|   |-- ranks/                   # Rank tier icons
|
|-- tests/                       # Test files
|   |-- coaching/                # Coaching engine unit tests
|   |   |-- session-comparison.test.ts
|   |   |-- trend-detection.test.ts
|   |   |-- legend-recommendation.test.ts
|   |-- db/                      # Repository tests
|   |   |-- match-repo.test.ts
|   |-- gep/                     # Event processing tests
|   |   |-- event-processor.test.ts
|
|-- scripts/                     # Development & build scripts
|   |-- dev.ts                   # Start dev environment
|   |-- build.ts                 # Production build
|   |-- migrate.ts               # Run DB migrations manually
```

---

## 3. Data Flow Architecture

### 3.1 Primary Data Flow (Game Events -> UI)

```
+------------------------------------------------------------------+
|                     OVERWOLF ELECTRON (Main Process)               |
|                                                                    |
|  +-------------------+     +---------------------+                 |
|  |  Overwolf GEP     |---->|  Event Processor    |                 |
|  |  (Game Events)    |     |  (Normalize + Map)  |                 |
|  +-------------------+     +----------+----------+                 |
|                                       |                            |
|                            Domain Events Bus                       |
|                    +----------+-------+----------+                 |
|                    |          |                   |                 |
|             +------v---+ +---v---------+ +-------v---------+       |
|             | DB Layer | | Coaching    | | Window Manager  |       |
|             | (SQLite) | | Engine      | | (IPC broadcast) |       |
|             +------+---+ +---+---------+ +-------+---------+       |
|                    |         |                    |                 |
|                    |    +----v--------+           |                 |
|                    +--->| Insight     |           |                 |
|                         | Repository  |           |                 |
|                         +----+--------+           |                 |
|                              |                    |                 |
+------------------------------+--------------------+----------------+
                               |                    |
                          IPC (contextBridge)        |
                               |                    |
+------------------------------v--------------------v----------------+
|                    RENDERER PROCESSES                               |
|                                                                    |
|  +------------------+  +------------------+  +------------------+  |
|  | Main Overlay     |  | Post-Match       |  | Session          |  |
|  | (in-match HUD)   |  | Summary          |  | Dashboard        |  |
|  |                   |  |                  |  |                  |  |
|  | - Session tracker |  | - Match stats    |  | - Session stats  |  |
|  | - Map rotation    |  | - Benchmarks     |  | - Trend charts   |  |
|  | - Ranked progress |  | - Coaching tips  |  | - Ranked tracker |  |
|  | - Coaching alerts |  | - Legend compare  |  |                  |  |
|  +------------------+  +------------------+  +------------------+  |
|                                                                    |
+--------------------------------------------------------------------+
```

### 3.2 API Data Flow (External Stats -> Cache -> UI)

```
+-----------------------+        +-------------------+
| mozambiquehe.re API   |<-------|  API Scheduler    |
| (Player Stats,        |        |  (Polling Logic)  |
|  Map Rotation,        |        |  - On app start   |
|  Crafting Rotation)   |        |  - Every 60s maps |
+-----------+-----------+        |  - Between matches|
            |                    +--------+----------+
            | HTTP Response               |
            |                    Triggers poll
+-----------v-----------+                 |
|    API Cache          |        +--------+----------+
|    (In-memory +       |        | Match Lifecycle   |
|     SQLite fallback)  |        | (match_end event) |
+-----------+-----------+        +-------------------+
            |
      IPC broadcast
            |
+-----------v-----------+
|   Renderer Stores     |
|   (api-store.ts)      |
+-----------------------+
```

### 3.3 Event Processing Pipeline (Detail)

```
Raw GEP Event (e.g., "kill" with payload)
        |
        v
+---[ event-map.ts ]---+
| Maps GEP event IDs   |
| to domain event names |
| e.g., "kill" -> {     |
|   type: "PLAYER_KILL",|
|   victim, weapon,     |
|   headshot, timestamp }|
+-----------+-----------+
            |
            v
+---[ event-processor.ts ]---+
| Validates payload          |
| Enriches with context:     |
|   - current match ID       |
|   - elapsed match time     |
|   - current legend         |
| Emits normalized event     |
+----------------------------+
            |
     EventEmitter.emit()
            |
     +------+------+------+
     |             |             |
     v             v             v
  DB Write    Coaching Eval   UI Update
(match-repo)  (engine.ts)   (IPC send)
```

---

## 4. Overlay Window Architecture

### 4.1 Window Definitions

| Window | Visibility | Size | Position | Purpose |
|--------|-----------|------|----------|---------|
| **Main Overlay** | During match | 320x480px | Top-right (draggable) | Compact live stats HUD |
| **Post-Match** | After match end, auto-dismiss after 60s or click | 600x700px | Center | Full match analysis + coaching |
| **Session Dashboard** | Between matches (lobby) | 800x600px | Center (draggable) | Session-level stats + trends |
| **Settings** | On hotkey (Ctrl+Shift+S) | 500x600px | Center | Configuration |

### 4.2 Window Lifecycle

```
App Start
    |
    v
[Settings check: API key configured?]
    |-- No --> Open Settings window (first-run setup)
    |-- Yes --> Initialize GEP, start API scheduler
    |
    v
[Game state: In lobby]
    |
    |--> Session Dashboard visible
    |
    v
[GEP event: match_start]
    |
    |--> Hide Session Dashboard
    |--> Show Main Overlay
    |--> Begin match tracking (reset live counters)
    |
    v
[During match: GEP events stream in]
    |
    |--> Main Overlay updates in real-time
    |--> Coaching alerts appear on Main Overlay
    |
    v
[GEP event: match_end]
    |
    |--> Persist match to DB
    |--> Run coaching engine (post-match rules)
    |--> Hide Main Overlay
    |--> Show Post-Match summary
    |--> Update session aggregates
    |
    v
[Post-Match dismissed (timeout or click)]
    |
    |--> Show Session Dashboard (updated with new match)
    |--> API scheduler: refresh player stats
    |
    v
[Next match_start or app close]
```

### 4.3 Window Communication

All windows share state via IPC. The main process is the single source of truth. Renderer windows never talk to each other directly.

```
Main Process (source of truth)
    |
    |-- IPC channel: "match:update"     --> Main Overlay subscribes
    |-- IPC channel: "match:end"        --> Post-Match subscribes
    |-- IPC channel: "session:update"   --> Session Dashboard subscribes
    |-- IPC channel: "coaching:insight"  --> Main Overlay + Post-Match subscribe
    |-- IPC channel: "api:map-rotation" --> Main Overlay subscribes
    |-- IPC channel: "api:crafting"     --> Main Overlay subscribes
    |
    |-- IPC channel: "settings:get"     <-- Settings requests
    |-- IPC channel: "settings:set"     <-- Settings writes
    |-- IPC channel: "db:query"         <-- Any window requests historical data
```

---

## 5. Database Schema

### 5.1 SQL CREATE Statements

```sql
-- ============================================================
-- Migration 001: Initial Schema
-- ============================================================

-- Matches: one row per completed game
CREATE TABLE IF NOT EXISTS matches (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id        TEXT UNIQUE,              -- GEP-provided match identifier (if available)
    session_id      INTEGER NOT NULL,
    legend          TEXT NOT NULL,             -- e.g., "Horizon", "Wraith"
    map             TEXT,                      -- e.g., "World's Edge", "Storm Point"
    mode            TEXT DEFAULT 'unknown',    -- "battle_royale", "ranked", "arenas", "ltm"
    placement       INTEGER,                  -- 1-20 for BR, NULL for arenas
    kills           INTEGER DEFAULT 0,
    deaths          INTEGER DEFAULT 0,        -- 0 or 1 in BR (died or survived)
    assists         INTEGER DEFAULT 0,
    damage          INTEGER DEFAULT 0,
    headshots       INTEGER DEFAULT 0,
    shots_fired     INTEGER DEFAULT 0,        -- for accuracy calculation
    shots_hit       INTEGER DEFAULT 0,
    knockdowns      INTEGER DEFAULT 0,
    revives         INTEGER DEFAULT 0,
    respawns        INTEGER DEFAULT 0,
    survival_time   INTEGER DEFAULT 0,        -- seconds survived in match
    rp_change       INTEGER,                  -- ranked points gained/lost (NULL if not ranked)
    duration        INTEGER DEFAULT 0,        -- total match duration in seconds
    started_at      TEXT NOT NULL,             -- ISO 8601 timestamp
    ended_at        TEXT,                      -- ISO 8601 timestamp
    created_at      TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_matches_session ON matches(session_id);
CREATE INDEX IF NOT EXISTS idx_matches_legend ON matches(legend);
CREATE INDEX IF NOT EXISTS idx_matches_started ON matches(started_at);
CREATE INDEX IF NOT EXISTS idx_matches_mode ON matches(mode);

-- Sessions: one row per play session (app open to close, or gap > 30 min)
CREATE TABLE IF NOT EXISTS sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at      TEXT NOT NULL,             -- ISO 8601
    ended_at        TEXT,                      -- ISO 8601, NULL if active
    matches_played  INTEGER DEFAULT 0,
    total_kills     INTEGER DEFAULT 0,
    total_deaths    INTEGER DEFAULT 0,
    total_assists   INTEGER DEFAULT 0,
    total_damage    INTEGER DEFAULT 0,
    total_headshots INTEGER DEFAULT 0,
    avg_placement   REAL,                     -- running average
    best_placement  INTEGER,
    total_rp_change INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now'))
);

-- Legend stats: aggregated lifetime stats per legend (updated after each match)
CREATE TABLE IF NOT EXISTS legend_stats (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    legend          TEXT UNIQUE NOT NULL,
    games_played    INTEGER DEFAULT 0,
    total_kills     INTEGER DEFAULT 0,
    total_deaths    INTEGER DEFAULT 0,
    total_assists   INTEGER DEFAULT 0,
    total_damage    INTEGER DEFAULT 0,
    total_headshots INTEGER DEFAULT 0,
    total_wins      INTEGER DEFAULT 0,        -- placement = 1
    avg_damage      REAL DEFAULT 0,
    avg_kills       REAL DEFAULT 0,
    avg_placement   REAL,
    best_damage     INTEGER DEFAULT 0,
    best_kills      INTEGER DEFAULT 0,
    win_rate        REAL DEFAULT 0,           -- total_wins / games_played
    last_played     TEXT,                     -- ISO 8601
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

-- Coaching insights: generated tips and observations
CREATE TABLE IF NOT EXISTS coaching_insights (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id        INTEGER,                  -- NULL for session-level insights
    session_id      INTEGER,                  -- NULL for match-level insights
    type            TEXT NOT NULL,             -- category of insight (see enum below)
    rule_id         TEXT NOT NULL,             -- which rule generated this
    message         TEXT NOT NULL,             -- human-readable coaching message
    severity        TEXT NOT NULL DEFAULT 'info',  -- 'info', 'suggestion', 'warning', 'achievement'
    data_json       TEXT,                      -- JSON blob with supporting data
    dismissed       INTEGER DEFAULT 0,         -- user dismissed this insight
    created_at      TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (match_id) REFERENCES matches(id),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_insights_match ON coaching_insights(match_id);
CREATE INDEX IF NOT EXISTS idx_insights_session ON coaching_insights(session_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON coaching_insights(type);
CREATE INDEX IF NOT EXISTS idx_insights_severity ON coaching_insights(severity);

-- Daily aggregates: pre-computed daily summaries for trend analysis
CREATE TABLE IF NOT EXISTS daily_aggregates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    date            TEXT UNIQUE NOT NULL,      -- YYYY-MM-DD
    games_played    INTEGER DEFAULT 0,
    total_kills     INTEGER DEFAULT 0,
    total_deaths    INTEGER DEFAULT 0,
    total_damage    INTEGER DEFAULT 0,
    total_headshots INTEGER DEFAULT 0,
    avg_placement   REAL,
    total_rp_change INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

-- Player profile cache: stores mozambiquehe.re API data
CREATE TABLE IF NOT EXISTS player_profile (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    platform        TEXT NOT NULL,             -- "PC", "PS4", "X1"
    player_name     TEXT NOT NULL,
    player_uid      TEXT,
    level           INTEGER,
    rank_name       TEXT,                      -- e.g., "Diamond IV"
    rank_score      INTEGER,                   -- current RP
    rank_division   INTEGER,
    data_json       TEXT,                      -- full API response cached as JSON
    fetched_at      TEXT DEFAULT (datetime('now'))
);

-- App settings: key-value store for user preferences
CREATE TABLE IF NOT EXISTS settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      TEXT DEFAULT (datetime('now'))
);
```

### 5.2 Coaching Insight Types (Enum)

```typescript
enum InsightType {
  SESSION_VS_AVERAGE    = 'session_vs_average',     // "Your kills are 20% above your 7-day avg"
  TREND_IMPROVING       = 'trend_improving',         // "Your damage has improved 3 sessions in a row"
  TREND_DECLINING       = 'trend_declining',         // "Headshot rate dropped 5% this session"
  LEGEND_RECOMMENDATION = 'legend_recommendation',   // "You perform 23% better on Horizon"
  DEATH_TIMING          = 'death_timing',            // "60% of your deaths are in the first 3 minutes"
  WEAPON_PERFORMANCE    = 'weapon_performance',      // "Your accuracy with R-301 is above average"
  PLACEMENT_PATTERN     = 'placement_pattern',       // "You place top-5 more often on World's Edge"
  ACHIEVEMENT           = 'achievement',             // "New personal best: 2,847 damage!"
  RANKED_MILESTONE      = 'ranked_milestone',        // "3 more wins at this pace = Diamond III"
}

enum InsightSeverity {
  INFO        = 'info',          // Neutral observation
  SUGGESTION  = 'suggestion',    // Actionable advice
  WARNING     = 'warning',       // Declining performance alert
  ACHIEVEMENT = 'achievement',   // Positive milestone
}
```

---

## 6. Coaching Engine

### 6.1 Architecture

The coaching engine is a rules-based evaluation system that runs in the main process. It receives domain events and match/session data, applies rules, and produces coaching insights.

```
+---[ CoachingEngine ]---+
|                        |
|  evaluatePostMatch()   |-----> called after every match_end
|  evaluateSession()     |-----> called on session close or on-demand
|  evaluateRealTime()    |-----> called during match on key events
|                        |
|  Rules:                |
|  +-- SessionComparison |  Compare this session to 7-day rolling averages
|  +-- TrendDetection    |  3+ session trend detection (improving/declining)
|  +-- LegendRecommend   |  Legend-specific performance comparison
|  +-- DeathTiming       |  Early vs late game death analysis
|  +-- WeaponPerformance |  Accuracy and weapon selection insights
|  +-- PlacementPattern  |  Map-specific placement trends
|  +-- Achievements      |  Personal bests, milestones
|  +-- RankedProgress    |  RP projections, tier estimates
+-----------+------------+
            |
            v
    coaching_insights table
            +
    IPC broadcast to UI
```

### 6.2 Rule Definitions

#### Rule 1: Session Comparison (`session-comparison.ts`)

**Trigger:** After each match and on session summary.

**Logic:**
```
For each metric (kills, damage, headshots, placement):
  1. Query 7-day rolling average from daily_aggregates
  2. Compare current session average to 7-day average
  3. If delta > +15%: emit ACHIEVEMENT ("Your {metric} is {delta}% above your weekly average!")
  4. If delta < -15%: emit WARNING ("Your {metric} dropped {abs(delta)}% vs your weekly average")
  5. If delta between -5% and +5%: emit INFO ("Consistent {metric} performance this session")
```

**Thresholds (configurable):**
- Significant positive: +15%
- Significant negative: -15%
- Neutral band: -5% to +5%

#### Rule 2: Trend Detection (`trend-detection.ts`)

**Trigger:** On session close or after 3+ matches in current session.

**Logic:**
```
For each metric:
  1. Query last 5 sessions from sessions table
  2. Calculate linear regression slope
  3. If 3+ consecutive sessions trending up: emit TREND_IMPROVING
  4. If 3+ consecutive sessions trending down: emit TREND_DECLINING
  5. Include magnitude: "steadily", "significantly", "slightly"
```

**Example outputs:**
- "Your average damage has steadily improved over the last 4 sessions (+127 avg)"
- "Your headshot rate has been declining for 3 sessions (-4.2%)"

#### Rule 3: Legend Recommendation (`legend-recommendation.ts`)

**Trigger:** Post-match, if player has 5+ games on at least 3 legends.

**Logic:**
```
1. Query legend_stats for all legends with games_played >= 5
2. Rank by composite score: (avg_kills * 0.3) + (avg_damage * 0.3) + (win_rate * 0.4)
3. Compare current legend to best-performing legend
4. If current legend is not in top 3 AND performance gap > 20%:
   emit SUGGESTION ("You average {delta}% more damage on {best_legend}. Consider switching?")
5. If current legend IS the best: emit ACHIEVEMENT ("You're on your best legend right now!")
```

#### Rule 4: Death Timing (`death-timing.ts`)

**Trigger:** Post-match, after accumulating 10+ deaths across matches.

**Logic:**
```
1. Track survival_time for each match where death occurred
2. Bucket deaths: early (0-3 min), mid (3-10 min), late (10+ min)
3. If early deaths > 50% of total: emit WARNING
   ("60% of your deaths happen in the first 3 minutes. Consider landing safer or looting longer.")
4. If late deaths dominant: emit INFO
   ("Most of your deaths come in endgame fights. You're surviving well but may need endgame positioning work.")
```

#### Rule 5: Weapon Performance (`weapon-performance.ts`)

**Trigger:** Post-match (requires weapon-specific kill/damage events from GEP).

**Logic:**
```
1. Track accuracy (shots_hit / shots_fired) per weapon category
2. Compare to session average
3. If a weapon category accuracy < 60% of player's average:
   emit SUGGESTION ("Your shotgun accuracy is low this session. Consider focusing on close-range tracking.")
4. Track kill weapon distribution to identify preferred weapons
```

*Note: Weapon-specific GEP data may be limited. This rule degrades gracefully when data is unavailable.*

#### Rule 6: Ranked Progress (`ranked-progress.ts`)

**Trigger:** After ranked matches.

**Logic:**
```
1. Track rp_change per match
2. Calculate average RP gain/loss over session
3. If avg RP > 0: project games to next rank tier
   emit INFO ("At your current pace, {N} more games to {next_tier}")
4. If avg RP < 0: emit WARNING
   ("You've lost {total} RP this session. Consider taking a break or switching modes.")
```

### 6.3 Rule Evaluation Priority

Rules are evaluated in dependency order. Some rules depend on data from earlier rules.

```
1. Achievements (personal bests -- evaluated first, always positive)
2. Session Comparison (core metric comparison)
3. Trend Detection (multi-session trends)
4. Legend Recommendation (legend-level analysis)
5. Death Timing (survival analysis)
6. Weapon Performance (accuracy analysis)
7. Ranked Progress (RP projections)
```

### 6.4 Insight Deduplication

The engine maintains a deduplication window: identical rule_id + type combinations are suppressed within the same session to avoid spamming the player. Exception: ACHIEVEMENT severity is never suppressed.

---

## 7. API Integration

### 7.1 mozambiquehe.re API Client

**Base URL:** `https://api.mozambiquehe.re`

**Authentication:** API key passed as `Authorization` header.

**Endpoints Used:**

| Endpoint | Method | Purpose | Poll Frequency |
|----------|--------|---------|----------------|
| `/bridge?player={name}&platform={platform}` | GET | Player profile + stats | On app start, between matches |
| `/maprotation?version=2` | GET | Current map rotation (BR + Ranked + LTM) | Every 60 seconds |
| `/crafting` | GET | Current crafting rotation | Every 300 seconds (5 min) |

### 7.2 Caching Strategy

```typescript
interface CacheEntry<T> {
  data: T;
  fetchedAt: number;       // Unix timestamp
  ttlMs: number;           // Time-to-live in milliseconds
  staleWhileRevalidate: boolean;
}

// Cache TTLs
const CACHE_CONFIG = {
  playerProfile: { ttlMs: 5 * 60 * 1000, staleWhileRevalidate: true },   // 5 min, serve stale
  mapRotation:   { ttlMs: 60 * 1000, staleWhileRevalidate: true },       // 1 min, serve stale
  crafting:      { ttlMs: 5 * 60 * 1000, staleWhileRevalidate: false },  // 5 min, hard refresh
};
```

**Cache layers:**
1. **In-memory cache** (primary): Fast reads during active session
2. **SQLite fallback** (player_profile table): Survives app restart, used for offline boot

### 7.3 Rate Limiting

The mozambiquehe.re API has a rate limit of ~2 requests/second for free tier.

**Strategy:**
- Queue all API requests through `api-scheduler.ts`
- Minimum 500ms between requests
- Exponential backoff on 429 responses (1s, 2s, 4s, max 30s)
- Pre-match burst: allow 3 rapid requests at match end (profile refresh, map, crafting)

### 7.4 Error Handling

```
API call fails:
  |
  |-- Network error --> Use cached data, show "offline" indicator, retry in 30s
  |-- 429 rate limit --> Backoff, use cached data
  |-- 404 not found --> Player name may be wrong, prompt in Settings
  |-- 500 server error --> Use cached data, retry in 60s
  |-- Invalid API key --> Prompt Settings panel, disable API features
```

### 7.5 API Data Flow (Sequence)

```
App Start
    |
    v
[Read settings: API key + player name + platform]
    |
    |-- Missing? --> Open Settings (first-run flow)
    |
    v
[Fetch player profile] --> Cache + broadcast to renderers
    |
    v
[Start polling loop]
    |-- Every 60s: map rotation
    |-- Every 300s: crafting rotation
    |-- On match_end: player profile refresh
```

---

## 8. Overwolf GEP Event Handling

### 8.1 Supported Game Events (Apex Legends)

Overwolf's Game Event Provider for Apex Legends exposes the following events. We subscribe to a curated subset.

#### Events We Subscribe To

| GEP Event | Domain Event | Data Extracted | Used By |
|-----------|-------------|----------------|---------|
| `match_start` | `MATCH_START` | timestamp, mode | Window manager, session tracker |
| `match_end` | `MATCH_END` | timestamp | Window manager, DB persist, coaching |
| `kill` | `PLAYER_KILL` | victim, weapon, headshot | Match stats, weapon tracking |
| `death` | `PLAYER_DEATH` | attacker, weapon | Match stats, death timing |
| `assist` | `PLAYER_ASSIST` | - | Match stats |
| `knockdown` | `PLAYER_KNOCKDOWN` | victim | Match stats |
| `damage` | `DAMAGE_DEALT` | amount, target, weapon | Damage tracker |
| `revive` | `PLAYER_REVIVE` | teammate | Match stats |
| `respawn` | `PLAYER_RESPAWN` | teammate | Match stats |
| `legend_select` | `LEGEND_SELECTED` | legend_name | Legend tracking |
| `rank` | `RANK_UPDATE` | rank_name, rank_score | Ranked tracker |
| `placement` | `MATCH_PLACEMENT` | position | Match stats |
| `phase` | `GAME_PHASE` | phase_name (lobby, legend_select, playing) | Window lifecycle |

#### Events We Monitor But Do Not Store (Phase 2)

| GEP Event | Reason for Deferral |
|-----------|-------------------|
| `inventory_change` | Complex weapon loadout tracking -- Phase 2 |
| `location` | Heatmap generation -- Phase 2 |
| `roster` | Squad composition analysis -- Phase 2 |

### 8.2 GEP Initialization

```typescript
// gep-manager.ts (pseudocode)

import { overwolf } from '@aspect-build/aspect-overwolf-electron';

class GEPManager {
  private readonly GAME_ID = 21170; // Apex Legends
  private processor: EventProcessor;

  async initialize(): Promise<void> {
    // 1. Register required features
    await overwolf.games.events.setRequiredFeatures([
      'kill',
      'death',
      'assist',
      'knockdown',
      'damage',
      'revive',
      'respawn',
      'match_info',      // match_start, match_end, mode
      'game_info',       // legend_select, phase
      'rank',
      'me',              // player name, platform
    ]);

    // 2. Subscribe to events
    overwolf.games.events.onNewEvents.addListener((event) => {
      this.processor.processEvent(event);
    });

    // 3. Subscribe to info updates (some data comes as info, not events)
    overwolf.games.events.onInfoUpdates2.addListener((info) => {
      this.processor.processInfoUpdate(info);
    });
  }
}
```

### 8.3 Event Processing Architecture

```
+---[ GEP Raw Event ]---+
| { name: "kill",        |
|   data: "{"victim":   |
|   "Player123"}" }      |
+----------+------------+
           |
           v
+---[ event-map.ts ]-----+
| Parse JSON payload      |
| Map to domain event:    |
| { type: PLAYER_KILL,    |
|   victim: "Player123",  |
|   weapon: "R-301",      |
|   headshot: true,       |
|   timestamp: Date.now() |
|   matchTime: 142 }      |
+----------+--------------+
           |
           v
+---[ event-processor.ts ]---+
| Validate required fields   |
| Enrich with context:       |
|   - currentMatchId         |
|   - currentLegend          |
|   - matchElapsedTime       |
| Route to handlers:         |
|   - dbHandler (persist)    |
|   - coachingHandler (eval) |
|   - uiHandler (broadcast)  |
+----------------------------+
```

### 8.4 Match State Machine

```
                IDLE
                 |
                 | (game_phase: legend_select)
                 v
          LEGEND_SELECT
                 |
                 | (legend_select event)
                 v
          MATCH_STARTING
                 |
                 | (match_start event)
                 v
          IN_MATCH  <----+
                 |       | (revive/respawn events)
                 |       |
                 | (death event) --> PLAYER_DEAD
                 |
                 | (match_end / placement event)
                 v
          MATCH_ENDED
                 |
                 | (persist to DB, run coaching, show post-match)
                 v
           POST_MATCH
                 |
                 | (timeout or dismiss)
                 v
                IDLE
```

---

## 9. Manifest & Configuration

### 9.1 Overwolf Manifest (`overwolf.manifest.json`)

```json
{
  "manifest_version": 1,
  "type": "Electron",
  "meta": {
    "name": "Apex Coach",
    "author": "PureBrain",
    "version": "1.0.0",
    "description": "Real-time coaching overlay for Apex Legends. Actionable insights, not just stats.",
    "icon": "assets/icons/icon-256.png"
  },
  "permissions": [
    "GameEvents"
  ],
  "data": {
    "game_targeting": {
      "game_ids": [21170]
    },
    "game_events": {
      "21170": {
        "features": [
          "kill",
          "death",
          "assist",
          "knockdown",
          "damage",
          "revive",
          "respawn",
          "match_info",
          "game_info",
          "rank",
          "me"
        ]
      }
    },
    "windows": {
      "main_overlay": {
        "file": "index.html?window=main-overlay",
        "transparent": true,
        "resizable": true,
        "override_on_update": true,
        "size": { "width": 320, "height": 480 },
        "min_size": { "width": 280, "height": 400 },
        "start_position": { "top": 10, "right": 10 },
        "topmost": true,
        "in_game_only": true,
        "clickthrough": false
      },
      "post_match": {
        "file": "index.html?window=post-match",
        "transparent": true,
        "resizable": true,
        "size": { "width": 600, "height": 700 },
        "start_position": "center",
        "topmost": true,
        "in_game_only": false
      },
      "session_dashboard": {
        "file": "index.html?window=session-dashboard",
        "transparent": true,
        "resizable": true,
        "size": { "width": 800, "height": 600 },
        "start_position": "center",
        "topmost": false,
        "in_game_only": false
      },
      "settings": {
        "file": "index.html?window=settings",
        "transparent": false,
        "resizable": false,
        "size": { "width": 500, "height": 600 },
        "start_position": "center",
        "topmost": true,
        "in_game_only": false
      }
    },
    "hotkeys": {
      "toggle_overlay": {
        "title": "Toggle Overlay",
        "default": "Ctrl+Shift+A",
        "action-type": "toggle",
        "game_ids": [21170]
      },
      "open_settings": {
        "title": "Open Settings",
        "default": "Ctrl+Shift+S",
        "action-type": "toggle",
        "game_ids": [21170]
      },
      "open_dashboard": {
        "title": "Open Dashboard",
        "default": "Ctrl+Shift+D",
        "action-type": "toggle",
        "game_ids": [21170]
      }
    },
    "launch_events": [
      { "event": "GameLaunch", "game_ids": [21170] }
    ]
  }
}
```

### 9.2 Default Settings

```typescript
const DEFAULT_SETTINGS: Record<string, string> = {
  // API
  'api.key': '',
  'api.playerName': '',
  'api.platform': 'PC',  // PC | PS4 | X1

  // Overlay appearance
  'overlay.opacity': '0.85',
  'overlay.scale': '1.0',
  'overlay.position': 'top-right',
  'overlay.showMapRotation': 'true',
  'overlay.showCraftingRotation': 'true',
  'overlay.showRankedProgress': 'true',

  // Coaching
  'coaching.enabled': 'true',
  'coaching.alertDuration': '5000',       // ms to show coaching alert
  'coaching.minSeverity': 'suggestion',   // minimum severity to display
  'coaching.postMatchAutoShow': 'true',
  'coaching.postMatchDismissTime': '60',  // seconds

  // Session
  'session.gapThreshold': '1800',         // 30 min gap = new session (seconds)
};
```

---

## 10. Component Hierarchy

### 10.1 React Component Tree

```
<App>                                    // Router based on ?window= query param
  |
  |-- window=main-overlay
  |   <MainOverlay>
  |     <SessionTracker>                 // kills / deaths / damage / assists this session
  |       <StatCard metric="kills" />
  |       <StatCard metric="deaths" />
  |       <StatCard metric="damage" />
  |       <StatCard metric="assists" />
  |       <TrendIndicator />             // up/down arrow vs session avg
  |     </SessionTracker>
  |     <MapRotation>                    // current + next map with countdown
  |       <MapCard current={true} />
  |       <MapCard current={false} />    // "next" preview
  |     </MapRotation>
  |     <RankedProgress>                 // current RP, tier, mini progress bar
  |       <ProgressBar />
  |     </RankedProgress>
  |     <CoachingAlert />                // toast-style coaching messages
  |     <CraftingRotation />             // compact crafting item list
  |   </MainOverlay>
  |
  |-- window=post-match
  |   <PostMatch>
  |     <MatchSummary>                   // headline stats for this match
  |       <StatCard /> (x6-8)
  |     </MatchSummary>
  |     <PerformanceBenchmark>           // this match vs your averages
  |       <StatCard withComparison />
  |       <TrendIndicator />
  |     </PerformanceBenchmark>
  |     <CoachingTips>                   // 1-3 actionable insights from coaching engine
  |       <InsightBadge />
  |     </CoachingTips>
  |     <LegendComparison>              // "you on this legend vs your best"
  |       <LegendIcon />
  |       <StatCard comparison />
  |     </LegendComparison>
  |   </PostMatch>
  |
  |-- window=session-dashboard
  |   <SessionDashboard>
  |     <SessionStats>                   // aggregate session stats
  |       <StatCard /> (x8)
  |     </SessionStats>
  |     <TrendCharts>                    // line charts: last 7 days of key metrics
  |       <DamageChart />
  |       <KillsChart />
  |       <PlacementChart />
  |     </TrendCharts>
  |     <RankedTracker>                  // detailed RP graph, tier info, projections
  |       <ProgressBar />
  |       <RPHistory />                  // sparkline of RP over session
  |     </RankedTracker>
  |   </SessionDashboard>
  |
  |-- window=settings
  |   <Settings>
  |     <ApiKeySettings>                 // API key input, player name, platform select
  |       <input type="password" />
  |       <input type="text" />
  |       <select />
  |     </ApiKeySettings>
  |     <GeneralSettings>                // session gap threshold, data management
  |       <input type="range" />
  |     </GeneralSettings>
  |     <OverlaySettings>                // opacity, scale, element toggles
  |       <input type="range" />
  |       <input type="checkbox" /> (x5)
  |     </OverlaySettings>
  |   </Settings>
```

### 10.2 Shared Component Library

| Component | Props | Purpose |
|-----------|-------|---------|
| `StatCard` | `label, value, previousValue?, trend?, compact?` | Universal stat display |
| `TrendIndicator` | `current, previous, format?` | Up/down arrow with percentage |
| `InsightBadge` | `insight: CoachingInsight` | Colored badge for coaching tips |
| `ProgressBar` | `current, max, label?, color?` | Generic progress visualization |
| `LegendIcon` | `legend: string, size?` | Legend portrait thumbnail |
| `MapCard` | `map: MapRotation, current: boolean` | Map name + time remaining |
| `CraftingRotation` | `items: CraftingItem[]` | Compact crafting display |

---

## 11. MVP Scope

### 11.1 What Ships in MVP

| Feature | Priority | Dependency |
|---------|----------|------------|
| **GEP event ingestion** (kills, deaths, damage, assists, placement, legend) | P0 | Overwolf SDK |
| **SQLite match persistence** | P0 | better-sqlite3 |
| **Session tracking** (auto-create, auto-close on 30min gap) | P0 | DB layer |
| **Main Overlay** (live session stats, compact HUD) | P0 | GEP + DB |
| **Post-Match Summary** (match stats vs personal averages) | P0 | DB + coaching engine |
| **Coaching: Session vs 7-day average** | P1 | daily_aggregates table |
| **Coaching: Legend recommendation** | P1 | legend_stats table |
| **Map rotation display** | P1 | mozambiquehe.re API |
| **Crafting rotation display** | P2 | mozambiquehe.re API |
| **Ranked progress tracker** | P1 | GEP rank events + API |
| **Settings panel** (API key, overlay config) | P1 | Settings store |
| **Session Dashboard** (between-match stats) | P2 | DB + charting |
| **Coaching: Trend detection** | P2 | 5+ sessions of data |
| **Coaching: Death timing analysis** | P2 | survival_time tracking |
| **Coaching: Weapon performance** | P3 | weapon-specific GEP data (limited) |

### 11.2 What Does NOT Ship in MVP

- Machine learning or AI-generated insights (Phase 2)
- Heatmaps or location-based analysis (Phase 2)
- Squad composition analysis (Phase 2)
- Social features (sharing stats, leaderboards) (Phase 3)
- Custom coaching rule authoring (Phase 3)
- Video clip integration (Phase 3)
- Multi-game support (Phase 4)

### 11.3 MVP Success Criteria

1. **App launches with Apex Legends** and registers GEP events successfully
2. **Kills, deaths, damage, assists** update in real-time on the Main Overlay
3. **Post-match summary** appears automatically with match stats + at least 1 coaching insight
4. **Map rotation** displays correctly with countdown timer
5. **Legend stats** accumulate correctly across matches
6. **No performance impact** -- overlay uses less than 50MB RAM, less than 2% CPU
7. **Data persists** across app restarts via SQLite

---

## 12. Future Considerations

### Performance Budget

| Resource | Budget | Monitoring |
|----------|--------|-----------|
| RAM | < 50MB (overlay windows combined) | Electron process.memoryUsage() |
| CPU | < 2% during match (event processing) | Performance.now() instrumentation |
| Disk (DB) | < 100MB after 1000 matches | DB size check on startup |
| Network | < 10 requests/minute to mozambiquehe.re | Request counter in api-scheduler |

### Data Retention

- Matches older than 90 days: archive to compressed backup, remove from active DB
- Daily aggregates: keep indefinitely (small footprint)
- Coaching insights: prune dismissed insights older than 30 days
- API cache: clear on every app start (fresh data preferred)

### Security Considerations

- API key stored in SQLite settings table (local only, not transmitted)
- No telemetry or data upload in MVP
- All processing is local -- no backend server required
- Overwolf Electron sandbox provides process isolation

### Upgrade Path to Phase 2

1. **Backend API**: Optional cloud sync for cross-device stats
2. **ML coaching**: Train on aggregated (anonymized) match data
3. **Heatmap generation**: Use GEP location events + canvas rendering
4. **Squad analysis**: Track roster events for team composition insights
5. **Community benchmarks**: Anonymous stat comparison ("you're in the top 15% for damage")

---

## Appendix A: IPC Channel Reference

```typescript
// src/shared/ipc-channels.ts

export const IPC = {
  // Main -> Renderer (broadcasts)
  MATCH_UPDATE:       'match:update',       // Live match stats update
  MATCH_START:        'match:start',        // Match began
  MATCH_END:          'match:end',          // Match ended (includes final stats)
  SESSION_UPDATE:     'session:update',     // Session aggregate refresh
  COACHING_INSIGHT:   'coaching:insight',   // New coaching insight generated
  API_MAP_ROTATION:   'api:map-rotation',   // Map rotation data updated
  API_CRAFTING:       'api:crafting',       // Crafting rotation data updated
  API_PLAYER_PROFILE: 'api:player-profile', // Player profile data updated
  GAME_PHASE:         'game:phase',         // Game phase changed

  // Renderer -> Main (requests)
  DB_QUERY:           'db:query',           // Generic DB query (with type-safe params)
  SETTINGS_GET:       'settings:get',       // Read setting value
  SETTINGS_SET:       'settings:set',       // Write setting value
  SETTINGS_GET_ALL:   'settings:get-all',   // Read all settings
  SESSION_HISTORY:    'session:history',    // Get recent sessions
  MATCH_HISTORY:      'match:history',      // Get matches for a session
  LEGEND_STATS:       'legend:stats',       // Get legend performance data
  INSIGHTS_HISTORY:   'insights:history',   // Get recent coaching insights
} as const;
```

## Appendix B: Type Definitions

```typescript
// src/shared/types.ts

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

export interface MapRotation {
  current: {
    map: string;
    remainingTimer: number;     // seconds remaining
    asset: string;              // map image URL from API
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

export type GameMode = 'battle_royale' | 'ranked' | 'arenas' | 'ltm' | 'unknown';

export type GamePhase = 'lobby' | 'legend_select' | 'playing' | 'post_match';

// Domain events emitted by EventProcessor
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
```

---

**End of Architecture Document**
