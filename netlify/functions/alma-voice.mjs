/**
 * ALMA Voice Function — ElevenLabs text-to-speech
 * Receives a text response from the existing ALMA chat and returns audio in base64.
 * Includes session authentication (same as chat.mjs).
 */

import { neon } from '@neondatabase/serverless';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://projeto-alma.netlify.app';
const ELEVENLABS_API = 'https://api.elevenlabs.io/v1/text-to-speech';
const DEFAULT_MODEL = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const DEFAULT_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.85,
  style: 0.3,
  use_speaker_boost: true,
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    },
  });
}

export default async function handler(req) {
  // --- CORS preflight ---
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // --- Auth gate: verify session token (same logic as chat.mjs) ---
  const dbUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (dbUrl) {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return json({ error: 'Authentication required', code: 'AUTH_REQUIRED' }, 401);
    }
    try {
      const authSql = neon(dbUrl);
      const rows = await authSql`SELECT value FROM alma_config WHERE key = ${'session_' + token} LIMIT 1`;
      if (rows.length === 0) {
        return json({ error: 'Invalid or expired session', code: 'AUTH_INVALID' }, 401);
      }
      const session = JSON.parse(rows[0].value);
      if (new Date(session.expiresAt) < new Date()) {
        await authSql`DELETE FROM alma_config WHERE key = ${'session_' + token}`;
        return json({ error: 'Session expired', code: 'AUTH_EXPIRED' }, 401);
      }
    } catch (e) {
      // Auth check failed — allow through to not break if DB is temporarily down
      console.error('[ALMA Voice] Auth check error:', e.message);
    }
  }

  // --- Check ElevenLabs config ---
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return json({
      error: 'Voice not configured',
      code: 'VOICE_NOT_CONFIGURED',
    }, 503);
  }

  try {
    const body = await req.json();
    const text = String(body.text || '').trim();

    if (!text) {
      return json({ error: 'Missing text', code: 'VOICE_EMPTY' }, 400);
    }

    // Limit text length to prevent abuse (ElevenLabs charges per character)
    if (text.length > 5000) {
      return json({ error: 'Text too long', code: 'VOICE_TOO_LONG' }, 400);
    }

    const response = await fetch(`${ELEVENLABS_API}/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: DEFAULT_MODEL,
        voice_settings: DEFAULT_SETTINGS,
      }),
    });

    if (!response.ok) {
      let details = '';
      try { details = await response.text(); } catch (e) { details = ''; }
      console.error('[ALMA Voice] ElevenLabs error:', response.status, details);
      return json({
        error: 'Voice generation failed',
        code: 'VOICE_PROVIDER_ERROR',
      }, 502);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    return json({
      audio: audioBase64,
      mimeType: 'audio/mpeg',
    });
  } catch (error) {
    console.error('[ALMA Voice Error]', error.message);
    return json({
      error: 'Internal error. Please try again.',
      code: 'VOICE_INTERNAL_ERROR',
    }, 500);
  }
}
