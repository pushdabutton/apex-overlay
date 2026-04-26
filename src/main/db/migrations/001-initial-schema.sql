-- ============================================================
-- Migration 001: Initial Schema
-- ============================================================

-- Matches: one row per completed game
CREATE TABLE IF NOT EXISTS matches (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id        TEXT UNIQUE,
    session_id      INTEGER NOT NULL,
    legend          TEXT NOT NULL,
    map             TEXT,
    mode            TEXT DEFAULT 'unknown',
    placement       INTEGER,
    kills           INTEGER DEFAULT 0,
    deaths          INTEGER DEFAULT 0,
    assists         INTEGER DEFAULT 0,
    damage          INTEGER DEFAULT 0,
    headshots       INTEGER DEFAULT 0,
    shots_fired     INTEGER DEFAULT 0,
    shots_hit       INTEGER DEFAULT 0,
    knockdowns      INTEGER DEFAULT 0,
    revives         INTEGER DEFAULT 0,
    respawns        INTEGER DEFAULT 0,
    survival_time   INTEGER DEFAULT 0,
    rp_change       INTEGER,
    duration        INTEGER DEFAULT 0,
    started_at      TEXT NOT NULL,
    ended_at        TEXT,
    created_at      TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_matches_session ON matches(session_id);
CREATE INDEX IF NOT EXISTS idx_matches_legend ON matches(legend);
CREATE INDEX IF NOT EXISTS idx_matches_started ON matches(started_at);
CREATE INDEX IF NOT EXISTS idx_matches_mode ON matches(mode);

-- Sessions: one row per play session
CREATE TABLE IF NOT EXISTS sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at      TEXT NOT NULL,
    ended_at        TEXT,
    matches_played  INTEGER DEFAULT 0,
    total_kills     INTEGER DEFAULT 0,
    total_deaths    INTEGER DEFAULT 0,
    total_assists   INTEGER DEFAULT 0,
    total_damage    INTEGER DEFAULT 0,
    total_headshots INTEGER DEFAULT 0,
    avg_placement   REAL,
    best_placement  INTEGER,
    total_rp_change INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now'))
);

-- Legend stats: aggregated lifetime stats per legend
CREATE TABLE IF NOT EXISTS legend_stats (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    legend          TEXT UNIQUE NOT NULL,
    games_played    INTEGER DEFAULT 0,
    total_kills     INTEGER DEFAULT 0,
    total_deaths    INTEGER DEFAULT 0,
    total_assists   INTEGER DEFAULT 0,
    total_damage    INTEGER DEFAULT 0,
    total_headshots INTEGER DEFAULT 0,
    total_wins      INTEGER DEFAULT 0,
    avg_damage      REAL DEFAULT 0,
    avg_kills       REAL DEFAULT 0,
    avg_placement   REAL,
    best_damage     INTEGER DEFAULT 0,
    best_kills      INTEGER DEFAULT 0,
    win_rate        REAL DEFAULT 0,
    last_played     TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

-- Coaching insights: generated tips and observations
CREATE TABLE IF NOT EXISTS coaching_insights (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id        INTEGER,
    session_id      INTEGER,
    type            TEXT NOT NULL,
    rule_id         TEXT NOT NULL,
    message         TEXT NOT NULL,
    severity        TEXT NOT NULL DEFAULT 'info',
    data_json       TEXT,
    dismissed       INTEGER DEFAULT 0,
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
    date            TEXT UNIQUE NOT NULL,
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

-- Player profile cache
CREATE TABLE IF NOT EXISTS player_profile (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    platform        TEXT NOT NULL,
    player_name     TEXT NOT NULL,
    player_uid      TEXT,
    level           INTEGER,
    rank_name       TEXT,
    rank_score      INTEGER,
    rank_division   INTEGER,
    data_json       TEXT,
    fetched_at      TEXT DEFAULT (datetime('now'))
);

-- App settings: key-value store
CREATE TABLE IF NOT EXISTS settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      TEXT DEFAULT (datetime('now'))
);
