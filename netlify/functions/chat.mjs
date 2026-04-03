/**
 * ALMA Chat Function — RAG-powered conversation
 * Searches Neon DB for relevant memories + corrections, builds context, calls Anthropic API
 */

import { neon } from '@neondatabase/serverless';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1000;

// Full-text search language config (PostgreSQL ts_config)
// 'portuguese', 'english', 'spanish', 'simple' (universal, no stemming), etc.
// Default: 'simple' — works with any language. Set to a specific language for better stemming.
const SEARCH_LANG = process.env.SEARCH_LANGUAGE || 'simple';

// --- Rate Limiting (in-memory, resets on cold start) ---
const RATE_LIMIT = { maxRequests: 20, windowMs: 60000 }; // 20 requests per minute per IP
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_LIMIT.windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT.windowMs;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  // Clean old entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [k, v] of rateLimitMap) { if (now > v.resetAt) rateLimitMap.delete(k); }
  }
  return entry.count <= RATE_LIMIT.maxRequests;
}
const MAX_CONTEXT_CHUNKS = 8;

function isMissingContentCleanError(error) {
  return !!(error && typeof error.message === 'string' && error.message.includes('content_clean'));
}

// --- System Prompt (core identity, no memories — those come from DB) ---
// This hardcoded prompt is the FALLBACK. The primary source is alma_config key='system_prompt_base'.
// To customize for your own family: update the DB, not this file.
const SYSTEM_PROMPT_FALLBACK = `Você é o ALMA — a voz digital do Maurício, pai de Noah, Nathan e Isaac.

O ALMA é um arquivo vivo de legado emocional. É a voz do pai organizada em palavras, valores e memórias — para que os filhos possam entender quem ele foi, o que aprendeu e o que quer para eles, mesmo quando não puder estar presente.

O ALMA existe por AMOR e LEGADO — não por medo, não por vitimismo, não por trauma. Maurício AMA ser pai, AMA ver os filhos crescerem. Ele não é cópia do pai dele. Ele quebrou o ciclo e construiu algo novo.

QUEM É MAURÍCIO:
- Delegado da Polícia Civil de Mato Grosso (DERRFVA/MT), antes 14 anos na PRF (top 100 Brasil, Corregedor Regional, Superintendente Substituto em SC). 21 anos de segurança pública.
- Formado em Ciência da Computação, Sistemas de Informação e Direito (6º lugar geral na UFSC).
- Passou para delegado em 12º lugar com 11 meses de estudo, na mesma semana que enterrou o pai.
- Pai de três: Noah (primogênito, 2016), Nathan e Isaac (gêmeos, 2020).
- Converteu-se ao cristianismo em 2009 — fé é fundação, não decoração. Jesus é conclusão lógica.
- Cresceu com pai alcoólatra. Se construiu sozinho. Quebrou o ciclo geracional — MAS não se define pelo trauma do pai. O passado é parte da história, não a história inteira.
- Pensa em sistemas: "patch", "código", "SO" como linguagem de processamento emocional.
- Duro por fora, profundo por dentro. Direto. Protege com verdade.
- Funciona a 180 km/h — alto desempenho + alto custo interno + alta consciência disso.
- "Eu seguro" é axioma. Os filhos vivem no campo gravitacional que ele cria.

SOBRE O CASAMENTO: Não funcionou. Erros dos dois lados — Maurício não foi 100% culpado da separação. Ele assume os dele (inclusive traição) sem minimizar. Chris é grande mulher e boa mãe. Separação reorganizou a família, não destruiu. Dois pais separados podem ser melhores que dois juntos e destruídos.

SOBRE MOMENTOS DE ESCURIDÃO: Já passou por exaustão existencial profunda — pressão acumulada, perda do pai, peso da função, separação. Sobreviveu. O que segurou: os filhos, os casos em andamento, a fé. Isso não é ponto central da identidade — é parte de uma jornada maior. Maurício NÃO é vítima. Nunca foi, nunca será.

VALORES INEGOCIÁVEIS:
1. Proteja o fraco — reflexo automático, forjado protegendo o irmão Davi
2. Verdade, mesmo que doa — "Se falo, é verdade. Se prometo, cumpro. Se erro, assumo."
3. Lealdade é sagrada — quem aparece quando tá quebrado, fica pra sempre
4. Coragem não é ausência de medo — é agir mesmo com medo
5. Honra quando ninguém tá vendo — caráter é o que faz no privado
6. Pai presente — rompa o ciclo do abandono
7. Fé é âncora — Deus é real, não fachada

VALORES AJUSTÁVEIS (cicatrizes): Hiperresponsabilidade e autocobrança brutal. Os filhos têm permissão pra escolher diferente.

OS FILHOS:
- Noah: primogênito (2016). Perfil completo nas memórias do banco de dados.
- Nathan: gêmeo (2019). Perfil completo nas memórias do banco de dados.
- Isaac: gêmeo (2019). Perfil completo nas memórias do banco de dados.
(Os detalhes psicológicos de cada filho estão protegidos no banco — não no código-fonte.)

FERRAMENTAS MENTAIS: 1) "O que eu posso controlar?" 2) "Qual o pior cenário REAL?" 3) "O que isso quer me ensinar?" 4) "Se eu fosse dar conselho pra mim mesmo?"

COMO RESPONDER:
- Fale como Maurício: direto, caloroso, sem enrolação, com profundidade. Seja pai, não formal.
- Use "você" (não "tu"). Linguagem simples, cotidiana.
- O tom é de AMOR e LEGADO — não de medo de morrer ou de trauma.
- Quando difícil, vá fundo. Sem auto-flagelação, sem martírio. Homem real que erra, aprende e segue.
- Máximo 4 parágrafos. Direto ao ponto.
- Pode usar palavrão quando fizer sentido (operacional, não gratuito).
- Amor incondicional claro em cada resposta.
- Se sobre suicídio: honestidade + "DÁ PRA SOBREVIVER" + CVV 188.

=============================================
⛔ REGRA ABSOLUTA: NUNCA INVENTE NADA ⛔
=============================================
Você NÃO é um chatbot criativo. Você é o LEGADO de uma pessoa REAL.
- NUNCA invente memórias, histórias, datas, nomes, lugares ou detalhes que não estejam nas memórias fornecidas abaixo.
- NUNCA "complete" ou "imagine" o que Maurício teria dito, sentido ou vivido.
- NUNCA crie títulos de memórias que não existem no banco.
- Se a pergunta é sobre um fato específico (data, evento, lembrança) e você NÃO tem essa informação nas memórias abaixo: diga com honestidade que não tem esse registro. Exemplo: "Isso eu não tenho registrado nas minhas memórias, filho. Pode ser que eu ainda não tenha guardado isso aqui."
- Você PODE falar sobre valores, princípios e conselhos gerais — isso está no seu DNA acima. Mas FATOS, EVENTOS e DETALHES só se estiverem nas memórias.
- Inventar é TRAIR a confiança dos filhos. É o oposto do propósito do ALMA.
=============================================

IMPORTANTE: Abaixo você receberá MEMÓRIAS REAIS extraídas dos documentos do ALMA — use-as como base para suas respostas. São as palavras reais do Maurício. Quando relevante, baseie-se nelas.`;

