/**
 * ALMA Unit Tests — RAG logic, auth helpers, constants
 * Run: npm run test:unit
 */

import { rerankResults, applyDiversity, applyTokenBudget, estimateTokens, simpleHash, parseSearchTerms, matchTags, tagMap } from '../netlify/functions/lib/rag.mjs';
import { SESSION_EXPIRY_MS, LOGIN_RATE_LIMIT, CHAT_RATE_LIMIT, LEGACY_RATE_LIMIT, MAX_CONTEXT_CHUNKS, MAX_CONTEXT_TOKENS } from '../netlify/functions/lib/constants.mjs';

let passed = 0, failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    failed++;
  }
}

function assertClose(a, b, tolerance, name) {
  assert(Math.abs(a - b) < tolerance, `${name} (got ${a.toFixed(3)}, expected ~${b})`);
}

// =============================================
// RERANKING TESTS
// =============================================
console.log('\n── Reranking: Person Boost ──');
{
  const results = [
    { id: 1, content: 'memória genérica', category: 'valores', tags: [], rank: 0.5, source_file: 'a' },
    { id: 2, content: 'memória da Ana', category: 'ana', tags: ['ana'], rank: 0.3, source_file: 'b' },
  ];
  const ranked = rerankResults(results, 'Ana', 'pt-BR', ['coragem']);

  assert(ranked[0].id === 2, 'Person-tagged memory ranks first');
  assert(ranked[0].finalScore > ranked[1].finalScore, 'Person boost gives higher score');
  assertClose(ranked[0].finalScore, 0.3 + 0.5 + 0.3, 0.01, 'Person gets +0.5 (tag) +0.3 (category)');
}

console.log('\n── Reranking: Language Boost ──');
{
  const results = [
    { id: 1, content: 'english memory', category: 'valores', tags: ['en'], rank: 0.4, source_file: 'a' },
    { id: 2, content: 'memória pt', category: 'valores', tags: ['pt'], rank: 0.4, source_file: 'b' },
    { id: 3, content: 'memória sem tag', category: 'valores', tags: [], rank: 0.4, source_file: 'c' },
  ];
  const rankedEn = rerankResults(results, 'Alex', 'en', []);
  assert(rankedEn[0].id === 1, 'English memory ranks first for English user');
  // EN gets: 0.4 + 0.05 (core) + 0.8 (lang match) = 1.25
  // Untagged: 0.4 + 0.05 (core) = 0.45
  // PT gets: 0.4 + 0.05 (core) - 0.3 (wrong lang) + 0.8 (pt tag matches 'pt') — but lang is 'en' not 'pt-BR'
  // The penalty hits when tag has 'en'/'es' but user is different — PT doesn't get penalized for EN user
  // because penalty only applies when tag includes the OTHER foreign language
  const enScore = rankedEn[0].finalScore;
  assert(enScore > 1.0, 'English tagged memory gets substantial boost for EN user');

  const rankedPt = rerankResults(results, 'Alex', 'pt-BR', []);
  assert(rankedPt[0].id === 2, 'PT memory ranks first for PT-BR user');
}

console.log('\n── Reranking: Child Parenting Boost ──');
{
  const results = [
    { id: 1, content: 'sobre ser pai', category: 'paternidade', tags: ['paternidade'], rank: 0.3, source_file: 'a' },
    { id: 2, content: 'sobre trabalho', category: 'policia', tags: ['policia'], rank: 0.3, source_file: 'b' },
  ];
  const ranked = rerankResults(results, 'PessoaFilha', 'pt-BR', []);
  assert(ranked[0].id === 1, 'Parenting memory boosted for child user');
  assert(ranked[0].finalScore > ranked[1].finalScore, 'Parenting boost + core identity > policia');
}

console.log('\n── Reranking: Core Identity Baseline ──');
{
  const results = [
    { id: 1, content: 'valor', category: 'valores', tags: [], rank: 0.0, source_file: 'a' },
    { id: 2, content: 'random', category: 'misc', tags: [], rank: 0.0, source_file: 'b' },
  ];
  const ranked = rerankResults(results, 'Pessoa', 'pt-BR', []);
  assert(ranked[0].id === 1, 'Core identity category gets baseline boost');
  assertClose(ranked[0].finalScore, 0.05, 0.001, 'Valores gets +0.05');
  assertClose(ranked[1].finalScore, 0.0, 0.001, 'Misc gets no boost');
}

