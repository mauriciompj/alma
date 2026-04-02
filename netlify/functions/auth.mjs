/**
 * ALMA Auth API — Simple user authentication
 * Users are stored in alma_config with key 'users_json'
 */

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { SESSION_EXPIRY_MS, LOGIN_RATE_LIMIT } from './lib/constants.mjs';
import { checkRateLimit, cleanupRateLimits, generateToken, getClientIp, jsonResponse, corsResponse } from './lib/auth.mjs';

const GOOGLE_OPENID_CONFIG_URL = 'https://accounts.google.com/.well-known/openid-configuration';
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
let googleJwksCache = { keys: null, expiresAt: 0, jwksUri: null };

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

    if (action === 'google_config') {
      return handleGoogleConfig();
    }

    if (action === 'login_google') {
      const clientIp = getClientIp(req);
      const allowed = await checkRateLimit(sql, 'login_google_' + clientIp, LOGIN_RATE_LIMIT.maxAttempts, LOGIN_RATE_LIMIT.windowMs);
      if (!allowed) {
        return jsonResponse({ error: 'Too many login attempts. Please wait 5 minutes.' }, 429);
      }
      return await handleGoogleLogin(sql, body);
    }

    if (action === 'magic_link') {
      return await handleMagicLink(sql, body);
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

async function handleMagicLink(sql, body) {
  const { magicToken } = body;
  if (!magicToken) return jsonResponse({ error: 'Missing magic token' }, 400);

  try {
    const rows = await sql`SELECT value FROM alma_config WHERE key = ${'magic_' + magicToken} LIMIT 1`;
    if (rows.length === 0) {
      return jsonResponse({ error: 'Invalid or expired link' }, 401);
    }

    const data = JSON.parse(rows[0].value);
    if (new Date(data.expiresAt) < new Date()) {
      await sql`DELETE FROM alma_config WHERE key = ${'magic_' + magicToken}`;
      return jsonResponse({ error: 'Link expired' }, 401);
    }

    // Return the pre-created session token
    return jsonResponse({
      success: true,
      name: data.name,
      type: data.type,
      admin: !!data.admin,
      token: data.sessionToken,
      birthDate: data.birthDate || null,
      displayName: data.displayName || data.name,
    });
  } catch (e) {
    console.error('[ALMA Auth] Magic link error:', e.message);
    return jsonResponse({ error: 'Internal error' }, 500);
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
      // password hash auto-migrated
    } catch (e) {
      console.error('[ALMA] Failed to auto-migrate password:', e.message);
    }
  }

  return await issueSession(sql, user);
}

function handleGoogleConfig() {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  return jsonResponse({
    enabled: !!clientId,
    clientId: clientId || null,
  });
}

async function handleGoogleLogin(sql, body) {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!clientId) {
    return jsonResponse({ error: 'Google login is not configured' }, 503);
  }

  const idToken = typeof body.idToken === 'string' ? body.idToken.trim() : '';
  if (!idToken) {
    return jsonResponse({ error: 'Missing Google ID token' }, 400);
  }

  let payload;
  try {
    payload = await verifyGoogleIdToken(idToken, clientId);
  } catch (error) {
    console.error('[ALMA Google Login] Token verification failed:', error.message);
    return jsonResponse({ error: 'Google token validation failed' }, 401);
  }

  if (!payload.email || payload.email_verified !== true) {
    return jsonResponse({ error: 'Google account email is not verified' }, 403);
  }

  const hostedDomain = (process.env.GOOGLE_HOSTED_DOMAIN || '').trim().toLowerCase();
  if (hostedDomain && String(payload.hd || '').toLowerCase() !== hostedDomain) {
    return jsonResponse({ error: 'Google account domain not allowed' }, 403);
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

  const user = findUserByGoogleIdentity(usersJson, payload);
  if (!user) {
    return jsonResponse({ error: 'Google account is not authorized for this ALMA' }, 403);
  }

  return await issueSession(sql, user);
}