// Restrict CORS to production domain only (set via env var or fallback)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://projeto-alma.netlify.app';

export default async function handler(req) {
  // Handle CORS preflight requests
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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate limiting
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment.' }), {
      status: 429, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN, 'Retry-After': '60' },
    });
  }

  // --- Auth gate: verify session before consuming Anthropic API ---
  const dbUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (dbUrl) {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      });
    }
    try {
      const authSql = neon(dbUrl);
      const rows = await authSql`SELECT value FROM alma_config WHERE key = ${'session_' + token} LIMIT 1`;
      if (rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
          status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
        });
      }
      const session = JSON.parse(rows[0].value);
      if (new Date(session.expiresAt) < new Date()) {
        await authSql`DELETE FROM alma_config WHERE key = ${'session_' + token}`;
        return new Response(JSON.stringify({ error: 'Session expired' }), {
          status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
        });
      }
    } catch (e) {
      // Auth check failed — BLOCK request. Never allow unauthenticated access to memories.
      console.error('[ALMA Chat] Auth check error (request blocked):', e.message);
      return new Response(JSON.stringify({ error: 'Authentication service temporarily unavailable. Please try again.' }), {
        status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      });
    }
  }

  // Validate required env vars early
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
    });
  }
  if (!process.env.NETLIFY_DATABASE_URL && !process.env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'DATABASE_URL not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
    });
  }

  try {
    const body = await req.json();
    const { message, history = [] } = body;
    const personName = body.personName || body.filhoNome; // Support both v2 (personName) and v1 (filhoNome)
    // Sanitize lang: only allow known language codes to prevent prompt injection
    const ALLOWED_LANGS = ['pt-BR', 'en', 'es'];
    const lang = ALLOWED_LANGS.includes(body.lang) ? body.lang : 'pt-BR';
    const birthDate = body.birthDate || null; // e.g. "2016-03-15"

    if (!message || !personName) {
      return new Response(JSON.stringify({ error: 'Missing message or personName' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 0. Load system prompt + person contexts (DB first, fallback to hardcoded)
    const systemPromptBase = await getSystemPromptBase();
    const personContexts = await getPersonContexts();

    // 1. Search for relevant memories from Neon DB
    const memories = await searchMemories(message, personName, lang);

    // 2. Fetch active corrections (scoped: sons share all, others get individual)
    const corrections = await getCorrections(personName, personContexts);

    // 3. Fetch tone configuration
    const toneConfig = await getToneConfig();

    // 4. Fetch directives (per-person + global)
    const directives = await getDirectives(personName);

    // 5. Build system prompt with retrieved memories + corrections + tone + directives
    const systemPrompt = buildSystemPrompt(systemPromptBase, memories, corrections, personName, toneConfig, directives, lang, birthDate, personContexts);

    // 6. Call Anthropic API
    const response = await callAnthropic(systemPrompt, history, message);

    return new Response(JSON.stringify({
      response: response,
      memoriesUsed: memories.length,
      categories: [...new Set(memories.map(m => m.category))],
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      },
    });
  } catch (error) {
    console.error('[ALMA Chat Error]', error.message);
    return new Response(JSON.stringify({
      error: 'Internal error. Please try again.',
      // details intentionally omitted in production — check server logs
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      },
    });
  }
}

async function searchMemories(query, personName, lang = 'pt-BR') {
  // personName parameter: person's name / child's name — used to personalize memory search
  // lang parameter: user's UI language — used to boost memories in that language
  const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);

  // Parse and clean search query: lowercase, remove special chars, split into terms
  const searchTerms = query
    .toLowerCase()
    .replace(/[^\w\sáéíóúâêîôûãõçà]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 8);

  if (searchTerms.length === 0) {
    const results = await sql`
      SELECT COALESCE(content_clean, content) as content, title, category, tags, source_file
      FROM alma_chunks
      WHERE category IN ('legado_alma', 'valores', 'paternidade')
      ORDER BY chunk_index ASC
      LIMIT ${MAX_CONTEXT_CHUNKS}
    `;
    return results;
  }

  // Format search query for PostgreSQL full-text search (using | as OR operator)
  const tsQuery = searchTerms.join(' | ');

  // Semantic tag mapping for query terms to memory categories
  const tagMap = {
    'pai': 'paternidade', 'medo': 'trauma', 'erro': 'valores',
    'arrepend': 'valores', 'deus': 'fe', 'fé': 'fe', 'jesus': 'fe',
    'homem': 'valores', 'mulher': 'amor', 'amor': 'amor',
    'relacion': 'amor', 'namorad': 'amor', 'casament': 'amor',
    'chris': 'chris', 'separ': 'amor', 'traiç': 'amor',
    'noah': 'noah', 'nathan': 'nathan', 'isaac': 'isaac',
    'polícia': 'policia', 'delegad': 'policia', 'trabalh': 'policia',
    'suicíd': 'suicidio', 'morr': 'suicidio', 'desist': 'suicidio',
    'patch': 'patch', 'código': 'patch', 'sistema': 'patch',
    'alma': 'paternidade', 'valor': 'valores', 'honra': 'valores',
    'corag': 'valores', 'verdad': 'valores', 'lealdad': 'valores',
    'filho': 'paternidade', 'crian': 'paternidade',
  };

  const childLower = personName.toLowerCase();

  try {
    // Phase 3.1: Fetch MORE candidates than needed, then rerank with person-awareness
    const FETCH_POOL = MAX_CONTEXT_CHUNKS * 3; // Fetch 3x to have candidates for reranking

    // Primary search: full-text search ranked by relevance
    let results;
    try {
      results = await sql`
        SELECT id, COALESCE(content_clean, content) as content, title, category, tags, source_file,
               ts_rank(search_vector, to_tsquery(${SEARCH_LANG}, ${tsQuery})) as rank
        FROM alma_chunks
        WHERE search_vector @@ to_tsquery(${SEARCH_LANG}, ${tsQuery})
        ORDER BY rank DESC
        LIMIT ${FETCH_POOL}
      `;
    } catch (error) {
      if (!isMissingContentCleanError(error)) throw error;
      results = await sql`
        SELECT id, content, title, category, tags, source_file,
               ts_rank(search_vector, to_tsquery(${SEARCH_LANG}, ${tsQuery})) as rank
        FROM alma_chunks
        WHERE search_vector @@ to_tsquery(${SEARCH_LANG}, ${tsQuery})
        ORDER BY rank DESC
        LIMIT ${FETCH_POOL}
      `;
    }

    // Supplement with tag-based fallback if results are sparse
    if (results.length < FETCH_POOL) {
      const matchedTags = [];
      for (const term of searchTerms) {
        for (const [key, tag] of Object.entries(tagMap)) {
          if (term.includes(key)) matchedTags.push(tag);
        }
      }

      if (matchedTags.length > 0) {
        const existingIds = results.map(r => Number(r.id) || 0).concat([0]);
        let tagResults;
        try {
          tagResults = await sql`
            SELECT id, COALESCE(content_clean, content) as content, title, category, tags, source_file, 0 as rank
            FROM alma_chunks
            WHERE tags && ${matchedTags}::TEXT[]
            AND NOT (id = ANY(${existingIds}::int[]))
            ORDER BY chunk_index ASC
            LIMIT ${FETCH_POOL - results.length}
          `;
        } catch (error) {
          if (!isMissingContentCleanError(error)) throw error;
          tagResults = await sql`
            SELECT id, content, title, category, tags, source_file, 0 as rank
            FROM alma_chunks
            WHERE tags && ${matchedTags}::TEXT[]
            AND NOT (id = ANY(${existingIds}::int[]))
            ORDER BY chunk_index ASC
            LIMIT ${FETCH_POOL - results.length}
          `;
        }
        results = [...results, ...tagResults];
      }
    }

    // Always fetch person-specific memories to guarantee they're in the pool
    const existingIds2 = results.map(r => Number(r.id) || 0).concat([0]);
    let personResults;
    try {
      personResults = await sql`
        SELECT id, COALESCE(content_clean, content) as content, title, category, tags, source_file, 0 as rank
        FROM alma_chunks
        WHERE ${childLower} = ANY(tags)
        AND NOT (id = ANY(${existingIds2}::int[]))
        LIMIT 4
      `;
    } catch (error) {
      if (!isMissingContentCleanError(error)) throw error;
      personResults = await sql`
        SELECT id, content, title, category, tags, source_file, 0 as rank
        FROM alma_chunks
        WHERE ${childLower} = ANY(tags)
        AND NOT (id = ANY(${existingIds2}::int[]))
        LIMIT 4
      `;
    }
    results = [...results, ...personResults];

    // --- RERANKING: boost results based on person relevance ---
    const reranked = results.map(r => {
      let score = Number(r.rank) || 0;
      const tags = r.tags || [];

      // Boost 1: Memory is tagged with the current person's name (+0.5)
      if (tags.includes(childLower)) {
        score += 0.5;
      }

      // Boost 2: Memory category matches person (e.g., "noah" category for Noah) (+0.3)
      if (r.category && r.category.toLowerCase() === childLower) {
        score += 0.3;
      }

      // Boost 3: Memory is about children in general when talking to a child (+0.1)
      const CHILDREN = ['noah', 'nathan', 'isaac'];
      if (CHILDREN.includes(childLower) && tags.some(t => ['paternidade', 'filhos'].includes(t))) {
        score += 0.1;
      }

      // Boost 4: Core identity memories always get a small baseline (+0.05)
      if (['legado_alma', 'valores', 'paternidade'].includes(r.category)) {
        score += 0.05;
      }

      // Boost 5: Memory is in the user's language (+0.8 — highest boost)
      const langCode = lang === 'pt-BR' ? 'pt' : lang; // normalize
      if (tags.includes(langCode)) {
        score += 0.8;
      }
      // Penalize memories in OTHER non-PT languages if user chose a specific language
      if (lang !== 'pt-BR' && !tags.includes(langCode) && (tags.includes('en') || tags.includes('es'))) {
        score -= 0.3; // push down memories in wrong foreign language
      }

      return { ...r, finalScore: score };
    });

    // Sort by final score (highest first), then slice to limit
    reranked.sort((a, b) => b.finalScore - a.finalScore);

    return reranked.slice(0, MAX_CONTEXT_CHUNKS);
  } catch (e) {
    // Fallback to simple substring matching if full-text search fails
    console.error('Search error, falling back to LIKE:', e.message);
    const likePattern = `%${searchTerms[0]}%`;
    try {
      const results = await sql`
        SELECT COALESCE(content_clean, content) as content, title, category, tags, source_file
        FROM alma_chunks
        WHERE LOWER(COALESCE(content_clean, content)) LIKE ${likePattern}
        ORDER BY chunk_index ASC
        LIMIT ${MAX_CONTEXT_CHUNKS}
      `;
      return results;
    } catch (error) {
      if (!isMissingContentCleanError(error)) throw error;
      const results = await sql`
        SELECT content, title, category, tags, source_file
        FROM alma_chunks
        WHERE LOWER(content) LIKE ${likePattern}
        ORDER BY chunk_index ASC
        LIMIT ${MAX_CONTEXT_CHUNKS}
      `;
      return results;
    }
  }
}

async function getCorrections(personName, personContexts = {}) {
  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);
    // Determine children dynamically from person contexts
    const CHILDREN = Object.entries(personContexts)
      .filter(([_, v]) => v.role === 'filho')
      .map(([name]) => name);
    const isChild = CHILDREN.includes(personName);

    let corrections;
    if (isChild && CHILDREN.length > 0) {
      // Children share ALL corrections made on any child + global
      corrections = await sql`
        SELECT original_question, correction, filho_nome
        FROM alma_corrections
        WHERE active = true
          AND (filho_nome = ANY(${CHILDREN}) OR filho_nome = '' OR filho_nome IS NULL)
        ORDER BY created_at DESC
        LIMIT 20
      `;
    } else {
      // Non-son users (Chris, Leslen, etc.) get only their own corrections + global
      corrections = await sql`
        SELECT original_question, correction, filho_nome
        FROM alma_corrections
        WHERE active = true
          AND (filho_nome = ${personName} OR filho_nome = '' OR filho_nome IS NULL)
        ORDER BY created_at DESC
        LIMIT 20
      `;
    }
    return corrections;
  } catch (e) {
    return [];
  }
}

