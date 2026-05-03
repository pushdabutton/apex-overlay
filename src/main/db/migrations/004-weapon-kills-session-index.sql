-- ============================================================
-- Migration 004: Add session_id index to weapon_kills
--
-- The WeaponPerformanceRule now queries by session_id instead
-- of across all history. Without this index, the query would
-- perform a full table scan as the weapon_kills table grows.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_weapon_kills_session ON weapon_kills(session_id);
