/**
 * ALMA Memories API — Browse, search, corrections, config, admin
 */

import { neon } from '@neondatabase/serverless';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

// Restrict CORS to production domain only (set via env var or fallback)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://projeto-alma.netlify.app';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);
    const url = new URL(req.url);

    // Handle POST requests
    if (req.method === 'POST') {
      const body = await req.json();
      const action = body.action;

      switch (action) {
        case 'save_correction': return await handleSaveCorrection(sql, body);
        case 'save_config': return await handleSaveConfig(sql, body);
        case 'update_chunk': return await handleUpdateChunk(sql, body);
        case 'delete_chunk': return await handleDeleteChunk(sql, body);
        case 'promote_correction': return await handlePromoteCorrection(sql, body);
        case 'delete_correction': return await handleDeleteCorrection(sql, body);
        case 'create_chunk': return await handleCreateChunk(sql, body);
        case 'import_chunks': return await handleImportChunks(sql, body);
        case 'reactivate_correction': return await handleReactivateCorrection(sql, body);
        case 'add_directive': return await handleAddDirective(sql, body);
        case 'update_directive': return await handleUpdateDirective(sql, body);
        case 'delete_directive': return await handleDeleteDirective(sql, body);
        case 'classify_input': return await handleClassifyInput(sql, body);
        case 'migrate_directives': return await handleMigrateDirectives(sql, body);
        default: return jsonResponse({ error: 'Unknown POST action' }, 400);
      }
    }

    // Handle GET requests
    const action = url.searchParams.get('action') || 'stats';
    let result;

    switch (action) {
      case 'stats': {
        const docs = await sql`SELECT COUNT(*) as count FROM alma_documents`;
        const chunks = await sql`SELECT COUNT(*) as count FROM alma_chunks`;
        const categories = await sql`
          SELECT category, COUNT(*) as count FROM alma_chunks GROUP BY category ORDER BY count DESC
        `;
        const totalChars = await sql`SELECT SUM(char_count) as total FROM alma_chunks`;
        let correctionsCount = 0;
        try {
          const corr = await sql`SELECT COUNT(*) as count FROM alma_corrections WHERE active = true`;
          correctionsCount = parseInt(corr[0].count);
        } catch (e) {}

        result = {
          documents: parseInt(docs[0].count),
          chunks: parseInt(chunks[0].count),
          totalCharacters: parseInt(totalChars[0].total),
          corrections: correctionsCount,
          categories: categories.map(c => ({ name: c.category, chunks: parseInt(c.count) })),
        };
        break;
      }

      case 'search': {
        const q = url.searchParams.get('q') || '';
        const category = url.searchParams.get('category');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 20);

        if (!q && !category) { result = { error: 'Provide q or category parameter' }; break; }

        let rows;
        if (q) {
          const terms = q.split(/\s+/).filter(w => w.length > 2).join(' | ');
          if (category) {
            rows = await sql`
              SELECT id, title, category, content, tags, source_file
              FROM alma_chunks
              WHERE search_vector @@ to_tsquery('portuguese', ${terms}) AND category = ${category}
              ORDER BY ts_rank(search_vector, to_tsquery('portuguese', ${terms})) DESC
              LIMIT ${limit}
            `;
          } else {
            rows = await sql`
              SELECT id, title, category, content, tags, source_file
              FROM alma_chunks
              WHERE search_vector @@ to_tsquery('portuguese', ${terms})
              ORDER BY ts_rank(search_vector, to_tsquery('portuguese', ${terms})) DESC
              LIMIT ${limit}
            `;
          }
        } else {
          rows = await sql`
            SELECT id, title, category, content, tags, source_file
            FROM alma_chunks WHERE category = ${category} ORDER BY chunk_index ASC LIMIT ${limit}
          `;
        }
        result = { query: q, category, results: rows };
        break;
      }

      case 'categories': {
        const cats = await sql`
          SELECT category, COUNT(*) as chunks, COUNT(DISTINCT source_file) as documents
          FROM alma_chunks GROUP BY category ORDER BY chunks DESC
        `;
        result = { categories: cats };
        break;
      }

      // --- ADMIN: browse chunks with pagination ---
      case 'admin_chunks': {
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
        const perPage = Math.min(50, parseInt(url.searchParams.get('per_page') || '20'));
        const category = url.searchParams.get('category') || '';
        const q = url.searchParams.get('q') || '';
        const offset = (page - 1) * perPage;

        let rows, total;
        if (q) {
          const terms = q.split(/\s+/).filter(w => w.length > 2).join(' | ');
          if (terms) {
            rows = await sql`
              SELECT id, title, category, content, tags, source_file, char_count
              FROM alma_chunks
              WHERE search_vector @@ to_tsquery('portuguese', ${terms})
              ${category ? sql`AND category = ${category}` : sql``}
              ORDER BY ts_rank(search_vector, to_tsquery('portuguese', ${terms})) DESC
              LIMIT ${perPage} OFFSET ${offset}
            `;
            const countRes = await sql`
              SELECT COUNT(*) as c FROM alma_chunks
              WHERE search_vector @@ to_tsquery('portuguese', ${terms})
              ${category ? sql`AND category = ${category}` : sql``}
            `;
            total = parseInt(countRes[0].c);
          } else {
            rows = []; total = 0;
          }
        } else if (category) {
          rows = await sql`
            SELECT id, title, category, content, tags, source_file, char_count
            FROM alma_chunks WHERE category = ${category}
            ORDER BY chunk_index ASC LIMIT ${perPage} OFFSET ${offset}
          `;
          const countRes = await sql`SELECT COUNT(*) as c FROM alma_chunks WHERE category = ${category}`;
          total = parseInt(countRes[0].c);
        } else {
          rows = await sql`
            SELECT id, title, category, content, tags, source_file, char_count
            FROM alma_chunks ORDER BY category, chunk_index ASC LIMIT ${perPage} OFFSET ${offset}
          `;
          const countRes = await sql`SELECT COUNT(*) as c FROM alma_chunks`;
          total = parseInt(countRes[0].c);
        }
        result = { chunks: rows, total, page, perPage, totalPages: Math.ceil(total / perPage) };
        break;
      }

      // --- ADMIN: list all corrections with full details ---
      case 'admin_corrections': {
        try {
          const rows = await sql`
            SELECT id, original_question, original_response, correction, filho_nome, created_at, active, categories
            FROM alma_corrections ORDER BY created_at DESC LIMIT 100
          `;
          result = { corrections: rows };
        } catch (e) {
          result = { corrections: [] };
        }
        break;
      }

      case 'corrections': {
        try {
          const rows = await sql`
            SELECT id, original_question, correction, filho_nome, created_at
            FROM alma_corrections WHERE active = true ORDER BY created_at DESC LIMIT 50
          `;
          result = { corrections: rows };
        } catch (e) {
          result = { corrections: [] };
        }
        break;
      }

      // --- ADMIN: list directives ---
      case 'list_directives': {
        const person = url.searchParams.get('person') || '';
        try {
          let rows;
          if (person === '_all') {
            rows = await sql`
              SELECT id, person, directive_text, created_at, updated_at, active, source
              FROM alma_directives WHERE active = true ORDER BY person NULLS FIRST, created_at ASC
            `;
          } else if (person) {
            rows = await sql`
              SELECT id, person, directive_text, created_at, updated_at, active, source
              FROM alma_directives WHERE active = true AND (person = ${person} OR person IS NULL)
              ORDER BY person NULLS FIRST, created_at ASC
            `;
          } else {
            rows = await sql`
              SELECT id, person, directive_text, created_at, updated_at, active, source
              FROM alma_directives WHERE active = true ORDER BY person NULLS FIRST, created_at ASC
            `;
          }
          result = { directives: rows };
        } catch (e) {
          if (e.message.includes('does not exist')) {
            await ensureDirectivesTable(sql);
            result = { directives: [] };
          } else {
            result = { directives: [], error: e.message };
          }
        }
        break;
      }

      case 'get_config': {
        const key = url.searchParams.get('key') || '';
        if (!key) { result = { error: 'Missing key parameter' }; break; }
        try {
          const rows = await sql`SELECT value FROM alma_config WHERE key = ${key} LIMIT 1`;
          result = { key, value: rows.length > 0 ? rows[0].value : null };
        } catch (e) {
          result = { key, value: null };
        }
        break;
      }

      default:
        result = { error: 'Unknown action' };
    }

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

