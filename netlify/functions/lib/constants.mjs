/**
 * ALMA — Shared Constants
 * Centralized magic numbers and configuration values
 */

// --- Auth & Sessions ---
export const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SESSION_TOKEN_BYTES = 32;

// --- Rate Limiting ---
export const LOGIN_RATE_LIMIT = { maxAttempts: 5, windowMs: 300_000 }; // 5 per 5 min
export const CHAT_RATE_LIMIT = { maxRequests: 20, windowMs: 60_000 }; // 20 per 1 min
export const LEGACY_RATE_LIMIT = { maxAttempts: 3, windowMs: 3_600_000 }; // 3 per 1 hour

// --- RAG ---
export const MAX_CONTEXT_CHUNKS = 8;
export const MAX_CONTEXT_TOKENS = 3000;
export const FETCH_POOL_MULTIPLIER = 3;
export const MAX_SEARCH_TERMS = 12;

// --- API ---
export const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
export const MODEL_CHAT = 'claude-sonnet-4-20250514';
export const MODEL_HAIKU = 'claude-haiku-4-5-20251001';
export const MAX_CHAT_TOKENS = 1000;

// --- Voice ---
export const MAX_VOICE_CHARS = 5000;

// --- Ingest ---
export const MAX_INGEST_CONTENT_LENGTH = 500_000; // 500KB
export const TARGET_CHUNK_SIZE = 2000;

// --- CORS ---
export const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://projeto-alma.netlify.app';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
