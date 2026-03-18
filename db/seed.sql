-- =============================================================================
-- ALMA — Database Setup (Neon PostgreSQL)
-- =============================================================================
-- Run this once to create the tables ALMA needs.
-- You can run it via Neon's SQL Editor or with:
--   node db/run-seed.mjs
-- =============================================================================

-- Configuration store (users, sessions, settings)
CREATE TABLE IF NOT EXISTS alma_config (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Memories (the heart of ALMA)
CREATE TABLE IF NOT EXISTS alma_memories (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL DEFAULT 'geral',
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Corrections (when ALMA gets something wrong)
CREATE TABLE IF NOT EXISTS alma_corrections (
  id SERIAL PRIMARY KEY,
  person_name VARCHAR(100) NOT NULL,
  original_question TEXT,
  original_answer TEXT,
  correction TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Directives (behavioral rules for ALMA)
CREATE TABLE IF NOT EXISTS alma_directives (
  id SERIAL PRIMARY KEY,
  person_name VARCHAR(100) NOT NULL DEFAULT '__global__',
  directive TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable pgvector extension (for semantic memory search)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create similarity search index
CREATE INDEX IF NOT EXISTS idx_alma_memories_embedding
  ON alma_memories USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- =============================================================================
-- Initial data: Create your first user
-- =============================================================================
-- Replace the values below with your own.
-- The "type" field controls how ALMA addresses this person:
--   "filho"  = child (ALMA speaks as a father/mother)
--   "outro"  = other relationship (ALMA speaks in third person about the author)
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
--   INSERT INTO alma_memories (category, content)
--   VALUES ('values', 'I believe the most important thing in life is...');
--
-- Embeddings are generated automatically when you use the admin panel.
-- =============================================================================
