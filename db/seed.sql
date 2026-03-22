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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Full-text search index (Portuguese)
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
--     to_tsvector('portuguese', 'My values I believe the most important thing...'));
--
-- Or use the import script:
--   DATABASE_URL="postgresql://..." node db/import-json.mjs data/my-memories.json
-- =============================================================================
