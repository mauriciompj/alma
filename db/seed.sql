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

-- Documents registry (tracks imported files/batches)
-- Created before alma_chunks because chunks reference documents via FK.
CREATE TABLE IF NOT EXISTS alma_documents (
  id SERIAL PRIMARY KEY,
  source_file TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  total_chunks INTEGER NOT NULL DEFAULT 0,
  file_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Memories / Knowledge chunks (the heart of ALMA)
-- Each chunk is a searchable piece of text used by RAG to answer questions.
CREATE TABLE IF NOT EXISTS alma_chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES alma_documents(id),
  source_file TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  file_date DATE,
  char_count INTEGER,
  search_vector TSVECTOR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Full-text search index (Portuguese)
CREATE INDEX IF NOT EXISTS idx_chunks_search
  ON alma_chunks USING GIN (search_vector);

-- Tag search index
CREATE INDEX IF NOT EXISTS idx_chunks_tags
  ON alma_chunks USING GIN (tags);

-- Category index
CREATE INDEX IF NOT EXISTS idx_chunks_category
  ON alma_chunks (category);

-- Source file index (used by deduplication in import-json.mjs)
CREATE INDEX IF NOT EXISTS idx_chunks_source_file
  ON alma_chunks (source_file);

-- Created at index (for recent queries)
CREATE INDEX IF NOT EXISTS idx_chunks_created_at
  ON alma_chunks (created_at DESC);

-- Auto-update search_vector and char_count on INSERT/UPDATE
CREATE OR REPLACE FUNCTION alma_chunks_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('portuguese', COALESCE(NEW.title, '') || ' ' || NEW.content);
  NEW.char_count := LENGTH(NEW.content);
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_alma_chunks_search ON alma_chunks;
CREATE TRIGGER trg_alma_chunks_search
  BEFORE INSERT OR UPDATE OF content, title ON alma_chunks
  FOR EACH ROW EXECUTE FUNCTION alma_chunks_search_update();

-- Corrections (when ALMA gets something wrong, the author fixes it)
CREATE TABLE IF NOT EXISTS alma_corrections (
  id SERIAL PRIMARY KEY,
  original_question TEXT NOT NULL,
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

-- Legacy access (inheritance keys — passphrases unlock admin after author's death)
CREATE TABLE IF NOT EXISTS alma_legacy (
  id SERIAL PRIMARY KEY,
  person VARCHAR(100) NOT NULL,
  passphrase_hash TEXT NOT NULL,
  access_level VARCHAR(20) NOT NULL,
  personal_message TEXT,
  technical_notes TEXT,
  unlocked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
--   INSERT INTO alma_chunks (source_file, title, category, chunk_index, content, tags)
--   VALUES ('manual', 'My values', 'valores', 1, 'I believe the most important thing...',
--     ARRAY['valores','core']);
--
-- Or use the import script:
--   DATABASE_URL="postgresql://..." node db/import-json.mjs data/my-memories.json
-- =============================================================================