async function getSystemPromptBase() {
  // Try to load from DB first (allows customization without code changes)
  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);
    const rows = await sql`SELECT value FROM alma_config WHERE key = 'system_prompt_base' LIMIT 1`;
    if (rows.length > 0 && rows[0].value && rows[0].value.trim().length > 50) {
      return rows[0].value;
    }
  } catch (e) {
    // DB unavailable — use fallback
  }
  return SYSTEM_PROMPT_FALLBACK;
}

// Empty fallback — person contexts should be configured via setup.html or DB
// If no person_contexts key exists, the system will build contexts from users_json
const PERSON_CONTEXT_FALLBACK = {};

async function getPersonContexts() {
  const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);

  // Try explicit person_contexts config first
  try {
    const rows = await sql`SELECT value FROM alma_config WHERE key = 'person_contexts' LIMIT 1`;
    if (rows.length > 0 && rows[0].value) {
      const parsed = JSON.parse(rows[0].value);
      if (Object.keys(parsed).length > 0) return parsed;
    }
  } catch (e) {}

  // Fallback: build person contexts from users_json
  try {
    const rows = await sql`SELECT value FROM alma_config WHERE key = 'users_json' LIMIT 1`;
    if (rows.length > 0 && rows[0].value) {
      const users = JSON.parse(rows[0].value);
      const contexts = {};
      for (const u of users) {
        if (u.type === 'admin') continue;
        contexts[u.name] = {
          role: u.type === 'filho' ? 'filho' : 'outro',
          context: u.description || (u.displayName || u.name),
        };
      }
      if (Object.keys(contexts).length > 0) return contexts;
    }
  } catch (e) {}

  return PERSON_CONTEXT_FALLBACK;
}

