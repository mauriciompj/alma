-- =============================================================================
-- ALMA v6 Migration — Temporal Axis + Entity Graph (Teia do Tempo e Entidade)
-- =============================================================================
-- Purpose: stop treating memories as a flat bag of text. Give each chunk a
-- narrated-year dimension (event_year, NOT the upload date) and a canonical
-- entity array (people, places, concepts). First plumbing step toward a
-- cognitive graph — no embeddings, no LLM extractor, no RAG changes.
--
-- The RAG path in chat.mjs is untouched by this migration. Existing queries
-- that do `SELECT * FROM alma_chunks` simply get two extra columns they may
-- or may not use. Nothing breaks.
--
-- Run once against Neon (idempotent — safe to re-run):
--   psql "$DATABASE_URL" -f db/migration-v6-entities.sql
--
-- Or via the naive splitter (statements below are ';'-terminated):
--   DATABASE_URL="postgresql://..." node db/run-seed.mjs
--   (this file's statements are already merged into db/seed.sql)
--
-- alma_documents is guarded with IF EXISTS because older installs may not
-- have that table yet — ingest.mjs falls back gracefully when it's missing.
-- =============================================================================

ALTER TABLE IF EXISTS alma_chunks
  ADD COLUMN IF NOT EXISTS event_year INTEGER,
  ADD COLUMN IF NOT EXISTS entities TEXT[] DEFAULT '{}';

ALTER TABLE IF EXISTS alma_documents
  ADD COLUMN IF NOT EXISTS event_year INTEGER,
  ADD COLUMN IF NOT EXISTS entities TEXT[] DEFAULT '{}';

-- GIN index: array containment / overlap queries
--   ex: SELECT * FROM alma_chunks WHERE entities && ARRAY['Maurício','UFSC'];
CREATE INDEX IF NOT EXISTS idx_alma_chunks_entities
  ON alma_chunks USING GIN (entities);

-- Partial btree: time-range queries, skipping NULLs to keep the index small
--   ex: SELECT * FROM alma_chunks WHERE event_year BETWEEN 2020 AND 2024;
CREATE INDEX IF NOT EXISTS idx_alma_chunks_event_year
  ON alma_chunks (event_year) WHERE event_year IS NOT NULL;
