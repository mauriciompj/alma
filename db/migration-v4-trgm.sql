-- ALMA v4 Migration: Enable pg_trgm for fuzzy search
-- Run once against Neon database

-- Enable pg_trgm extension (Neon supports this natively)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add trigram index on content for fuzzy matching (typo tolerance)
CREATE INDEX IF NOT EXISTS idx_chunks_content_trgm
  ON alma_chunks USING GIN (content gin_trgm_ops);

-- Add trigram index on title for fuzzy title search
CREATE INDEX IF NOT EXISTS idx_chunks_title_trgm
  ON alma_chunks USING GIN (title gin_trgm_ops);