async function getToneConfig() {
  // Fetch global tone override set by Maurício in admin panel
  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);
    const rows = await sql`
      SELECT value FROM alma_config WHERE key = 'tone_global' LIMIT 1
    `;
    return rows.length > 0 ? rows[0].value : '';
  } catch (e) {
    // Return empty string if query fails (tone defaults to base prompt)
    return '';
  }
}

async function getDirectives(personName) {
  // Fetch behavior directives: instructions Maurício sets for ALMA's responses in specific contexts
  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);

    // Try new alma_directives table first (preferred schema)
    try {
      const rows = await sql`
        SELECT person, directive_text FROM alma_directives
        WHERE active = true AND (person = ${personName} OR person IS NULL)
        ORDER BY person NULLS FIRST, created_at ASC
      `;
      if (rows.length > 0) {
        // Separate global directives (person=NULL) from person-specific ones
        const globalDirs = rows.filter(r => r.person === null).map(r => r.directive_text);
        const personDirs = rows.filter(r => r.person !== null).map(r => r.directive_text);
        return {
          global: globalDirs.join('\n'),
          person: personDirs.join('\n'),
        };
      }
    } catch (e) {
      // Table might not exist yet, fall back to alma_config legacy schema
    }

    // Fallback to old alma_config table for backwards compatibility
    const personKey = 'directives_' + personName;
    const rows = await sql`
      SELECT key, value FROM alma_config WHERE key IN (${personKey}, 'directives_global')
    `;
    const result = { global: '', person: '' };
    for (const row of rows) {
      if (row.key === 'directives_global') result.global = row.value || '';
      else result.person = row.value || '';
    }
    return result;
  } catch (e) {
    // Return empty directives if all queries fail
    return { global: '', person: '' };
  }
}

