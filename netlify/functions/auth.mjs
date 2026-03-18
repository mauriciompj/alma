/**
 * ALMA Auth API — Simple user authentication
 * Users are stored in alma_config with key 'users_json'
 */

import { neon } from '@neondatabase/serverless';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
      return await handleLogin(sql, body);
    }

    if (action === 'verify') {
      return await handleVerifyToken(sql, body);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
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

  if (!user || user.password !== password) {
    return jsonResponse({ error: 'Invalid username or password' }, 401);
  }

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

    return jsonResponse({
      valid: true,
      name: session.name,
      type: session.type,
      admin: !!session.admin,
    });
  } catch (e) {
    return jsonResponse({ valid: false }, 401);
  }
}

function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
