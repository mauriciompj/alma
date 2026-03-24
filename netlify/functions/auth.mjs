/**
 * ALMA Auth API — Simple user authentication
 * Users are stored in alma_config with key 'users_json'
 */

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

// Restrict CORS to production domain only (set via env var or fallback)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://projeto-alma.netlify.app';

// --- Login rate limiting (in-memory, resets on cold start) ---
const LOGIN_RATE_LIMIT = { maxAttempts: 5, windowMs: 300000 }; // 5 attempts per 5 minutes per IP
const loginAttempts = new Map();

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, resetAt: now + LOGIN_RATE_LIMIT.windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + LOGIN_RATE_LIMIT.windowMs;
  }
  entry.count++;
  loginAttempts.set(ip, entry);
  // Clean old entries periodically
  if (loginAttempts.size > 500) {
    for (const [k, v] of loginAttempts) { if (now > v.resetAt) loginAttempts.delete(k); }
  }
  return entry.count <= LOGIN_RATE_LIMIT.maxAttempts;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data, status = 200) {
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
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);
    const body = await req.json();
    const { action } = body;

    if (action === 'login') {
      const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
      if (!checkLoginRateLimit(clientIp)) {
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

  // Fetch users from alma_config
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

  // Find user (case-insensitive username match)
  const user = usersJson.find(u =>
    u.username.toLowerCase() === username.toLowerCase()
  );

  if (!user) {
    return jsonResponse({ error: 'Invalid username or password' }, 401);
  }

  // Compare password: support both bcrypt hash and legacy plain text
  const isBcrypt = user.password && user.password.startsWith('$2');
  let passwordValid = false;

  if (isBcrypt) {
    passwordValid = await bcrypt.compare(password, user.password);
  } else {
    // Legacy plain text comparison — will auto-migrate below
    passwordValid = (user.password === password);
  }

  if (!passwordValid) {
    return jsonResponse({ error: 'Invalid username or password' }, 401);
  }

  // Auto-migrate: hash plain text password on first successful login
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
      // Non-fatal: login still works, hash will happen next time
      console.error('[ALMA] Failed to auto-migrate password:', e.message);
    }
  }

  // Cleanup expired sessions on every login (lightweight, bounded by session count)
  cleanupExpiredSessions(sql).catch(() => {});

  // Generate simple session token
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  // Store session in database
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
    // If table doesn't exist, create it
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
    birthDate: user.birthDate || null, // e.g. "2016-03-15"
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
      // Session expired — clean up database entry
      await sql`DELETE FROM alma_config WHERE key = ${'session_' + token}`;
      return jsonResponse({ valid: false, reason: 'expired' }, 401);
    }

    // Periodic cleanup: ~5% chance per verify to purge all expired sessions
    if (Math.random() < 0.05) {
      cleanupExpiredSessions(sql).catch(() => {}); // Fire-and-forget
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
    return jsonResponse({ success: true }); // Don't leak errors on logout
  }
}

// Remove all expired sessions from database (runs on every login)
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
        expiredKeys.push(row.key); // Malformed session — delete it
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

function generateToken() {
  // Cryptographically secure token generation using hex encoding (full entropy)
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
