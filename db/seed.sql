-- =============================================================================
-- ALMA — Database Setup (Neon PostgreSQL)
-- =============================================================================
-- Run this once to create the tables ALMA needs.
-- You can run it via Neon's SQL Editor or with:
--   DATABASE_URL="postgresql://..." node db/run-seed.mjs
-- =============================================================================

-- Configuration store (users, sessions, settings, history)
CREATE TABLE IF NOT EXISTS alma_config (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Memories / Knowledge chunks (the heart of ALMA)
-- Each chunk is a searchable piece of text used by RAG to answer questions.
CREATE TABLE IF NOT EXISTS alma_chunks (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  title VARCHAR(500),
  category VARCHAR(100),
  tags TEXT[] DEFAULT '{}',
  source_file VARCHAR(255),
  chunk_index INTEGER DEFAULT 0,
  char_count INTEGER,
  search_vector TSVECTOR,
  media_url TEXT,             -- v5 Dual-Save: canonical URL of the original binary (audio/image) in object storage
  media_type VARCHAR(100),    -- v5 Dual-Save: MIME type of the preserved binary (e.g. 'audio/ogg', 'image/jpeg')
  event_year INTEGER,         -- v6 Temporal Axis: year the narrated fact occurred (NOT the upload date). Nullable.
  entities TEXT[] DEFAULT '{}', -- v6 Entity Graph: canonical names/places/concepts extracted from the chunk
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Full-text search index (works with any ts_config: 'simple', 'portuguese', 'english', etc.)
CREATE INDEX IF NOT EXISTS idx_alma_chunks_search
  ON alma_chunks USING GIN (search_vector);

-- Tag search index
CREATE INDEX IF NOT EXISTS idx_alma_chunks_tags
  ON alma_chunks USING GIN (tags);

-- Category index
CREATE INDEX IF NOT EXISTS idx_alma_chunks_category
  ON alma_chunks (category);

-- Corrections (when ALMA gets something wrong, the author fixes it)
CREATE TABLE IF NOT EXISTS alma_corrections (
  id SERIAL PRIMARY KEY,
  original_question TEXT,
  original_response TEXT NOT NULL,
  correction TEXT NOT NULL,
  filho_nome VARCHAR(50),
  categories TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Directives (behavioral rules for ALMA, per-person or global)
CREATE TABLE IF NOT EXISTS alma_directives (
  id SERIAL PRIMARY KEY,
  person VARCHAR(50),
  directive_text TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  source VARCHAR(20) DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- v5 Migration — Dual-Save media grounding
-- =============================================================================
-- Idempotent additive upgrade for existing deploys. Safe to re-run.
-- alma_documents is guarded with IF EXISTS because older installs may not have
-- that table yet (ingest.mjs falls back gracefully when it's missing).
-- =============================================================================

ALTER TABLE IF EXISTS alma_chunks
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_type VARCHAR(100);

ALTER TABLE IF EXISTS alma_documents
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_type VARCHAR(100);

-- Partial index to quickly find memories that have (or lack) media grounding
CREATE INDEX IF NOT EXISTS idx_alma_chunks_media_url
  ON alma_chunks (media_url) WHERE media_url IS NOT NULL;

-- =============================================================================
-- v6 Migration — Temporal Axis + Entity Graph (Teia do Tempo e Entidade)
-- =============================================================================
-- First plumbing step toward a cognitive graph. This attack is strictly
-- structural: it adds the columns and indexes, but does NOT introduce
-- embeddings (pgvector) and does NOT wire any LLM extractor. The fields are
-- optional on ingest and may be populated by clients (Termux, web admin) or
-- by a future server-side extractor.
--
-- Idempotent additive upgrade for existing deploys. Safe to re-run.
-- =============================================================================

ALTER TABLE IF EXISTS alma_chunks
  ADD COLUMN IF NOT EXISTS event_year INTEGER,
  ADD COLUMN IF NOT EXISTS entities TEXT[] DEFAULT '{}';

ALTER TABLE IF EXISTS alma_documents
  ADD COLUMN IF NOT EXISTS event_year INTEGER,
  ADD COLUMN IF NOT EXISTS entities TEXT[] DEFAULT '{}';

-- GIN index for array containment / overlap queries (e.g. entities && ARRAY['Maurício'])
CREATE INDEX IF NOT EXISTS idx_alma_chunks_entities
  ON alma_chunks USING GIN (entities);

-- Partial btree for time-range queries (e.g. "memories from 2024"); skips NULLs
CREATE INDEX IF NOT EXISTS idx_alma_chunks_event_year
  ON alma_chunks (event_year) WHERE event_year IS NOT NULL;

-- =============================================================================
-- Initial data: Create your first user
-- =============================================================================
-- Replace the values below with your own.
-- The "type" field controls how ALMA addresses this person:
--   "filho"  = child (ALMA speaks as a father/mother)
--   "outro"  = other relationship (ALMA speaks as the author, not as parent)
--
-- You can add more users by appending to the JSON array.
-- =============================================================================

INSERT INTO alma_config (key, value, updated_at)
VALUES (
  'users_json',
  '[{"username":"YourName","password":"CHANGE_ME","name":"YourName","type":"filho","admin":true}]',
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- Done! Now add your memories.
-- You can do this through the admin panel or by inserting directly:
--
--   INSERT INTO alma_chunks (title, category, content, tags, source_file,
--     char_count, search_vector)
--   VALUES ('My values', 'valores', 'I believe the most important thing...',
--     ARRAY['valores','core'], 'manual',
--     LENGTH('I believe the most important thing...'),
--     to_tsvector('simple', 'My values I believe the most important thing...'));
--
--   Language options for to_tsvector():
--     'simple'     — universal, no stemming (works with ANY language, recommended default)
--     'portuguese' — Portuguese stemming (coragem → corag, filhos → filho)
--     'english'    — English stemming (running → run, children → child)
--     'spanish'    — Spanish stemming
--   IMPORTANT: The language used here MUST match the SEARCH_LANGUAGE env var in your .env
--
-- Or use the import script:
--   DATABASE_URL="postgresql://..." node db/import-json.mjs data/my-memories.json
-- =============================================================================
