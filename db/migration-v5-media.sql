-- =============================================================================
-- ALMA v5 Migration — Dual-Save (media grounding)
-- =============================================================================
-- Purpose: stop the data hemorrhage. Persist the canonical URL + MIME of the
-- original binary (audio/image) alongside its transcription, so memories
-- remain multimodally reconstructible.
--
-- Run once against Neon (idempotent — safe to re-run):
--   psql "$DATABASE_URL" -f db/migration-v5-media.sql
--
-- Or via the naive splitter (each statement is ';'-terminated and single):
--   DATABASE_URL="postgresql://..." node db/run-seed.mjs
--   (this file's statements are already merged into db/seed.sql)
--
-- alma_documents is guarded with IF EXISTS because older installs may not
-- have that table yet — ingest.mjs falls back gracefully when it's missing.
-- =============================================================================

ALTER TABLE IF EXISTS alma_chunks
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_type VARCHAR(100);

ALTER TABLE IF EXISTS alma_documents
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_type VARCHAR(100);

-- Partial index: speeds up queries that filter for (or against) grounded memories
CREATE INDEX IF NOT EXISTS idx_alma_chunks_media_url
  ON alma_chunks (media_url) WHERE media_url IS NOT NULL;