function findUserByGoogleIdentity(users, payload) {
  const email = String(payload.email || '').trim().toLowerCase();
  const sub = String(payload.sub || '').trim();

  return users.find(function(user) {
    const googleSub = String(user.googleSub || '').trim();
    const googleEmail = String(user.googleEmail || user.email || '').trim().toLowerCase();
    const username = String(user.username || '').trim().toLowerCase();

    if (googleSub && sub && googleSub === sub) return true;
    if (googleEmail && email && googleEmail === email) return true;
    if (username && email && username === email) return true;
    return false;
  }) || null;
}

async function issueSession(sql, user) {
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

async function verifyGoogleIdToken(idToken, clientId) {
  const [encodedHeader, encodedPayload, encodedSignature] = idToken.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error('Malformed JWT');
  }

  const header = JSON.parse(base64UrlDecodeToText(encodedHeader));
  const payload = JSON.parse(base64UrlDecodeToText(encodedPayload));
  if (!header.kid || !header.alg) throw new Error('Missing JWT header metadata');
  if (header.alg !== 'RS256') throw new Error('Unsupported JWT algorithm');

  validateGooglePayload(payload, clientId);

  const jwk = await getGoogleJwkByKid(header.kid);
  if (!jwk) throw new Error('Google signing key not found');

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signedContent = new TextEncoder().encode(encodedHeader + '.' + encodedPayload);
  const signature = base64UrlToUint8Array(encodedSignature);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signedContent);
  if (!valid) throw new Error('Invalid Google JWT signature');

  return payload;
}

function validateGooglePayload(payload, clientId) {
  const now = Math.floor(Date.now() / 1000);
  const aud = payload.aud;
  const exp = Number(payload.exp || 0);
  const nbf = payload.nbf ? Number(payload.nbf) : 0;
  const iss = String(payload.iss || '');

  const audienceMatches = Array.isArray(aud) ? aud.includes(clientId) : aud === clientId;
  if (!audienceMatches) throw new Error('Invalid audience');
  if (!GOOGLE_ISSUERS.has(iss)) throw new Error('Invalid issuer');
  if (!exp || exp <= now) throw new Error('Token expired');
  if (nbf && nbf > now + 60) throw new Error('Token not active yet');
}

async function getGoogleJwkByKid(kid) {
  const cacheValid = googleJwksCache.keys && Date.now() < googleJwksCache.expiresAt;
  if (!cacheValid) {
    await refreshGoogleJwks();
  }
  return (googleJwksCache.keys || []).find(function(key) { return key.kid === kid; }) || null;
}

async function refreshGoogleJwks() {
  const configResponse = await fetch(GOOGLE_OPENID_CONFIG_URL, { headers: { 'Accept': 'application/json' } });
  if (!configResponse.ok) {
    throw new Error('Failed to load Google OpenID configuration');
  }
  const openidConfig = await configResponse.json();
  const jwksUri = openidConfig.jwks_uri;
  if (!jwksUri) throw new Error('Missing jwks_uri in OpenID configuration');

  const keysResponse = await fetch(jwksUri, { headers: { 'Accept': 'application/json' } });
  if (!keysResponse.ok) {
    throw new Error('Failed to load Google JWKS');
  }

  const cacheControl = keysResponse.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;
  const keysPayload = await keysResponse.json();

  googleJwksCache = {
    jwksUri,
    keys: Array.isArray(keysPayload.keys) ? keysPayload.keys : [],
    expiresAt: Date.now() + (maxAgeSeconds * 1000),
  };
}

function base64UrlDecodeToText(value) {
  return new TextDecoder().decode(base64UrlToUint8Array(value));
}

function base64UrlToUint8Array(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const base64 = normalized + padding;
  return Uint8Array.from(Buffer.from(base64, 'base64'));
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
      // expired sessions cleaned
    }
  } catch (e) {
    console.error('[ALMA] Session cleanup error:', e.message);
  }
}