console.log('\n── Reranking: Recency Boost ──');
{
  const now = new Date();
  const recent = new Date(now - 60 * 24 * 60 * 60 * 1000); // 2 months ago
  const old = new Date(now - 400 * 24 * 60 * 60 * 1000); // 13 months ago
  const results = [
    { id: 1, content: 'old', category: 'valores', tags: [], rank: 0.5, source_file: 'a', file_date: old.toISOString() },
    { id: 2, content: 'recent', category: 'valores', tags: [], rank: 0.5, source_file: 'b', file_date: recent.toISOString() },
  ];
  const ranked = rerankResults(results, 'Pessoa', 'pt-BR', []);
  assert(ranked[0].id === 2, 'Recent memory ranks higher than old');
  assert(ranked[0].finalScore > ranked[1].finalScore, 'Recency boost applies');
}

console.log('\n── Reranking: Term Overlap ──');
{
  const results = [
    { id: 1, content: 'coragem e medo são dois lados', category: 'valores', tags: [], rank: 0.3, source_file: 'a' },
    { id: 2, content: 'algo sobre trabalho policial', category: 'policia', tags: [], rank: 0.3, source_file: 'b' },
  ];
  const ranked = rerankResults(results, 'Ana', 'pt-BR', ['coragem', 'medo']);
  assert(ranked[0].id === 1, 'Memory with more term matches ranks first');
  assert(ranked[0].finalScore > ranked[1].finalScore, 'Term overlap gives meaningful score difference');
}

// =============================================
// DIVERSITY TESTS
// =============================================
console.log('\n── Source Diversity ──');
{
  const ranked = [
    { id: 1, source_file: 'doc_a', finalScore: 1.0 },
    { id: 2, source_file: 'doc_a', finalScore: 0.9 },
    { id: 3, source_file: 'doc_a', finalScore: 0.8 },
    { id: 4, source_file: 'doc_a', finalScore: 0.7 }, // should be excluded
    { id: 5, source_file: 'doc_b', finalScore: 0.6 },
    { id: 6, source_file: 'doc_b', finalScore: 0.5 },
  ];
  const diversified = applyDiversity(ranked, 3, 12);
  assert(diversified.length === 5, 'Max 3 per source — 4th from doc_a excluded');
  assert(!diversified.find(r => r.id === 4), 'ID 4 (4th from doc_a) excluded');
  assert(diversified.find(r => r.id === 5), 'doc_b entries included');
}

{
  const ranked = Array.from({ length: 20 }, (_, i) => ({
    id: i, source_file: `doc_${i}`, finalScore: 1 - i * 0.01,
  }));
  const diversified = applyDiversity(ranked, 3, 12);
  assert(diversified.length === 12, 'Hard cap at 12');
}

// =============================================
// TOKEN BUDGET TESTS
// =============================================
console.log('\n── Token Budget ──');
{
  const chunks = [
    { content: 'a'.repeat(400) },  // 100 tokens
    { content: 'b'.repeat(800) },  // 200 tokens
    { content: 'c'.repeat(1200) }, // 300 tokens
    { content: 'd'.repeat(2000) }, // 500 tokens
    { content: 'e'.repeat(4000) }, // 1000 tokens
  ];
  const selected = applyTokenBudget(chunks, 600, 3, 8);
  assert(selected.length === 3, 'Budget 600 tokens → selects 3 (100+200+300=600)');
}

{
  const chunks = [
    { content: 'a'.repeat(4000) },  // 1000 tokens each
    { content: 'b'.repeat(4000) },
    { content: 'c'.repeat(4000) },
    { content: 'd'.repeat(4000) },
  ];
  const selected = applyTokenBudget(chunks, 500, 3, 8);
  assert(selected.length === 3, 'Always selects minimum 3 even if over budget');
}

{
  const chunks = Array.from({ length: 20 }, (_, i) => ({ content: 'x'.repeat(40) })); // 10 tokens each
  const selected = applyTokenBudget(chunks, 50000, 3, 8);
  assert(selected.length === 8, 'Respects max chunks even with big budget');
}

// =============================================
// SEARCH TERM PARSING
// =============================================
console.log('\n── Search Term Parsing ──');
{
  const terms = parseSearchTerms('O que é coragem, pai?');
  assert(terms.includes('coragem'), 'Extracts "coragem"');
  assert(!terms.includes('é'), 'Filters 2-char words');
  assert(!terms.includes('O'), 'Filters 1-char words');
}

{
  const terms = parseSearchTerms('medo', ['coragem', 'valor', 'medo']);
  assert(terms.includes('medo'), 'Original term preserved');
  assert(terms.includes('coragem'), 'Expanded term added');
  assert(terms.includes('valor'), 'Expanded term added');
  assert(terms.length === 3, 'Duplicate "medo" not added twice');
}

