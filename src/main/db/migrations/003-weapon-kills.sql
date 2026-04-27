-- ============================================================
-- Migration 003: Weapon Kills Tracking Table
--
-- CRITICAL 1: The WeaponPerformanceRule was querying a
-- weapon_kills table that did not exist. This migration
-- creates it and adds indexes for efficient weapon queries.
-- ============================================================

CREATE TABLE IF NOT EXISTS weapon_kills (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id    INTEGER NOT NULL,
    session_id  INTEGER,
    weapon      TEXT NOT NULL,
    kills       INTEGER NOT NULL DEFAULT 1,
    headshots   INTEGER NOT NULL DEFAULT 0,
    damage      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (match_id) REFERENCES matches(id)
);

CREATE INDEX IF NOT EXISTS idx_weapon_kills_match ON weapon_kills(match_id);
CREATE INDEX IF NOT EXISTS idx_weapon_kills_weapon ON weapon_kills(weapon);
