/**
 * ALMA Ingest API — Quick capture from mobile (Termux, scripts, etc.)
 * Accepts text or base64-encoded files, chunks and stores in DB.
 *
 * POST /api/ingest
 *   Headers: Authorization: Bearer <token>
 *   Body: {
 *     "content": "text to save",           // raw text (required if no file)
 *     "file": "base64 encoded content",     // base64 file (optional, alternative to content)
 *     "file_name": "conversa.txt",          // original filename (for file imports)
 *     "title": "Conversa com IA sobre X",   // title (optional, auto-generated if missing)
 *     "category": "memorias_pessoais",      // category (optional, default: memorias_pessoais)
 *     "tags": ["reflexao", "ia"],           // tags (optional)
 *     "source": "termux",                   // source identifier (optional)
 *     "media_url": "https://...",           // v5 Dual-Save: canonical URL of the original binary (optional)
 *     "media_type": "audio/ogg",            // v5 Dual-Save: MIME type of the preserved binary (optional)
 *     "event_year": 2019,                   // v6 Temporal Axis: year the narrated fact occurred, INT 1900-2100 (optional)
 *     "entities": ["Maurício", "UFSC"]      // v6 Entity Graph: canonical names/places/concepts (optional, TEXT[])
 *   }
 *
 * Chunking: splits large texts into ~2000 char chunks at paragraph boundaries.
 */

import { neon } from '@neondatabase/serverless';
import { verifySession, jsonResponse, corsResponse } from './lib/auth.mjs';

const MAX_CONTENT_LENGTH = 500000; // 500KB text limit
const CHUNK_TARGET = 2000; // target chunk size in chars

// --- Chunk text at paragraph boundaries ---
function chunkText(text, targetSize = CHUNK_TARGET) {
  if (text.length <= targetSize) return [text];

  const paragraphs = text.split(/\n{2,}/);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > targetSize && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // If any chunk is still too large, split by sentences
  const final = [];
  for (const chunk of chunks) {
    if (chunk.length <= targetSize * 1.5) {
      final.push(chunk);
    } else {
      const sentences = chunk.split(/(?<=[.!?])\s+/);
      let part = '';
      for (const s of sentences) {
        if (part.length + s.length + 1 > targetSize && part.length > 0) {
          final.push(part.trim());
          part = s;
        } else {
          part += (part ? ' ' : '') + s;
        }
      }
      if (part.trim()) final.push(part.trim());
    }
  }

  return final;
}

// --- Generate title from content ---
function autoTitle(content, source) {
  const now = new Date().toISOString().slice(0, 10);
  const preview = content.slice(0, 60).replace(/\n/g, ' ').trim();
  return `${source || 'capture'} — ${now} — ${preview}...`;
}

