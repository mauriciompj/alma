/**
 * ALMA Chat Function — RAG-powered conversation
 * Searches Neon DB for relevant memories + corrections, builds context, calls Anthropic API
 */

import { neon } from '@neondatabase/serverless';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1000;
const MAX_CONTEXT_CHUNKS = 8;

// --- System Prompt (core identity, no memories — those come from DB) ---
// This is the base personality prompt that defines how ALMA responds. It's in Portuguese because it's content that gets injected into the AI's personality.
const SYSTEM_PROMPT_BASE = `Você é o ALMA — a voz digital do Maurício, pai de Noah, Nathan e Isaac.

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
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { message, history = [] } = body;
    const personName = body.personName || body.filhoNome; // Support both v2 (personName) and v1 (filhoNome)

    if (!message || !personName) {
      return new Response(JSON.stringify({ error: 'Missing message or personName' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Search for relevant memories from Neon DB
    const memories = await searchMemories(message, personName);

    // 2. Fetch active corrections (scoped: sons share all, others get individual)
    const corrections = await getCorrections(personName);

    // 3. Fetch tone configuration
    const toneConfig = await getToneConfig();

    // 4. Fetch directives (per-person + global)
    const directives = await getDirectives(personName);

    // 5. Build system prompt with retrieved memories + corrections + tone + directives
    const systemPrompt = buildSystemPrompt(memories, corrections, personName, toneConfig, directives);

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
    console.error('ALMA Chat Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal error',
      details: error.message,
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      },
    });
  }
}

async function searchMemories(query, personName) {
  // personName parameter: person's name / child's name — used to personalize memory search
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
      SELECT content, title, category, tags, source_file
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
    let results = await sql`
      SELECT id, content, title, category, tags, source_file,
             ts_rank(search_vector, to_tsquery('portuguese', ${tsQuery})) as rank
      FROM alma_chunks
      WHERE search_vector @@ to_tsquery('portuguese', ${tsQuery})
      ORDER BY rank DESC
      LIMIT ${FETCH_POOL}
    `;

    // Supplement with tag-based fallback if results are sparse
    if (results.length < FETCH_POOL) {
      const matchedTags = [];
      for (const term of searchTerms) {
        for (const [key, tag] of Object.entries(tagMap)) {
          if (term.includes(key)) matchedTags.push(tag);
        }
      }

      if (matchedTags.length > 0) {
        const existingIds = results.map(r => r.id || 0).concat([0]);
        const tagResults = await sql`
          SELECT id, content, title, category, tags, source_file, 0 as rank
          FROM alma_chunks
          WHERE tags && ${matchedTags}::TEXT[]
          AND id NOT IN (${existingIds})
          ORDER BY chunk_index ASC
          LIMIT ${FETCH_POOL - results.length}
        `;
        results = [...results, ...tagResults];
      }
    }

    // Always fetch person-specific memories to guarantee they're in the pool
    const existingIds = results.map(r => r.id || 0).concat([0]);
    const personResults = await sql`
      SELECT id, content, title, category, tags, source_file, 0 as rank
      FROM alma_chunks
      WHERE ${childLower} = ANY(tags)
      AND id NOT IN (${existingIds})
      LIMIT 4
    `;
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

      return { ...r, finalScore: score };
    });

    // Sort by final score (highest first), then slice to limit
    reranked.sort((a, b) => b.finalScore - a.finalScore);

    return reranked.slice(0, MAX_CONTEXT_CHUNKS);
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

async function getCorrections(personName) {
  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);
    // List of Maurício's sons
    const CHILDREN = ['Noah', 'Nathan', 'Isaac'];
    // Check if querying person is one of the sons (they share all corrections)
    const isChild = CHILDREN.includes(personName);

    let corrections;
    if (isChild) {
      // Sons share ALL corrections made on any son + global (empty filho_nome field)
      corrections = await sql`
        SELECT original_question, correction, filho_nome
        FROM alma_corrections
        WHERE active = true
          AND (filho_nome IN ('Noah', 'Nathan', 'Isaac') OR filho_nome = '' OR filho_nome IS NULL)
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

function buildSystemPrompt(memories, corrections, personName, toneConfig = '', directives = {}) {
  // Build the complete system prompt by layering: base prompt → person context → config → directives → corrections → memories
  let prompt = SYSTEM_PROMPT_BASE;

  // Add person-specific context to tailor response behavior per relationship
  // These strings are in Portuguese because they're injected into the AI prompt
  const CHILDREN = ['Noah', 'Nathan', 'Isaac'];
  const PERSON_CONTEXT = {
    'Noah': 'seu filho primogênito (nascido em 2016)',
    'Nathan': 'seu filho gêmeo (nascido em 2020)',
    'Isaac': 'seu filho gêmeo (nascido em 2020)',
    'Chris': 'a mãe dos seus filhos. Fale com respeito e carinho — ela é uma grande mulher',
    'Leslen': 'sua companheira, a mulher que te mostrou que você ainda pode amar. Fale com amor e verdade',
    'Nivalda': 'sua mãe, a Mãezinha. Fale com amor, gratidão e respeito profundo — ela é a base de tudo que você é',
    'Davi': 'seu irmão mais novo. Fale como irmão mais velho — com amor, parceria e cumplicidade. Vocês se protegem desde sempre',
  };
  const personCtx = PERSON_CONTEXT[personName] || '';
  // Check if talking to a son (uses father voice) vs. other person (uses Maurício's own voice)
  const isChild = CHILDREN.includes(personName);

  if (isChild) {
    // Sons: speak as father
    prompt += `\n\nVocê está conversando com: ${personName} — ${personCtx}. Fale como PAI.`;
  } else {
    // Others: speak as Maurício himself, not as father
    prompt += `\n\nVocê está conversando com: ${personName} — ${personCtx}. Fale como MAURÍCIO (não como "pai"). Use o nome da pessoa naturalmente.`;
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
