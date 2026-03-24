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

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

  try {
    const sql = neon(dbUrl);
    const body = await req.json();

    // --- Admin helper ---
    async function requireAdmin() {
      const authHeader = req.headers.get('authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!token) return null;
      const sess = await sql`SELECT value FROM alma_config WHERE key = ${'session_' + token} LIMIT 1`;
      if (sess.length === 0) return null;
      const session = JSON.parse(sess[0].value);
      if (!session.admin) return null;
      if (new Date(session.expiresAt) < new Date()) return null;
      return session;
    }

    // --- Heartbeat: dead man's switch check-in ---
    if (body.action === 'heartbeat') {
      const session = await requireAdmin();
      if (!session) return json({ error: 'Admin auth required' }, 401);

      await sql`
        INSERT INTO alma_config (key, value, updated_at)
        VALUES ('heartbeat_last', ${new Date().toISOString()}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${new Date().toISOString()}, updated_at = NOW()
      `;
      // Also store count
      const countRow = await sql`SELECT value FROM alma_config WHERE key = 'heartbeat_count' LIMIT 1`;
      const count = countRow.length > 0 ? parseInt(countRow[0].value) + 1 : 1;
      await sql`
        INSERT INTO alma_config (key, value, updated_at)
        VALUES ('heartbeat_count', ${String(count)}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${String(count)}, updated_at = NOW()
      `;

      return json({ success: true, count, timestamp: new Date().toISOString() });
    }

    // --- Status: check heartbeat without auth (for heirs to verify) ---
    if (body.action === 'heartbeat_status') {
      const row = await sql`SELECT value FROM alma_config WHERE key = 'heartbeat_last' LIMIT 1`;
      if (row.length === 0) return json({ alive: false, lastCheckin: null, daysSince: null });

      const last = new Date(row[0].value);
      const days = Math.floor((Date.now() - last.getTime()) / 86400000);
      const intervalRow = await sql`SELECT value FROM alma_config WHERE key = 'heartbeat_interval_days' LIMIT 1`;
      const interval = intervalRow.length > 0 ? parseInt(intervalRow[0].value) : 30;

      return json({
        alive: days <= interval,
        lastCheckin: row[0].value,
        daysSince: days,
        intervalDays: interval,
        overdue: days > interval,
      });
    }

    // --- Admin: list all legacy entries (without hashes) ---
    if (body.action === 'list_heirs') {
      const session = await requireAdmin();
      if (!session) return json({ error: 'Admin auth required' }, 401);

      const rows = await sql`
        SELECT id, person, access_level, personal_message, technical_notes, email,
               passphrase_hash IS NOT NULL as has_passphrase, unlocked_at, created_at
        FROM alma_legacy ORDER BY id
      `;
      return json({ heirs: rows });
    }

    // --- Admin: add/update heir ---
    if (body.action === 'save_heir') {
      const session = await requireAdmin();
      if (!session) return json({ error: 'Admin auth required' }, 401);

      const { id, person, access_level, personal_message, technical_notes, email, passphrase } = body;
      if (!person) return json({ error: 'Missing person' }, 400);

      if (id) {
        // Update existing
        await sql`UPDATE alma_legacy SET person = ${person}, access_level = ${access_level || 'legacy_read'},
          personal_message = ${personal_message || ''}, technical_notes = ${technical_notes || ''},
          email = ${email || null}, updated_at = NOW() WHERE id = ${id}`;

        // Update passphrase only if provided (non-empty)
        if (passphrase && passphrase.trim()) {
          const bcryptHash = await bcrypt.hash(passphrase.trim(), 12);
          await sql`UPDATE alma_legacy SET passphrase_hash = ${bcryptHash}, updated_at = NOW() WHERE id = ${id}`;
        }
        return json({ success: true, id });
      } else {
        // Insert new
        let passphraseHash = null;
        if (passphrase && passphrase.trim()) {
          passphraseHash = await bcrypt.hash(passphrase.trim(), 12);
        }
        const result = await sql`
          INSERT INTO alma_legacy (person, access_level, personal_message, technical_notes, email, passphrase_hash)
          VALUES (${person}, ${access_level || 'legacy_read'}, ${personal_message || ''}, ${technical_notes || ''}, ${email || null}, ${passphraseHash})
          RETURNING id
        `;
        return json({ success: true, id: result[0].id });
      }
    }

    // --- Admin: delete heir ---
    if (body.action === 'delete_heir') {
      const session = await requireAdmin();
      if (!session) return json({ error: 'Admin auth required' }, 401);
      if (!body.id) return json({ error: 'Missing id' }, 400);
      await sql`DELETE FROM alma_legacy WHERE id = ${body.id}`;
      return json({ success: true });
    }

    // --- Activation status: is the system in legacy mode? ---
    if (body.action === 'activation_status') {
      const lastRow = await sql`SELECT value FROM alma_config WHERE key = 'heartbeat_last' LIMIT 1`;
      if (lastRow.length === 0) return json({ activated: false, reason: 'no_heartbeat' });

      const last = new Date(lastRow[0].value);
      const days = Math.floor((Date.now() - last.getTime()) / 86400000);
      const intervalRow = await sql`SELECT value FROM alma_config WHERE key = 'heartbeat_interval_days' LIMIT 1`;
      const interval = intervalRow.length > 0 ? parseInt(intervalRow[0].value) : 30;
      const activationThreshold = interval * 3; // 3x interval = activated

      return json({
        activated: days >= activationThreshold,
        daysSince: days,
        threshold: activationThreshold,
        intervalDays: interval,
      });
    }

    // --- Passphrase unlock (rate limited) ---
    if (!checkRate(ip)) {
      return json({ unlocked: false }, 200);
    }

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