// --- Decode base64 file to text ---
function decodeFile(base64, fileName) {
  const buffer = Buffer.from(base64, 'base64');
  const text = buffer.toString('utf-8');

  // Basic format detection by extension
  const ext = (fileName || '').split('.').pop().toLowerCase();

  if (['txt', 'md', 'json', 'csv', 'log'].includes(ext)) {
    return text;
  }

  // For docx/pdf, we can only handle the raw text that was base64 encoded
  // (the Termux script should extract text before sending)
  return text;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const dbUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    return jsonResponse({ error: 'Database not configured' }, 503);
  }

  const sql = neon(dbUrl);

  // Auth required — only admin can ingest
  const session = await verifySession(sql, req);
  if (!session) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }
  if (!session.admin) {
    return jsonResponse({ error: 'Admin access required' }, 403);
  }

  try {
    const body = await req.json();
    let text = '';

    // Get content from text or file
    if (body.content) {
      text = String(body.content).trim();
    } else if (body.file) {
      text = decodeFile(body.file, body.file_name);
    }

    if (!text) {
      return jsonResponse({ error: 'Missing content or file' }, 400);
    }

    if (text.length > MAX_CONTENT_LENGTH) {
      return jsonResponse({ error: `Content too large (${text.length} chars, max ${MAX_CONTENT_LENGTH})` }, 400);
    }

    // Metadata
    const source = body.source || 'mobile_capture';
    const category = body.category || 'memorias_pessoais';
    const tags = body.tags || [category, source];
    const sourceFile = source + '_' + new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const title = body.title || autoTitle(text, source);

    // v5 Dual-Save: canonical URL + MIME of the preserved binary (audio/image).
    // Both optional; if absent the chunks are ingested text-only (current behavior).
    // Validated at boundary — ignored if not a string or suspiciously long.
    const mediaUrl = (typeof body.media_url === 'string' && body.media_url.length > 0 && body.media_url.length <= 2048)
      ? body.media_url
      : null;
    const mediaType = (typeof body.media_type === 'string' && body.media_type.length > 0 && body.media_type.length <= 100)
      ? body.media_type
      : null;

    // v6 Temporal Axis: year the narrated fact occurred (NOT the upload date).
    // Coerced to integer, bounded 1900..2100; anything outside → null.
    let eventYear = null;
    if (body.event_year != null) {
      const y = Number(body.event_year);
      if (Number.isInteger(y) && y >= 1900 && y <= 2100) {
        eventYear = y;
      }
    }

    // v6 Entity Graph: canonical names/places/concepts (people, institutions, etc).
    // Validated as an array of non-empty strings; trimmed, deduped, capped at
    // 50 entries × 200 chars each. Non-array or empty → null (not '{}'), so
    // ON CONFLICT COALESCE semantics stay consistent with media_url.
    let entities = null;
    if (Array.isArray(body.entities)) {
      const cleaned = Array.from(new Set(
        body.entities
          .filter((e) => typeof e === 'string')
          .map((e) => e.trim())
          .filter((e) => e.length > 0 && e.length <= 200)
      )).slice(0, 50);
      if (cleaned.length > 0) entities = cleaned;
    }

    // Chunk the content
    const chunks = chunkText(text);

    // Register in alma_documents FIRST to get document_id
    let documentId = null;
    try {
      const docResult = await sql`
        INSERT INTO alma_documents (source_file, title, category, total_chunks, media_url, media_type, event_year, entities)
        VALUES (${sourceFile}, ${title}, ${category}, ${chunks.length}, ${mediaUrl}, ${mediaType}, ${eventYear}, ${entities}::TEXT[])
        ON CONFLICT (source_file) DO UPDATE SET
          total_chunks = alma_documents.total_chunks + ${chunks.length},
          media_url = COALESCE(alma_documents.media_url, EXCLUDED.media_url),
          media_type = COALESCE(alma_documents.media_type, EXCLUDED.media_type),
          event_year = COALESCE(alma_documents.event_year, EXCLUDED.event_year),
          entities = COALESCE(NULLIF(alma_documents.entities, '{}'::TEXT[]), EXCLUDED.entities)
        RETURNING id
      `;
      documentId = docResult[0]?.id || null;
    } catch (e) {
      // Not critical — chunks will be inserted without document_id
    }

    // Insert chunks with document_id
    let created = 0;
    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunkTitle = chunks.length === 1
          ? title
          : `${title} (${i + 1}/${chunks.length})`;

        try {
          await sql`
            INSERT INTO alma_chunks (document_id, source_file, title, category, chunk_index, content, tags, char_count, search_vector, media_url, media_type, event_year, entities)
            VALUES (
              ${documentId},
              ${sourceFile},
              ${chunkTitle},
              ${category},
              ${i + 1},
              ${chunks[i]},
              ${tags}::TEXT[],
              ${chunks[i].length},
              to_tsvector(
                CAST(${process.env.SEARCH_LANGUAGE || 'simple'} AS regconfig),
                COALESCE(CAST(${chunkTitle} AS text), '') || ' ' || CAST(${chunks[i]} AS text)
              ),
              ${mediaUrl},
              ${mediaType},
              ${eventYear},
              ${entities}::TEXT[]
            )
          `;
        } catch (error) {
          if (!/document_id/i.test(error.message || '')) throw error;
          await sql`
            INSERT INTO alma_chunks (source_file, title, category, chunk_index, content, tags, char_count, search_vector, media_url, media_type, event_year, entities)
            VALUES (
              ${sourceFile},
              ${chunkTitle},
              ${category},
              ${i + 1},
              ${chunks[i]},
              ${tags}::TEXT[],
              ${chunks[i].length},
              to_tsvector(
                CAST(${process.env.SEARCH_LANGUAGE || 'simple'} AS regconfig),
                COALESCE(CAST(${chunkTitle} AS text), '') || ' ' || CAST(${chunks[i]} AS text)
              ),
              ${mediaUrl},
              ${mediaType},
              ${eventYear},
              ${entities}::TEXT[]
            )
          `;
        }
        created++;
      }
    } catch (error) {
      if (created === 0 && documentId) {
        try {
          await sql`DELETE FROM alma_documents WHERE id = ${documentId}`;
        } catch {
          // Best-effort cleanup; don't mask the original insert error.
        }
      }
      throw error;
    }

    return jsonResponse({
      success: true,
      title,
      chunks_created: created,
      total_chars: text.length,
      category,
      source_file: sourceFile,
      media_url: mediaUrl,
      media_type: mediaType,
      event_year: eventYear,
      entities,
    });
  } catch (e) {
    console.error('[ALMA Ingest] Error:', e.message);
    return jsonResponse({ error: 'Ingest failed. Please try again.' }, 500);
  }
}