// --- POST request handlers ---

async function handleSaveCorrection(sql, body) {
  const { originalQuestion, originalResponse, correction } = body;
  const personName = body.personName || body.filhoNome || ''; // Support v2 + v1 field names
  if (!correction || !originalResponse) {
    return jsonResponse({ error: 'Missing correction or originalResponse' }, 400);
  }

  try {
    const result = await sql`
      INSERT INTO alma_corrections (original_question, original_response, correction, filho_nome)
      VALUES (${originalQuestion || ''}, ${originalResponse}, ${correction}, ${personName})
      RETURNING id, created_at
    `;
    return jsonResponse({ success: true, id: result[0].id, created_at: result[0].created_at });
  } catch (e) {
    if (e.message.includes('does not exist')) {
      await sql`
        CREATE TABLE IF NOT EXISTS alma_corrections (
          id SERIAL PRIMARY KEY, original_question TEXT NOT NULL, original_response TEXT NOT NULL,
          correction TEXT NOT NULL, filho_nome VARCHAR(50), categories TEXT[] DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), active BOOLEAN DEFAULT true
        )
      `;
      const result = await sql`
        INSERT INTO alma_corrections (original_question, original_response, correction, filho_nome)
        VALUES (${originalQuestion || ''}, ${originalResponse}, ${correction}, ${personName})
        RETURNING id, created_at
      `;
      return jsonResponse({ success: true, id: result[0].id, tableCreated: true });
    }
    throw e;
  }
}

