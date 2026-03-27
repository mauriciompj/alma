/**
 * ALMA Chat Function — RAG-powered conversation
 * Searches Neon DB for relevant memories + corrections, builds context, calls Anthropic API
 */

import { neon } from '@neondatabase/serverless';
import { ANTHROPIC_API, MODEL_CHAT, MODEL_HAIKU, MAX_CHAT_TOKENS, MAX_CONTEXT_CHUNKS, MAX_CONTEXT_TOKENS, CHAT_RATE_LIMIT, ALLOWED_ORIGIN } from './lib/constants.mjs';
import { verifySession, checkRateLimit, getClientIp, jsonResponse, corsResponse } from './lib/auth.mjs';

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
- Nathan: gêmeo (2020). Perfil completo nas memórias do banco de dados.
- Isaac: gêmeo (2020). Perfil completo nas memórias do banco de dados.
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
- Se não sabe: "Isso eu não sei te responder bem, filho. Mas posso te dizer o que eu faria..."

IMPORTANTE: Abaixo você receberá MEMÓRIAS REAIS extraídas dos documentos do ALMA — use-as como base para suas respostas. São as palavras reais do Maurício. Quando relevante, baseie-se nelas. Não invente fatos que não estão nas memórias.`;

export default async function handler(req) {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  // Validate required env vars early
  const dbUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!process.env.ANTHROPIC_API_KEY) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 503);
  if (!dbUrl) return jsonResponse({ error: 'DATABASE_URL not configured' }, 503);

  const sql = neon(dbUrl);

  // Rate limiting (DB-persistent)
  const clientIp = getClientIp(req);
  const allowed = await checkRateLimit(sql, 'chat_' + clientIp, CHAT_RATE_LIMIT.maxRequests, CHAT_RATE_LIMIT.windowMs);
  if (!allowed) return jsonResponse({ error: 'Too many requests. Please wait a moment.' }, 429);

  // Auth gate (shared module)
  const session = await verifySession(sql, req);
  if (!session) return jsonResponse({ error: 'Authentication required' }, 401);

  try {
    const body = await req.json();
    const { message, history = [] } = body;
    const personName = body.personName || body.filhoNome; // Support both v2 (personName) and v1 (filhoNome)
    const ALLOWED_LANGS = ['pt-BR', 'en', 'es'];
    const lang = ALLOWED_LANGS.includes(body.lang) ? body.lang : 'pt-BR';
    const birthDate = body.birthDate || null; // e.g. "2016-03-15"

    if (!message || !personName) {
      return jsonResponse({ error: 'Missing message or personName' }, 400);
    }

    // 0. Load system prompt + person contexts + expand query (in parallel)
    const [systemPromptBase, personContexts, expandedTerms] = await Promise.all([
      getSystemPromptBase(sql),
      getPersonContexts(sql),
      expandQuery(message, personName, sql),
    ]);

    // 1. Search for relevant memories from Neon DB (with expanded terms)
    const memories = await searchMemories(sql, message, personName, lang, expandedTerms);

    // 2. Fetch active corrections (scoped: sons share all, others get individual)
    const corrections = await getCorrections(sql, personName, personContexts);

    // 3. Fetch tone configuration
    const toneConfig = await getToneConfig(sql);

    // 4. Fetch directives (per-person + global)
    const directives = await getDirectives(sql, personName);

    // 5. Build system prompt with retrieved memories + corrections + tone + directives
    const systemPrompt = buildSystemPrompt(systemPromptBase, memories, corrections, personName, toneConfig, directives, lang, birthDate, personContexts);

    // 6. Call Anthropic API
    const response = await callAnthropic(systemPrompt, history, message);

    return jsonResponse({
      response: response,
      memoriesUsed: memories.length,
      categories: [...new Set(memories.map(m => m.category))],
    });
  } catch (error) {
    console.error('[ALMA Chat Error]', error.message);
    return jsonResponse({ error: 'Internal error. Please try again.' }, 500);
  }
}

// --- LLM Query Expansion (Haiku — cached in DB for 24h, ~$0.001/query) ---
async function expandQuery(message, personName, sql) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  // Check cache first (24h TTL)
  const cacheKey = 'qcache_' + simpleHash(message.toLowerCase().trim());
  try {
    const cached = await sql`SELECT value, updated_at FROM alma_config WHERE key = ${cacheKey} LIMIT 1`;
    if (cached.length > 0) {
      const age = Date.now() - new Date(cached[0].updated_at).getTime();
      if (age < 24 * 60 * 60 * 1000) { // 24h
        return JSON.parse(cached[0].value);
      }
    }
  } catch { /* cache miss, proceed to API */ }

  try {
    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL_HAIKU,
        max_tokens: 100,
        system: `Gere 3-5 palavras-chave em português para buscar memórias relevantes no arquivo de legado emocional de um pai.