{
  const terms = parseSearchTerms('test', Array.from({ length: 20 }, (_, i) => `term${i}`));
  assert(terms.length <= 12, 'Capped at 12 terms');
}

// =============================================
// TAG MATCHING
// =============================================
console.log('\n── Tag Matching ──');
{
  const tags = matchTags(['medo', 'solidao', 'coragem']);
  assert(tags.includes('trauma'), '"medo" → trauma');
  assert(tags.includes('valores'), '"coragem" → valores');
}

{
  const tags = matchTags(['mae', 'pai']);
  assert(tags.includes('familia'), '"mae" → familia');
  assert(tags.includes('paternidade'), '"pai" → paternidade');
}

{
  const tags = matchTags(['xyz123']);
  assert(tags.length === 0, 'Unknown terms return empty');
}

// =============================================
// TOKEN ESTIMATION
// =============================================
console.log('\n── Token Estimation ──');
{
  assert(estimateTokens('') === 0, 'Empty string = 0 tokens');
  assert(estimateTokens(null) === 0, 'Null = 0 tokens');
  assert(estimateTokens('abcd') === 1, '4 chars = 1 token');
  assert(estimateTokens('a'.repeat(100)) === 25, '100 chars = 25 tokens');
  // 'ação' is 5 bytes in UTF-8 but 4 JS chars → ceil(4/4) = 1
  assert(estimateTokens('ação') >= 1, 'Portuguese accented chars handled');
}

// =============================================
// SIMPLE HASH
// =============================================
console.log('\n── Simple Hash ──');
{
  const h1 = simpleHash('hello');
  const h2 = simpleHash('hello');
  const h3 = simpleHash('world');
  assert(h1 === h2, 'Same input = same hash (deterministic)');
  assert(h1 !== h3, 'Different input = different hash');
  assert(typeof h1 === 'string', 'Returns string');
  assert(h1.length > 0, 'Non-empty hash');
}

// =============================================
// CONSTANTS VALIDATION
// =============================================
console.log('\n── Constants ──');
{
  assert(SESSION_EXPIRY_MS === 7 * 24 * 60 * 60 * 1000, 'Session expiry = 7 days');
  assert(LOGIN_RATE_LIMIT.maxAttempts === 5, 'Login: 5 attempts');
  assert(LOGIN_RATE_LIMIT.windowMs === 300_000, 'Login: 5 min window');
  assert(CHAT_RATE_LIMIT.maxRequests === 20, 'Chat: 20 req/min');
  assert(LEGACY_RATE_LIMIT.maxAttempts === 3, 'Legacy: 3 attempts');
  assert(LEGACY_RATE_LIMIT.windowMs === 3_600_000, 'Legacy: 1 hour window');
  assert(MAX_CONTEXT_CHUNKS === 8, 'Max context chunks = 8');
  assert(MAX_CONTEXT_TOKENS === 3000, 'Max context tokens = 3000');
}

// =============================================
// TAG MAP COVERAGE
// =============================================
console.log('\n── Tag Map Coverage ──');
{
  const entries = Object.entries(tagMap);
  assert(entries.length >= 45, `Tag map has ${entries.length} entries (≥ 45)`);

  const categories = new Set(Object.values(tagMap));
  const expected = ['paternidade', 'valores', 'fe', 'amor', 'trauma', 'suicidio', 'policia', 'patch', 'familia'];
  for (const cat of expected) {
    assert(categories.has(cat), `Category "${cat}" present in tagMap`);
  }
}

// =============================================
// EDGE CASES
// =============================================
console.log('\n── Edge Cases ──');
{
  const ranked = rerankResults([], 'Ana', 'pt-BR', ['test']);
  assert(ranked.length === 0, 'Empty results = empty reranking');
}

{
  const results = [
    { id: 1, content: '', category: '', tags: [], rank: 0, source_file: '' },
  ];
  const ranked = rerankResults(results, '', 'pt-BR', []);
  assert(ranked.length === 1, 'Handles empty personName gracefully');
}

{
  const selected = applyTokenBudget([], 3000, 3, 8);
  assert(selected.length === 0, 'Empty chunks = empty selection');
}

{
  const diversified = applyDiversity([], 3, 12);
  assert(diversified.length === 0, 'Empty ranked = empty diversity');
}

// =============================================
// RESULTS
// =============================================
console.log(`\n📊 Unit Tests: ${passed} passed, ${failed} failed (${passed + failed} total)`);
if (failed > 0) process.exit(1);
