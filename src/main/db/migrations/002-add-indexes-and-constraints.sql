-- ============================================================
-- Migration 002: Add Indexes & Constraints for Scalability
--
-- MAJOR 3: Unique constraint on player_profile (platform, player_uid)
--          to enable UPSERT and prevent unbounded row growth.
-- MINOR 5: Composite index on coaching_insights (match_id, type)
--          for deduplication query performance.
-- ============================================================

-- Create a unique index on player_profile to enable UPSERT keyed on
-- (platform, player_uid). This replaces the bare INSERT that was
-- adding ~288 rows/day per player.
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_profile_platform_uid
  ON player_profile(platform, player_uid);

-- Composite index for the deduplication check in CoachingRepository.save()
-- which queries WHERE match_id = ? AND type = ?
CREATE INDEX IF NOT EXISTS idx_insights_match_type
  ON coaching_insights(match_id, type);