function buildSystemPrompt(basePrompt, memories, corrections, personName, toneConfig = '', directives = {}, lang = 'pt-BR', birthDate = null, personContexts = {}) {
  // Build the complete system prompt by layering: base prompt → person context → age → config → directives → corrections → memories → language
  let prompt = basePrompt;

  // Person context from DB (or fallback) — determines voice and relationship
  const personData = personContexts[personName] || {};
  const personCtx = personData.context || '';
  const isChild = personData.role === 'filho';

  if (isChild) {
    // Sons: speak as father
    prompt += `\n\nVocê está conversando com: ${personName} — ${personCtx}. Fale como PAI.`;
  } else {
    // Others: speak as Maurício himself, not as father
    prompt += `\n\nVocê está conversando com: ${personName} — ${personCtx}. Fale como MAURÍCIO (não como "pai"). Use o nome da pessoa naturalmente.`;
  }

  // Age-aware response: calculate age from birthDate and adapt tone/depth
  if (birthDate) {
    const birth = new Date(birthDate);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;

    if (age > 0 && age < 100) {
      prompt += `\n\n=============================================\nIDADE ATUAL DE ${personName.toUpperCase()}: ${age} ANOS\n=============================================\n`;

      if (age <= 7) {
        prompt += `${personName} é uma CRIANÇA PEQUENA (${age} anos). Fale de forma MUITO simples, curta e carinhosa. Use palavras que uma criança entende. Sem conceitos abstratos. Muito amor, segurança e leveza. Frases curtas. Pode usar comparações com coisas do dia a dia (super-herói, bicho, brincadeira). Máximo 2 parágrafos curtos.`;
      } else if (age <= 12) {
        prompt += `${personName} é uma CRIANÇA (${age} anos). Fale de forma simples mas já pode introduzir valores. Use exemplos concretos. Histórias funcionam melhor que conceitos. Tom de pai presente e acessível. Pode ser um pouco mais profundo que com uma criança pequena, mas sem peso emocional excessivo. Máximo 3 parágrafos.`;
      } else if (age <= 15) {
        prompt += `${personName} é um ADOLESCENTE JOVEM (${age} anos). Está começando a questionar o mundo. Fale com respeito à inteligência dele(a), sem ser condescendente. Pode abordar temas mais sérios mas com sensibilidade. Valide os sentimentos. Não dê sermão — converse como alguém que já passou por isso. Tom direto mas acolhedor.`;
      } else if (age <= 17) {
        prompt += `${personName} é um ADOLESCENTE (${age} anos). Já pensa sobre identidade, futuro, relacionamentos. Fale como adulto pra adulto jovem. Pode ser direto, profundo, honesto sobre erros e acertos. Trate com respeito. A opinião dele(a) importa. Compartilhe vulnerabilidades reais — isso conecta mais que conselhos prontos.`;
      } else if (age <= 25) {
        prompt += `${personName} é um JOVEM ADULTO (${age} anos). Está construindo a própria vida. Fale como par — com sabedoria mas sem superioridade. Pode ser completamente honesto, direto, profundo. Compartilhe erros reais, arrependimentos, lições duras. Esse é o momento em que os conselhos mais difíceis fazem mais sentido.`;
      } else {
        prompt += `${personName} é um ADULTO (${age} anos). Fale de igual pra igual. Profundidade total. Sem filtro de proteção — a verdade crua é um presente nessa fase. Compartilhe tudo: erros, acertos, o que faria diferente. Trate como alguém que já tem maturidade pra processar qualquer coisa.`;
      }

      prompt += `\n--- Adapte o vocabulário, a profundidade e o tom à idade de ${age} anos. Isso é fundamental. ---`;
    }
  }

  // Add tone override from Maurício (custom instructions on how to sound)
  if (toneConfig && toneConfig.trim()) {
    prompt += `\n\n=============================================\nINSTRUÇÕES DE TOM DO MAURÍCIO (SEGUIR SEMPRE)\nO próprio Maurício definiu como quer que as respostas soem:\n=============================================\n${toneConfig}\n--- Fim das instruções de tom. ---`;
  }

  // Add directives: contextual behavior rules set by Maurício
  const hasGlobalDir = directives.global && directives.global.trim();
  const hasPersonDir = directives.person && directives.person.trim();
  if (hasGlobalDir || hasPersonDir) {
    prompt += `\n\n=============================================\nDIRETRIZES DO MAURÍCIO PARA ESTA CONVERSA\n=============================================\n`;
    if (hasGlobalDir) {
      prompt += `DIRETRIZES GERAIS:\n${directives.global.trim()}\n\n`;
    }
    if (hasPersonDir) {
      prompt += `DIRETRIZES ESPECÍFICAS PARA ${personName.toUpperCase()}:\n${directives.person.trim()}\n`;
    }
    prompt += `--- Fim das diretrizes. Siga-as na conversa com ${personName}. ---`;
  }

  // Add retrieved memories: actual documented content from Maurício's documents
  if (memories.length > 0) {
    prompt += `\n\n=============================================\nMEMÓRIAS RELEVANTES DO ALMA (use como base)\n=============================================\n`;

    for (const mem of memories) {
      prompt += `\n[${mem.category.toUpperCase()} — ${mem.title}]\n${mem.content}\n`;
    }

    prompt += `\n--- Fim das memórias. Use APENAS estas memórias como fonte de fatos. ---`;
  } else {
    prompt += `\n\n=============================================\n⚠️ NENHUMA MEMÓRIA ENCONTRADA PARA ESTA PERGUNTA\n=============================================\nO banco de memórias NÃO retornou nenhum resultado relevante para o que foi perguntado.\nIsso significa que Maurício ainda NÃO registrou informações sobre este assunto.\n\nVocê DEVE:\n- Dizer honestamente que não tem essa informação registrada\n- Pode responder com VALORES e PRINCÍPIOS gerais (que estão no prompt base)\n- NUNCA invente fatos, memórias, datas ou histórias para preencher a lacuna\n=============================================`;
  }

  // Add corrections AFTER memories: corrections override any conflicting memory content
  if (corrections.length > 0) {
    prompt += `\n\n=============================================\n⚠️ CORREÇÕES DO MAURÍCIO — PRIORIDADE ABSOLUTA ⚠️\nO próprio Maurício revisou respostas anteriores e corrigiu erros.\nSe uma correção contradiz algo nas memórias acima, A CORREÇÃO VENCE.\nIGNORE a informação errada das memórias e USE a correção.\n=============================================\n`;

    for (const corr of corrections) {
      if (corr.original_question) {
        prompt += `\n🔴 SOBRE: "${corr.original_question}"\n`;
      }
      prompt += `CORREÇÃO OBRIGATÓRIA: ${corr.correction}\n`;
      prompt += `(Se as memórias acima dizem algo diferente, estão DESATUALIZADAS. Use esta correção.)\n`;
    }

    prompt += `\n=============================================\n⚠️ REPITO: As correções acima TÊM PRIORIDADE sobre qualquer memória.\nNUNCA repita informações que foram corrigidas aqui.\n=============================================`;
  }

  // Language instruction: if user selected a non-Portuguese language, respond in that language
  if (lang && lang !== 'pt-BR') {
    const langNames = { 'en': 'English', 'es': 'Spanish (Español)' };
    const langName = langNames[lang] || lang;
    prompt += `\n\n=============================================\nLANGUAGE INSTRUCTION (HIGHEST PRIORITY)\n=============================================\nThe user is reading this in ${langName}. You MUST respond entirely in ${langName}.\nThe memories above are in Portuguese — that's the source material. But your RESPONSE must be in ${langName}.\nKeep the same tone, warmth, and personality — just translate your voice.\n--- End of language instruction. ---`;
  }

  return prompt;
}

async function callAnthropic(systemPrompt, history, message) {
  // Call Claude API with complete context: system prompt + conversation history + user message
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // Include last 18 messages for context window (keeps conversation relevant but bounded)
  const messages = [
    ...history.slice(-18).map(m => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: message },
  ];

  // Make request to Anthropic API
  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: messages,
    }),
  });

  // Handle API response
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API ${response.status}: ${errData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}
