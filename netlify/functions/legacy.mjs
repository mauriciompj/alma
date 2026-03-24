/**
 * ALMA Legacy API — Inheritance access system
 * Verifies a personal passphrase and grants legacy access.
 *
 * POST /api/legacy
 *   Body: { "passphrase": "eu seguro irmão" }
 *   Returns: session token with legacy access level + personal message
 *
 * Security:
 *   - Passphrases stored as bcrypt hashes (never plaintext)
 *   - Aggressive rate limiting (3 attempts per hour per IP)
 *   - No error details on failure (silent rejection)
 *   - Logs unlock events for audit
 */

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://projeto-alma.netlify.app';

// Aggressive rate limiting — 3 attempts per hour per IP
const RATE_LIMIT = { maxAttempts: 3, windowMs: 3600000 };
const attempts = new Map();

function checkRate(ip) {
  const now = Date.now();
  const entry = attempts.get(ip) || { count: 0, resetAt: now + RATE_LIMIT.windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT.windowMs;
  }
  entry.count++;
  attempts.set(ip, entry);
  return entry.count <= RATE_LIMIT.maxAttempts;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const dbUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) return json({ error: 'Service unavailable' }, 503);

  // Rate limit
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRate(ip)) {
    return json({ unlocked: false }, 200); // Silent — no indication of rate limit
  }

  try {
    const sql = neon(dbUrl);
    const body = await req.json();
    const passphrase = String(body.passphrase || '').trim();

    if (!passphrase) {
      return json({ unlocked: false }, 200);
    }

    // Fetch all legacy entries (typically 5-10 rows — small table)
    const rows = await sql`
      SELECT id, person, passphrase_hash, access_level, personal_message, technical_notes
      FROM alma_legacy
      WHERE passphrase_hash IS NOT NULL
    `;

    // Check each hash (bcrypt compare is constant-time)
    let matched = null;
    for (const row of rows) {
      const valid = await bcrypt.compare(passphrase, row.passphrase_hash);
      if (valid) {
        matched = row;
        break;
      }
    }

    if (!matched) {
      // Silent rejection — no details
      return json({ unlocked: false }, 200);
    }

    // Record unlock event
    if (!matched.unlocked_at) {
      await sql`UPDATE alma_legacy SET unlocked_at = NOW() WHERE id = ${matched.id}`;
    }
    await sql`
      INSERT INTO alma_config (key, value, updated_at)
      VALUES (${'legacy_unlock_' + matched.id + '_' + Date.now()}, ${JSON.stringify({
        person: matched.person,
        ip: ip,
        timestamp: new Date().toISOString()
      })}, NOW())
      ON CONFLICT (key) DO NOTHING
    `;

    // Create session token with legacy access
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    const isAdmin = ['legacy_admin', 'legacy_owner'].includes(matched.access_level);

    await sql`
      INSERT INTO alma_config (key, value, updated_at)
      VALUES (${'session_' + token}, ${JSON.stringify({
        name: matched.person,
        type: 'legacy',
        admin: isAdmin,
        accessLevel: matched.access_level,
        token,
        expiresAt,
      })}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;

    return json({
      unlocked: true,
      person: matched.person,
      accessLevel: matched.access_level,
      personalMessage: matched.personal_message || '',
      technicalNotes: matched.access_level === 'legacy_admin' ? (matched.technical_notes || '') : undefined,
      token,
      admin: isAdmin,
    });
  } catch (e) {
    console.error('[ALMA Legacy] Error:', e.message);
    return json({ unlocked: false }, 200); // Silent even on errors
  }
}
