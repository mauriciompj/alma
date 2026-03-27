/**
 * ALMA Auth API — Simple user authentication
 * Users are stored in alma_config with key 'users_json'
 */

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { SESSION_EXPIRY_MS, LOGIN_RATE_LIMIT } from './lib/constants.mjs';
import { checkRateLimit, cleanupRateLimits, generateToken, getClientIp, jsonResponse, corsResponse } from './lib/auth.mjs';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return corsResponse();

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);
    const body = await req.json();
    const { action } = body;

    if (action === 'login') {
      const clientIp = getClientIp(req);
      const allowed = await checkRateLimit(sql, 'login_' + clientIp, LOGIN_RATE_LIMIT.maxAttempts, LOGIN_RATE_LIMIT.windowMs);
      if (!allowed) {
        return jsonResponse({ error: 'Too many login attempts. Please wait 5 minutes.' }, 429);
      }
      return await handleLogin(sql, body);
    }

    if (action === 'verify') {
      return await handleVerifyToken(sql, body);
    }

    if (action === 'logout') {
      return await handleLogout(sql, body);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('[ALMA Auth] Error:', error.message);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

async function handleLogin(sql, body) {
  const { username, password } = body;
  if (!username || !password) {
    return jsonResponse({ error: 'Username and password are required' }, 400);
  }

  let usersJson;
  try {
    const rows = await sql`SELECT value FROM alma_config WHERE key = 'users_json' LIMIT 1`;
    if (rows.length === 0) {
      return jsonResponse({ error: 'User system not configured' }, 500);
    }
    usersJson = JSON.parse(rows[0].value);
  } catch (e) {
    return jsonResponse({ error: 'Failed to load users' }, 500);
  }

  const user = usersJson.find(u =>
    u.username.toLowerCase() === username.toLowerCase()
  );

  if (!user) {
    return jsonResponse({ error: 'Invalid username or password' }, 401);
  }

  const isBcrypt = user.password && user.password.startsWith('$2');
  let passwordValid = false;

  if (isBcrypt) {
    passwordValid = await bcrypt.compare(password, user.password);
  } else {
    passwordValid = (user.password === password);
  }

  if (!passwordValid) {
    return jsonResponse({ error: 'Invalid username or password' }, 401);
  }

  // Auto-migrate plaintext password to bcrypt
  if (!isBcrypt) {
    try {
      const hashed = await bcrypt.hash(password, 12);
      user.password = hashed;
      await sql`
        UPDATE alma_config SET value = ${JSON.stringify(usersJson)}, updated_at = NOW()
        WHERE key = 'users_json'
      `;
      console.log(`[ALMA] Auto-migrated password hash for user: ${user.username}`);
    } catch (e) {
      console.error('[ALMA] Failed to auto-migrate password:', e.message);
    }
  }

  // Cleanup expired sessions + stale rate limits
  cleanupExpiredSessions(sql).catch(() => {});
  cleanupRateLimits(sql).catch(() => {});

  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS).toISOString();

  try {
    await sql`
      INSERT INTO alma_config (key, value, updated_at)
      VALUES (${'session_' + token}, ${JSON.stringify({
        name: user.name,
        type: user.type,
        admin: !!user.admin,
        birthDate: user.birthDate || null,
        displayName: user.displayName || user.name,
        token,
        expiresAt
      })}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
  } catch (e) {
    await sql`
      CREATE TABLE IF NOT EXISTS alma_config (
        key VARCHAR(255) PRIMARY KEY, value TEXT NOT NULL DEFAULT '', updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    await sql`
      INSERT INTO alma_config (key, value, updated_at)
      VALUES (${'session_' + token}, ${JSON.stringify({
        name: user.name,
        type: user.type,
        admin: !!user.admin,
        birthDate: user.birthDate || null,
        displayName: user.displayName || user.name,
        token,
        expiresAt
      })}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
  }

  return jsonResponse({
    success: true,
    name: user.name,
    type: user.type,
    admin: !!user.admin,
    token,
    birthDate: user.birthDate || null,
    displayName: user.displayName || user.name,
  });
}

async function handleVerifyToken(sql, body) {
  const { token } = body;
  if (!token) return jsonResponse({ error: 'Missing token' }, 400);

  try {
    const rows = await sql`SELECT value FROM alma_config WHERE key = ${'session_' + token} LIMIT 1`;
    if (rows.length === 0) {
      return jsonResponse({ valid: false }, 401);
    }

    const session = JSON.parse(rows[0].value);
    if (new Date(session.expiresAt) < new Date()) {
      await sql`DELETE FROM alma_config WHERE key = ${'session_' + token}`;
      return jsonResponse({ valid: false, reason: 'expired' }, 401);
    }

    // Periodic cleanup: ~5% chance per verify
    if (Math.random() < 0.05) {
      cleanupExpiredSessions(sql).catch(() => {});
    }

    return jsonResponse({
      valid: true,
      name: session.name,
      type: session.type,
      admin: !!session.admin,
      birthDate: session.birthDate || null,
      displayName: session.displayName || session.name,
    });
  } catch (e) {
    return jsonResponse({ valid: false }, 401);
  }
}

async function handleLogout(sql, body) {
  const { token } = body;
  if (!token) return jsonResponse({ error: 'Missing token' }, 400);

  try {
    await sql`DELETE FROM alma_config WHERE key = ${'session_' + token}`;
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ success: true });
  }
}

async function cleanupExpiredSessions(sql) {
  try {
    const sessions = await sql`
      SELECT key, value FROM alma_config WHERE key LIKE 'session_%'
    `;
    const now = new Date();
    const expiredKeys = [];
    for (const row of sessions) {
      try {
        const sess = JSON.parse(row.value);
        if (sess.expiresAt && new Date(sess.expiresAt) < now) {
          expiredKeys.push(row.key);
        }
      } catch (e) {
        expiredKeys.push(row.key);
      }
    }
    if (expiredKeys.length > 0) {
      await sql`DELETE FROM alma_config WHERE key = ANY(${expiredKeys})`;
      console.log(`[ALMA] Cleaned ${expiredKeys.length} expired sessions`);
    }
  } catch (e) {
    console.error('[ALMA] Session cleanup error:', e.message);
  }
}