async function handleSaveConfig(sql, body) {
  const { key, value } = body;
  if (!key) return jsonResponse({ error: 'Missing key' }, 400);

  try {
    await sql`
      INSERT INTO alma_config (key, value, updated_at) VALUES (${key}, ${value || ''}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${value || ''}, updated_at = NOW()
    `;
    return jsonResponse({ success: true, key });
  } catch (e) {
    if (e.message.includes('does not exist')) {
      await sql`
        CREATE TABLE IF NOT EXISTS alma_config (
          key VARCHAR(255) PRIMARY KEY, value TEXT NOT NULL DEFAULT '', updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      await sql`
        INSERT INTO alma_config (key, value, updated_at) VALUES (${key}, ${value || ''}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${value || ''}, updated_at = NOW()
      `;
      return jsonResponse({ success: true, key, tableCreated: true });
    }
    throw e;
  }
}

async function handleUpdateChunk(sql, body) {
  const { id, content, title, category, tags } = body;
  if (!id) return jsonResponse({ error: 'Missing id' }, 400);

  const updates = [];
  if (content !== undefined) {
    await sql`UPDATE alma_chunks SET content = ${content}, char_count = ${content.length},
      search_vector = to_tsvector('portuguese', ${content}) WHERE id = ${id}`;
  }
  if (title !== undefined) await sql`UPDATE alma_chunks SET title = ${title} WHERE id = ${id}`;
  if (category !== undefined) await sql`UPDATE alma_chunks SET category = ${category} WHERE id = ${id}`;
  if (tags !== undefined) await sql`UPDATE alma_chunks SET tags = ${tags}::TEXT[] WHERE id = ${id}`;

  return jsonResponse({ success: true, id });
}

async function handleDeleteChunk(sql, body) {
  const { id } = body;
  if (!id) return jsonResponse({ error: 'Missing id' }, 400);
  await sql`DELETE FROM alma_chunks WHERE id = ${id}`;
  return jsonResponse({ success: true, id });
}

async function handleCreateChunk(sql, body) {
  const { title, category, content, tags, source_file } = body;
  if (!content || !title) return jsonResponse({ error: 'Missing content or title' }, 400);

  const result = await sql`
    INSERT INTO alma_chunks (title, category, content, tags, source_file, char_count, chunk_index,
      search_vector)
    VALUES (${title}, ${category || 'correcao'}, ${content}, ${tags || ['correcao']}::TEXT[],
      ${source_file || 'admin_manual'}, ${content.length}, 0,
      to_tsvector('portuguese', ${content}))
    RETURNING id
  `;
  return jsonResponse({ success: true, id: result[0].id });
}

async function handlePromoteCorrection(sql, body) {
  const { id } = body;
  if (!id) return jsonResponse({ error: 'Missing id' }, 400);

  // Fetch the correction record
  const rows = await sql`SELECT * FROM alma_corrections WHERE id = ${id}`;
  if (rows.length === 0) return jsonResponse({ error: 'Correction not found' }, 404);

  const corr = rows[0];

  // Create a new chunk from the correction
  const chunkContent = corr.original_question
    ? `[CORREÇÃO — Pergunta: "${corr.original_question}"]\n${corr.correction}`
    : `[CORREÇÃO]\n${corr.correction}`;

  const chunkResult = await sql`
    INSERT INTO alma_chunks (title, category, content, tags, source_file, char_count, chunk_index,
      search_vector)
    VALUES (${'Correção #' + corr.id}, 'correcao', ${chunkContent},
      ${['correcao', 'ajuste_tom']}::TEXT[], 'correcao_promovida',
      ${chunkContent.length}, 0, to_tsvector('portuguese', ${chunkContent}))
    RETURNING id
  `;

  // Mark correction as promoted (keep active for system use)
  await sql`UPDATE alma_corrections SET categories = array_append(categories, 'promovida') WHERE id = ${id}`;

  return jsonResponse({ success: true, chunkId: chunkResult[0].id, correctionId: id });
}

async function handleDeleteCorrection(sql, body) {
  const { id } = body;
  if (!id) return jsonResponse({ error: 'Missing id' }, 400);
  await sql`UPDATE alma_corrections SET active = false WHERE id = ${id}`;
  return jsonResponse({ success: true, id });
}

async function handleReactivateCorrection(sql, body) {
  const { id } = body;
  if (!id) return jsonResponse({ error: 'Missing id' }, 400);
  await sql`UPDATE alma_corrections SET active = true WHERE id = ${id}`;
  return jsonResponse({ success: true, id });
}

// --- Directives table helper ---
async function ensureDirectivesTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS alma_directives (
      id SERIAL PRIMARY KEY,
      person VARCHAR(50), -- NULL = global
      directive_text TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      active BOOLEAN DEFAULT true,
      source VARCHAR(20) DEFAULT 'admin'
    )
  `;
}

async function handleAddDirective(sql, body) {
  const { person, directive_text, source } = body;
  if (!directive_text || !directive_text.trim()) {
    return jsonResponse({ error: 'Missing directive_text' }, 400);
  }

  try {
    const personVal = (!person || person === '_global') ? null : person;
    const result = await sql`
      INSERT INTO alma_directives (person, directive_text, source)
      VALUES (${personVal}, ${directive_text.trim()}, ${source || 'admin'})
      RETURNING id, created_at
    `;
    return jsonResponse({ success: true, id: result[0].id, created_at: result[0].created_at });
  } catch (e) {
    if (e.message.includes('does not exist')) {
      await ensureDirectivesTable(sql);
      const personVal = (!person || person === '_global') ? null : person;
      const result = await sql`
        INSERT INTO alma_directives (person, directive_text, source)
        VALUES (${personVal}, ${directive_text.trim()}, ${source || 'admin'})
        RETURNING id, created_at
      `;
      return jsonResponse({ success: true, id: result[0].id, tableCreated: true });
    }
    throw e;
  }
}

async function handleUpdateDirective(sql, body) {
  const { id, directive_text } = body;
  if (!id) return jsonResponse({ error: 'Missing id' }, 400);
  if (!directive_text || !directive_text.trim()) return jsonResponse({ error: 'Missing directive_text' }, 400);

  await sql`
    UPDATE alma_directives SET directive_text = ${directive_text.trim()}, updated_at = NOW()
    WHERE id = ${id}
  `;
  return jsonResponse({ success: true, id });
}

async function handleDeleteDirective(sql, body) {
  const { id } = body;
  if (!id) return jsonResponse({ error: 'Missing id' }, 400);
  await sql`UPDATE alma_directives SET active = false WHERE id = ${id}`;
  return jsonResponse({ success: true, id });
}

// Classifies user input as correction, individual directive, or global directive.
// Uses Claude AI to analyze text and returns classification type, target person, refined text, and explanation.
async function handleClassifyInput(sql, body) {
  const { text, originalQuestion, originalResponse } = body;
  const personName = body.personName || body.filhoNome || ''; // Support v2 + v1
  if (!text) return jsonResponse({ error: 'Missing text' }, 400);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return jsonResponse({ error: 'API key not configured' }, 500);

  // Classification prompt (Portuguese — injected into Claude for analysis)
  const systemPrompt = `Você é um assistente do sistema ALMA. Analise o texto do Maurício e classifique:

TIPOS:
1. "correction" — corrige algo errado que o ALMA respondeu (tom, fato, abordagem)
2. "directive_individual" — instrução de como o ALMA deve se comportar com UMA pessoa específica
3. "directive_global" — instrução de como o ALMA deve se comportar com TODOS

CONTEXTO:
- Pessoa atual na conversa: ${personName || 'desconhecido'}
- Pergunta original: ${originalQuestion || 'N/A'}
- Resposta do ALMA: ${originalResponse ? originalResponse.substring(0, 200) : 'N/A'}

Responda APENAS em JSON válido (sem markdown):
{
  "type": "correction" | "directive_individual" | "directive_global",
  "person": "Nome" ou null,
  "refined_text": "texto refinado e claro da diretriz/correção",
  "explanation": "explicação curta em português do porquê esta classificação"
}`;

  try {
    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`API ${response.status}: ${errData.error?.message || ''}`);
    }

    const data = await response.json();
    const rawText = data.content[0].text.trim();

    // Parse JSON from response (handle possible markdown wrapping)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid AI response format');

    const classification = JSON.parse(jsonMatch[0]);
    return jsonResponse({ success: true, classification });
  } catch (e) {
    return jsonResponse({ error: 'Classification failed: ' + e.message }, 500);
  }
}

// One-time migration: parses existing alma_config directive texts into individual alma_directives entries.
// Reads configuration keys for each person and splits them into separate directive records.
async function handleMigrateDirectives(sql, body) {
  await ensureDirectivesTable(sql);

  const persons = ['Noah', 'Nathan', 'Isaac', 'Chris', 'Leslen', 'Nivalda', '_global'];
  let migrated = 0;

  for (const person of persons) {
    const key = person === '_global' ? 'directives_global' : 'directives_' + person;
    try {
      const rows = await sql`SELECT value FROM alma_config WHERE key = ${key} LIMIT 1`;
      if (rows.length > 0 && rows[0].value && rows[0].value.trim()) {
        const text = rows[0].value.trim();
        // Split by newlines to create individual directives
        const lines = text.split(/\n+/).map(l => l.trim()).filter(l => l.length > 5);
        const personVal = person === '_global' ? null : person;

        for (const line of lines) {
          // Check if already exists (avoid duplicate migration)
          const existing = await sql`
            SELECT id FROM alma_directives
            WHERE directive_text = ${line} AND (person = ${personVal} OR (person IS NULL AND ${personVal} IS NULL))
            LIMIT 1
          `;
          if (existing.length === 0) {
            await sql`
              INSERT INTO alma_directives (person, directive_text, source)
              VALUES (${personVal}, ${line}, 'migrated')
            `;
            migrated++;
          }
        }
      }
    } catch (e) {
      // Skip if config doesn't exist
    }
  }

  return jsonResponse({ success: true, migrated });
}

async function handleImportChunks(sql, body) {
  const { title, category, tags, chunks } = body;
  if (!title || !chunks || !Array.isArray(chunks) || chunks.length === 0) {
    return jsonResponse({ error: 'Missing title or chunks array' }, 400);
  }

  const sourceFile = 'import_' + title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').substring(0, 60);
  const finalCategory = category || 'manual';
  const finalTags = tags && tags.length > 0 ? tags : [finalCategory];

  // First, register in alma_documents
  try {
    await sql`
      INSERT INTO alma_documents (file_name, category, total_chunks, total_chars, imported_at)
      VALUES (${sourceFile}, ${finalCategory}, ${chunks.length},
        ${chunks.reduce((s, c) => s + c.length, 0)}, NOW())
    `;
  } catch (e) {
    // Table might not have all columns or might not exist — that's ok, continue with chunks
  }

  // Insert all chunks
  let created = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunkContent = chunks[i];
    const chunkTitle = chunks.length === 1 ? title : title + ' (' + (i + 1) + '/' + chunks.length + ')';

    await sql`
      INSERT INTO alma_chunks (title, category, content, tags, source_file, char_count, chunk_index,
        search_vector)
      VALUES (${chunkTitle}, ${finalCategory}, ${chunkContent}, ${finalTags}::TEXT[],
        ${sourceFile}, ${chunkContent.length}, ${i},
        to_tsvector('portuguese', ${chunkContent}))
    `;
    created++;
  }

  return jsonResponse({ success: true, chunksCreated: created, sourceFile });
}
