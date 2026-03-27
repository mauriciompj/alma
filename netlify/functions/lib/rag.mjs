/**
 * ALMA — RAG Utilities (exported for testing)
 * Pure functions: reranking, token estimation, tag mapping, diversity, budget
 */

import { MAX_CONTEXT_CHUNKS, MAX_CONTEXT_TOKENS } from './constants.mjs';

// Expanded semantic tag mapping (45+ entries)
export const tagMap = {
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

// Token estimation (~4 chars per token for Portuguese)
export function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

// Simple hash for cache keys
export function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// Parse and clean search query
export function parseSearchTerms(query, expandedTerms = []) {
  let searchTerms = query
    .toLowerCase()
    .replace(/[^\w\sáéíóúâêîôûãõçà]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 8);

  if (expandedTerms.length > 0) {
    const existing = new Set(searchTerms);
    for (const term of expandedTerms) {
      const clean = term.replace(/[^\w\sáéíóúâêîôûãõçà]/g, '').trim();
      if (clean.length > 2 && !existing.has(clean)) {
        searchTerms.push(clean);
        existing.add(clean);
      }
    }
    searchTerms = searchTerms.slice(0, 12);
  }

  return searchTerms;
}

// Match search terms to semantic tags
export function matchTags(searchTerms) {
  const matched = [];
  for (const term of searchTerms) {
    for (const [key, tag] of Object.entries(tagMap)) {
      if (term.includes(key)) matched.push(tag);
    }
  }
  return [...new Set(matched)];
}

// 7-tier reranking algorithm
export function rerankResults(results, personName, lang, searchTerms) {
  const childLower = personName.toLowerCase();
  const CHILDREN = ['noah', 'nathan', 'isaac'];

  return results.map(r => {
    let score = Number(r.rank) || 0;
    const tags = r.tags || [];

    // Boost 1: Person tag (+0.5)
    if (tags.includes(childLower)) score += 0.5;

    // Boost 2: Category match (+0.3)
    if (r.category && r.category.toLowerCase() === childLower) score += 0.3;

    // Boost 3: Child + parenting (+0.1)
    if (CHILDREN.includes(childLower) && tags.some(t => ['paternidade', 'filhos'].includes(t))) score += 0.1;

    // Boost 4: Core identity (+0.05)
    if (['legado_alma', 'valores', 'paternidade'].includes(r.category)) score += 0.05;

    // Boost 5: Language (+0.8 / -0.3)
    const langCode = lang === 'pt-BR' ? 'pt' : lang;
    if (tags.includes(langCode)) score += 0.8;
    if (lang !== 'pt-BR' && !tags.includes(langCode) && (tags.includes('en') || tags.includes('es'))) score -= 0.3;

    // Boost 6: Recency
    if (r.file_date) {
      const ageMonths = (Date.now() - new Date(r.file_date).getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (ageMonths < 6) score += 0.15;
      else if (ageMonths < 12) score += 0.08;
    }

    // Boost 7: Term overlap (+0.06 per match)
    const contentLower = (r.content || '').toLowerCase();
    const termMatches = searchTerms.filter(t => contentLower.includes(t)).length;
    score += termMatches * 0.06;

    return { ...r, finalScore: score };
  }).sort((a, b) => b.finalScore - a.finalScore);
}

// Source diversity: max N chunks per source
export function applyDiversity(ranked, maxPerSource = 3, hardCap = 12) {
  const diversified = [];
  const sourceCount = {};
  for (const r of ranked) {
    const src = r.source_file || '';
    sourceCount[src] = (sourceCount[src] || 0) + 1;
    if (sourceCount[src] <= maxPerSource) {
      diversified.push(r);
    }
    if (diversified.length >= hardCap) break;
  }
  return diversified;
}

// Dynamic token budget selection
export function applyTokenBudget(chunks, budget = MAX_CONTEXT_TOKENS, minChunks = 3, maxChunks = MAX_CONTEXT_CHUNKS) {
  let remaining = budget;
  const selected = [];
  for (const r of chunks) {
    const tokens = estimateTokens(r.content);
    if (remaining - tokens < 0 && selected.length >= minChunks) break;
    selected.push(r);
    remaining -= tokens;
    if (selected.length >= maxChunks) break;
  }
  return selected;
}
