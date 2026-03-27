/**
 * ALMA Voice Function — ElevenLabs text-to-speech
 * Receives a text response from the existing ALMA chat and returns audio in base64.
 * Uses shared auth module for session verification.
 */

import { neon } from '@neondatabase/serverless';
import { verifySession, jsonResponse, corsResponse } from './lib/auth.mjs';


const ELEVENLABS_API = 'https://api.elevenlabs.io/v1/text-to-speech';
const DEFAULT_MODEL = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const DEFAULT_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.85,
  style: 0.3,
  use_speaker_boost: true,
};

export default async function handler(req) {
  // --- CORS preflight ---
  if (req.method === 'OPTIONS') return corsResponse();

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // --- Auth gate: verify session token ---
  const dbUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (dbUrl) {
    const sql = neon(dbUrl);
    const session = await verifySession(sql, req);
    if (!session) {
      return jsonResponse({ error: 'Authentication required', code: 'AUTH_REQUIRED' }, 401);
    }
  }

  // --- Check ElevenLabs config ---
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return jsonResponse({
      error: 'Voice not configured',
      code: 'VOICE_NOT_CONFIGURED',
    }, 503);
  }

  try {
    const body = await req.json();
    const text = String(body.text || '').trim();

    if (!text) {
      return jsonResponse({ error: 'Missing text', code: 'VOICE_EMPTY' }, 400);
    }

    // Limit text length to prevent abuse (ElevenLabs charges per character)
    if (text.length > 5000) {
      return jsonResponse({ error: 'Text too long', code: 'VOICE_TOO_LONG' }, 400);
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
      return jsonResponse({
        error: 'Voice generation failed',
        code: 'VOICE_PROVIDER_ERROR',
      }, 502);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    return jsonResponse({
      audio: audioBase64,
      mimeType: 'audio/mpeg',
    });
  } catch (error) {
    console.error('[ALMA Voice Error]', error.message);
    return jsonResponse({
      error: 'Internal error. Please try again.',
      code: 'VOICE_INTERNAL_ERROR',
    }, 500);
  }
}
