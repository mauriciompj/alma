/**
 * ALMA — Shared Auth Utilities
 * Single source of truth for session verification and rate limiting
 */

import { SESSION_TOKEN_BYTES, CORS_HEADERS } from './constants.mjs';

// --- Session Verification (shared across all functions) ---
export async function verifySession(sql, req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const rows = await sql`SELECT value FROM alma_config WHERE key = ${'session_' + token} LIMIT 1`;
    if (rows.length === 0) return null;

    const session = JSON.parse(rows[0].value);
    if (new Date(session.expiresAt) < new Date()) {
      await sql`DELETE FROM alma_config WHERE key = ${'session_' + token}`;
      return null;
    }
    return session; // { name, type, admin, birthDate, token, expiresAt }
  } catch (e) {
    return null;
  }
}

// --- Extract token from request ---
export function extractToken(req) {
  const authHeader = req.headers.get('authorization') || '';
  return authHeader.replace(/^Bearer\s+/i, '').trim();
}

// --- Extract client IP ---
export function getClientIp(req) {
  return req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
}

// --- Persistent Rate Limiting (DB-backed, survives cold starts) ---
export async function checkRateLimit(sql, key, maxAttempts, windowMs) {
  const rateLimitKey = 'ratelimit_' + key;
  const now = Date.now();

  try {
    const rows = await sql`SELECT value FROM alma_config WHERE key = ${rateLimitKey} LIMIT 1`;

    let entry;
    if (rows.length > 0) {
      entry = JSON.parse(rows[0].value);
      if (now > entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
      }
    } else {
      entry = { count: 0, resetAt: now + windowMs };
    }

    entry.count++;

    // Upsert rate limit entry
    await sql`
      INSERT INTO alma_config (key, value, updated_at)
      VALUES (${rateLimitKey}, ${JSON.stringify(entry)}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;

    return entry.count <= maxAttempts;
  } catch (e) {
    // If DB fails, allow the request (fail-open for rate limiting)
    return true;
  }
}

// --- Clean up old rate limit entries (call periodically) ---
export async function cleanupRateLimits(sql) {
  try {
    const rows = await sql`
      SELECT key, value FROM alma_config WHERE key LIKE 'ratelimit_%'
    `;
    const now = Date.now();
    const expired = [];
    for (const row of rows) {
      try {
        const entry = JSON.parse(row.value);
        if (now > entry.resetAt) expired.push(row.key);
      } catch { expired.push(row.key); }
    }
    if (expired.length > 0) {
      await sql`DELETE FROM alma_config WHERE key = ANY(${expired})`;
    }
  } catch (e) { /* silent */ }
}

// --- Generate cryptographically secure token ---
export function generateToken() {
  const bytes = new Uint8Array(SESSION_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// --- Standard JSON response ---
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// --- CORS preflight response ---
export function corsResponse() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