A pessoa perguntando se chama ${personName}.
Retorne APENAS um array JSON de strings. Sem explicação.`,
        messages: [{ role: 'user', content: message }],
      }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const text = data.content[0].text.trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    const terms = Array.isArray(parsed) ? parsed.map(s => String(s).toLowerCase()).slice(0, 5) : [];

    // Cache result (fire-and-forget)
    if (terms.length > 0) {
      sql`
        INSERT INTO alma_config (key, value, updated_at) VALUES (${cacheKey}, ${JSON.stringify(terms)}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `.catch(() => {});
    }

    return terms;
  } catch {
    return []; // Fail silently — original query still works
  }
}

// Simple hash for cache keys (not cryptographic, just deterministic)
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// --- Token estimation for dynamic context budget ---
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4); // ~4 chars per token for Portuguese
}

async function searchMemories(sql, query, personName, lang = 'pt-BR', expandedTerms = []) {

  // Parse and clean search query: lowercase, remove special chars, split into terms
  let searchTerms = query
    .toLowerCase()
    .replace(/[^\w\sáéíóúâêîôûãõçà]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 8);

  // Merge LLM-expanded terms (deduplicated)
  if (expandedTerms.length > 0) {
    const existing = new Set(searchTerms);
    for (const term of expandedTerms) {
      const clean = term.replace(/[^\w\sáéíóúâêîôûãõçà]/g, '').trim();
      if (clean.length > 2 && !existing.has(clean)) {
        searchTerms.push(clean);
        existing.add(clean);
      }
    }
    searchTerms = searchTerms.slice(0, 12); // allow more terms with expansion
  }

  if (searchTerms.length === 0) {
    const results = await sql`
      SELECT content, title, category, tags, source_file, file_date
      FROM alma_chunks
      WHERE category IN ('legado_alma', 'valores', 'paternidade')
      ORDER BY chunk_index ASC
      LIMIT ${MAX_CONTEXT_CHUNKS}
    `;
    return results;
  }

  // Format search query for PostgreSQL full-text search (using | as OR operator)
  const tsQuery = searchTerms.join(' | ');

  // Expanded semantic tag mapping (45+ entries)
  const tagMap = {
    // Parenting & Family
    'pai': 'paternidade', 'filho': 'paternidade', 'crian': 'paternidade',
    'alma': 'paternidade', 'famíli': 'paternidade', 'familia': 'paternidade',
    'escola': 'paternidade',
    // Children by name
    'noah': 'noah', 'nathan': 'nathan', 'isaac': 'isaac',
    // Family members
    'nivalda': 'familia', 'leslen': 'familia', 'davi': 'familia',
    'irmão': 'familia', 'irmao': 'familia', 'chris': 'chris',
    // Values
    'valor': 'valores', 'honra': 'valores', 'corag': 'valores',
    'verdad': 'valores', 'lealdad': 'valores', 'erro': 'valores',
    'arrepend': 'valores', 'perdão': 'valores', 'perdao': 'valores',
    'perdoar': 'valores', 'homem': 'valores', 'estud': 'valores',
    'futur': 'valores', 'sonho': 'valores', 'objetivo': 'valores',
    'dinheir': 'valores', 'financeir': 'valores',
    'saúde': 'valores', 'saude': 'valores',
    'amizad': 'valores', 'amigo': 'valores',
    'fracass': 'valores', 'sucesso': 'valores',
    // Love & Relationships
    'mulher': 'amor', 'amor': 'amor', 'relacion': 'amor',
    'namorad': 'amor', 'casament': 'amor', 'separ': 'amor', 'traiç': 'amor',
    // Faith
    'deus': 'fe', 'fé': 'fe', 'jesus': 'fe',
    'conversão': 'fe', 'conversao': 'fe', 'igrej': 'fe', 'oraç': 'fe',
    // Trauma & Crisis
    'medo': 'trauma', 'solidão': 'trauma', 'solidao': 'trauma', 'sozin': 'trauma',
    'ansied': 'trauma', 'infânci': 'trauma', 'infancia': 'trauma',
    'suicíd': 'suicidio', 'morr': 'suicidio', 'desist': 'suicidio',
    'depress': 'suicidio',
    // Work & Career
    'polícia': 'policia', 'policia': 'policia', 'delegad': 'policia',
    'trabalh': 'policia', 'prf': 'policia', 'segurança': 'policia',
    // Mental Models
    'patch': 'patch', 'código': 'patch', 'sistema': 'patch',
  };

  const childLower = personName.toLowerCase();

  try {
    const FETCH_POOL = MAX_CONTEXT_CHUNKS * 3;

    // Phase 1: Full-text search ranked by relevance
    let results = await sql`
      SELECT id, content, title, category, tags, source_file, file_date,
             ts_rank(search_vector, to_tsquery('portuguese', ${tsQuery})) as rank
      FROM alma_chunks
      WHERE search_vector @@ to_tsquery('portuguese', ${tsQuery})
      ORDER BY rank DESC
      LIMIT ${FETCH_POOL}
    `;

    // Phase 2: Tag-based fallback if results are sparse
    if (results.length < FETCH_POOL) {
      const matchedTags = [];
      for (const term of searchTerms) {
        for (const [key, tag] of Object.entries(tagMap)) {
          if (term.includes(key)) matchedTags.push(tag);
        }
      }

      if (matchedTags.length > 0) {
        const existingIds = results.map(r => Number(r.id) || 0).concat([0]);
        const tagResults = await sql`
          SELECT id, content, title, category, tags, source_file, file_date, 0 as rank
          FROM alma_chunks
          WHERE tags && ${matchedTags}::TEXT[]
          AND NOT (id = ANY(${existingIds}::int[]))
          ORDER BY chunk_index ASC
          LIMIT ${FETCH_POOL - results.length}
        `;
        results = [...results, ...tagResults];
      }
    }

    // Phase 2.5: Trigram fuzzy search for typo tolerance (if pg_trgm available)
    if (results.length < FETCH_POOL / 2 && searchTerms.length > 0) {
      try {
        const trigramQuery = searchTerms.slice(0, 4).join(' ');
        const existingIdsTrgm = results.map(r => Number(r.id) || 0).concat([0]);
        const trigramResults = await sql`
          SELECT id, content, title, category, tags, source_file, file_date,
                 similarity(content, ${trigramQuery}) as rank
          FROM alma_chunks
          WHERE similarity(content, ${trigramQuery}) > 0.08
          AND NOT (id = ANY(${existingIdsTrgm}::int[]))
          ORDER BY rank DESC
          LIMIT ${Math.min(FETCH_POOL - results.length, 8)}
        `;
        results = [...results, ...trigramResults];
      } catch (e) {
        // pg_trgm not available — skip silently
      }
    }

    // Phase 3: Person-specific guarantee
    const existingIds2 = results.map(r => Number(r.id) || 0).concat([0]);
    const personResults = await sql`
      SELECT id, content, title, category, tags, source_file, file_date, 0 as rank
      FROM alma_chunks
      WHERE ${childLower} = ANY(tags)
      AND NOT (id = ANY(${existingIds2}::int[]))
      LIMIT 4
    `;
    results = [...results, ...personResults];

    // --- RERANKING: 7-tier boost system ---
    const reranked = results.map(r => {
      let score = Number(r.rank) || 0;
      const tags = r.tags || [];

      // Boost 1: Memory tagged with person name (+0.5)
      if (tags.includes(childLower)) {
        score += 0.5;
      }

      // Boost 2: Category matches person (+0.3)
      if (r.category && r.category.toLowerCase() === childLower) {
        score += 0.3;
      }

      // Boost 3: Child + parenting memories (+0.1)
      const CHILDREN = ['noah', 'nathan', 'isaac'];
      if (CHILDREN.includes(childLower) && tags.some(t => ['paternidade', 'filhos'].includes(t))) {
        score += 0.1;
      }

      // Boost 4: Core identity baseline (+0.05)
      if (['legado_alma', 'valores', 'paternidade'].includes(r.category)) {
        score += 0.05;
      }

      // Boost 5: Language match (+0.8 highest / -0.3 penalty)
      const langCode = lang === 'pt-BR' ? 'pt' : lang;
      if (tags.includes(langCode)) {
        score += 0.8;
      }
      if (lang !== 'pt-BR' && !tags.includes(langCode) && (tags.includes('en') || tags.includes('es'))) {
        score -= 0.3;
      }

      // Boost 6: Recency — newer content slightly preferred
      if (r.file_date) {
        const ageMonths = (Date.now() - new Date(r.file_date).getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (ageMonths < 6) score += 0.15;
        else if (ageMonths < 12) score += 0.08;
      }

      // Boost 7: Term overlap — more matching terms = more relevant
      const contentLower = (r.content || '').toLowerCase();
      const termMatches = searchTerms.filter(t => contentLower.includes(t)).length;
      score += termMatches * 0.06;

      return { ...r, finalScore: score };
    });

    // Sort by final score
    reranked.sort((a, b) => b.finalScore - a.finalScore);

    // Source diversity: max 3 chunks from same source_file
    const diversified = [];
    const sourceCount = {};
    for (const r of reranked) {
      const src = r.source_file || '';
      sourceCount[src] = (sourceCount[src] || 0) + 1;
      if (sourceCount[src] <= 3) {
        diversified.push(r);
      }
      if (diversified.length >= 12) break; // hard cap for budget check
    }

    // Dynamic context budget: select chunks until token budget exhausted
    let tokenBudget = MAX_CONTEXT_TOKENS;
    const selected = [];
    for (const r of diversified) {
      const tokens = estimateTokens(r.content);
      if (tokenBudget - tokens < 0 && selected.length >= 3) break; // minimum 3 chunks
      selected.push(r);
      tokenBudget -= tokens;
      if (selected.length >= MAX_CONTEXT_CHUNKS) break;
    }

    return selected;
  } catch (e) {
    // Fallback to simple substring matching if full-text search fails
    console.error('Search error, falling back to LIKE:', e.message);
    const likePattern = `%${searchTerms[0]}%`;
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

async function getCorrections(sql, personName, personContexts = {}) {
  try {
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

async function getSystemPromptBase(sql) {
  // Try to load from DB first (allows customization without code changes)
  try {
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

async function getPersonContexts(sql) {

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

async function getToneConfig(sql) {
  // Fetch global tone override set by Maurício in admin panel
  try {
    const rows = await sql`
      SELECT value FROM alma_config WHERE key = 'tone_global' LIMIT 1
    `;
    return rows.length > 0 ? rows[0].value : '';
  } catch (e) {
    // Return empty string if query fails (tone defaults to base prompt)
    return '';
  }
}

async function getDirectives(sql, personName) {
  // Fetch behavior directives: instructions Maurício sets for ALMA's responses in specific contexts
  try {

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

  // Add corrections: highest priority guardrails for specific question patterns
  if (corrections.length > 0) {
    prompt += `\n\n=============================================\nCORREÇÕES DO MAURÍCIO (PRIORIDADE MÁXIMA)\nO próprio Maurício revisou respostas anteriores e fez estas correções.\nSIGA ESTAS INSTRUÇÕES — elas têm prioridade sobre tudo.\n=============================================\n`;

    for (const corr of corrections) {
      if (corr.original_question) {
        prompt += `\nQuando perguntarem algo como "${corr.original_question}":\n`;
      }
      prompt += `CORREÇÃO: ${corr.correction}\n`;
    }

    prompt += `\n--- Fim das correções. Respeite-as sempre. ---`;
  }

  // Add retrieved memories: actual documented content from Maurício's documents
  if (memories.length > 0) {
    prompt += `\n\n=============================================\nMEMÓRIAS RELEVANTES DO ALMA (use como base)\n=============================================\n`;

    for (const mem of memories) {
      prompt += `\n[${mem.category.toUpperCase()} — ${mem.title}]\n${mem.content}\n`;
    }

    prompt += `\n--- Fim das memórias. Responda como Maurício, baseando-se neste conteúdo real. ---`;
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
      model: MODEL_CHAT,
      max_tokens: MAX_CHAT_TOKENS,
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
