/**
 * ALMA Deep Test — Tests all features end-to-end
 * Covers: login, legacy, ingest, voice, search, chat, pages, headers
 *
 * Usage: node tests/deep-test.mjs
 * Env: TEST_URL (default: https://projeto-alma.netlify.app)
 *       TEST_USER, TEST_PASS
 *       Optional legacy checks:
 *       LEGACY_PASSPHRASE_ADMIN
 *       LEGACY_PASSPHRASE_CHILD_A
 *       LEGACY_PASSPHRASE_CHILD_B
 *       LEGACY_PASSPHRASE_CHILD_C
 *       LEGACY_PASSPHRASE_READER_A
 *       LEGACY_PASSPHRASE_READER_B
 *       LEGACY_PASSPHRASE_READER_C
 *       TEST_CHAT_PERSON
 *       TEST_CHAT_DEV_PERSON
 */

import { optionalEnv } from './test-utils.mjs';

const BASE = optionalEnv('TEST_URL', 'https://projeto-alma.netlify.app');
const USER = optionalEnv('TEST_USER');
const PASS = optionalEnv('TEST_PASS');
const CHAT_PERSON = optionalEnv('TEST_CHAT_PERSON', 'PessoaFilha');
const CHAT_DEV_PERSON = optionalEnv('TEST_CHAT_DEV_PERSON', 'PessoaLeitora');
const LEGACY_CASES = [
  { envs: ['LEGACY_PASSPHRASE_ADMIN', 'LEGACY_PASSPHRASE_DAVI'], label: 'Primary heir legacy_admin', accessLevel: 'legacy_admin', expectPersonalMessage: true, expectTechnicalNotes: true },
  { envs: ['LEGACY_PASSPHRASE_CHILD_A', 'LEGACY_PASSPHRASE_NOAH'], label: 'Child A legacy_owner', accessLevel: 'legacy_owner' },
  { envs: ['LEGACY_PASSPHRASE_CHILD_B', 'LEGACY_PASSPHRASE_ISAAC'], label: 'Child B legacy_owner', accessLevel: 'legacy_owner' },
  { envs: ['LEGACY_PASSPHRASE_CHILD_C', 'LEGACY_PASSPHRASE_NATHAN'], label: 'Child C legacy_owner', accessLevel: 'legacy_owner' },
  { envs: ['LEGACY_PASSPHRASE_READER_A', 'LEGACY_PASSPHRASE_NIVALDA'], label: 'Reader A legacy_read', accessLevel: 'legacy_read' },
  { envs: ['LEGACY_PASSPHRASE_READER_B', 'LEGACY_PASSPHRASE_LESLEN'], label: 'Reader B legacy_read', accessLevel: 'legacy_read' },
  { envs: ['LEGACY_PASSPHRASE_READER_C', 'LEGACY_PASSPHRASE_CHRIS'], label: 'Reader C legacy_read', accessLevel: 'legacy_read' },
];

const results = [];
function log(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? '  \u2713' : '  \u2717') + ' ' + name + (detail ? ' \u2014 ' + detail : ''));
}

async function run() {
  if (!USER || !PASS) {
    console.error('Missing TEST_USER/TEST_PASS. Set explicit credentials in env before running deep-test.');
    process.exit(1);
  }

  // --- LOGIN ---
  console.log('\n\u2500\u2500 Login & Session \u2500\u2500');
  const login = await fetch(BASE + '/api/auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', username: USER, password: PASS })
  });
  const ld = await login.json();
  const token = ld.token;
  const auth = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
  log('Admin login', !!token, token ? 'token ok' : 'FAILED');

  if (!token) {
    console.log('\nCannot continue without token. Is rate limit active?');
    process.exit(1);
  }

  // --- LEGACY ---
  console.log('\n\u2500\u2500 Legacy Mode \u2500\u2500');

  const leg1 = await fetch(BASE + '/api/legacy', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: 'frase que nao existe' })
  });
  const ld1 = await leg1.json();
  log('Wrong passphrase rejected', !ld1.unlocked);

  for (const legacyCase of LEGACY_CASES) {
    const passphraseEnv = legacyCase.envs.find(function(envName) { return process.env[envName]; });
    const passphrase = passphraseEnv ? process.env[passphraseEnv] : '';
    if (!passphrase) {
      log(legacyCase.label, true, 'skipped (missing env ' + legacyCase.envs.join(' or ') + ')');
      continue;
    }

    const legacyRes = await fetch(BASE + '/api/legacy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase })
    });
    const legacyData = await legacyRes.json();
    log(
      legacyCase.label,
      legacyData.unlocked && legacyData.accessLevel === legacyCase.accessLevel,
      legacyData.person
    );

    if (legacyCase.expectPersonalMessage) {
      log('Primary heir personal message', (legacyData.personalMessage || '').length > 50, (legacyData.personalMessage || '').length + ' chars');
    }
    if (legacyCase.expectTechnicalNotes) {
      log('Primary heir tech notes', (legacyData.technicalNotes || '').length > 50, (legacyData.technicalNotes || '').length + ' chars');
    }
  }

  // --- INGEST ---
  console.log('\n\u2500\u2500 Ingest API \u2500\u2500');

  const ing1 = await fetch(BASE + '/api/ingest', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ content: 'Teste deep temporario', title: 'Deep Test', category: 'tecnologia_ia', tags: ['teste_deep'], source: 'deep_test' })
  });
  const id1 = await ing1.json();
  log('Ingest text', id1.success, id1.chunks_created + ' chunk(s)');

  const ing2 = await fetch(BASE + '/api/ingest', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'sem auth' })
  });
  log('Ingest no auth rejected', ing2.status === 401, 'status ' + ing2.status);

  // --- VOICE ---
  console.log('\n\u2500\u2500 Voice (ElevenLabs) \u2500\u2500');

  const voc = await fetch(BASE + '/api/voice', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ text: 'Teste de voz do ALMA.' })
  });
  const vd = await voc.json();
  log('Voice generates audio', !!vd.audio, vd.audio ? Math.round(vd.audio.length / 1024) + 'KB' : 'no audio');
  log('Voice MIME correct', vd.mimeType === 'audio/mpeg', vd.mimeType);

  // --- SEARCH ---
  console.log('\n\u2500\u2500 Memory Search \u2500\u2500');

  const s1 = await fetch(BASE + '/api/memories?action=search&q=coragem+medo', { headers: auth });
  const sd1 = await s1.json();
  log('Search coragem+medo', (sd1.results || []).length > 0, (sd1.results || []).length + ' results');

  const s2 = await fetch(BASE + '/api/memories?action=search&q=deploy+netlify', { headers: auth });
  const sd2 = await s2.json();
  log('Search deploy (dev docs)', (sd2.results || []).length > 0, (sd2.results || []).length + ' results');

  const s3 = await fetch(BASE + '/api/memories?action=stats');
  const sd3 = await s3.json();
  log('Stats endpoint', sd3.chunks > 1000, sd3.chunks + ' chunks, ' + (sd3.categories || []).length + ' cats');

  const s4 = await fetch(BASE + '/api/memories?action=categories');
  const sd4 = await s4.json();
  log('Categories endpoint', (sd4.categories || []).length > 10, (sd4.categories || []).length + ' categories');

  const s5 = await fetch(BASE + '/api/memories?action=get_persons', { headers: auth });
  const sd5 = await s5.json();
  log('Persons endpoint', (sd5.persons || []).length > 0, sd5.author + ' + ' + (sd5.persons || []).length + ' persons');

  // --- DIRECTIVES ---
  console.log('\n\u2500\u2500 Directives \u2500\u2500');

  const dir1 = await fetch(BASE + '/api/memories?action=list_directives&person=_all', { headers: auth });
  const dd1 = await dir1.json();
  log('List all directives', (dd1.directives || []).length > 0, (dd1.directives || []).length + ' directives');

  // --- CHAT PER PERSON ---
  console.log('\n\u2500\u2500 Chat per Person \u2500\u2500');

  const ch1 = await fetch(BASE + '/api/chat', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ message: 'Pai, o que e coragem?', personName: CHAT_PERSON, lang: 'pt-BR' })
  });
  const cd1 = await ch1.json();
  log('Chat child (PT-BR)', !!cd1.response, cd1.memoriesUsed + ' memories');

  const ch2 = await fetch(BASE + '/api/chat', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ message: 'Como faz deploy?', personName: CHAT_DEV_PERSON, lang: 'pt-BR' })
  });
  const cd2 = await ch2.json();
  log('Chat non-child (dev)', !!cd2.response, cd2.memoriesUsed + ' memories');

  const ch3 = await fetch(BASE + '/api/chat', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ message: 'What is courage?', personName: CHAT_PERSON, lang: 'en' })
  });
  const cd3 = await ch3.json();
  log('Chat English', !!cd3.response, cd3.memoriesUsed + ' memories');

  // --- PAGES ---
  console.log('\n\u2500\u2500 Frontend Pages \u2500\u2500');

  const pages = ['/', '/login.html', '/chat.html', '/index.html', '/admin.html', '/revisor.html', '/setup.html', '/sobre.html', '/legacy.html'];
  for (const p of pages) {
    const r = await fetch(BASE + p);
    log('GET ' + p, r.status === 200, 'status ' + r.status);
  }

  // --- SECURITY HEADERS ---
  console.log('\n\u2500\u2500 Security Headers \u2500\u2500');
  const hr = await fetch(BASE + '/');
  log('CSP', !!hr.headers.get('content-security-policy'), (hr.headers.get('content-security-policy') || '').slice(0, 40) + '...');
  log('HSTS', !!hr.headers.get('strict-transport-security'), hr.headers.get('strict-transport-security'));
  log('X-Frame-Options', hr.headers.get('x-frame-options') === 'DENY', hr.headers.get('x-frame-options'));
  log('X-Content-Type-Options', hr.headers.get('x-content-type-options') === 'nosniff', hr.headers.get('x-content-type-options'));
  log('Referrer-Policy', !!hr.headers.get('referrer-policy'), hr.headers.get('referrer-policy'));

  // --- SUMMARY ---
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log('\n\ud83d\udcca Deep Test: ' + passed + ' passed, ' + failed + ' failed (' + results.length + ' total)');

  if (failed > 0) {
    console.log('\nFailed:');
    for (const r of results.filter(r => !r.ok)) console.log('  \u2717 ' + r.name + (r.detail ? ' \u2014 ' + r.detail : ''));
    process.exit(1);
  }
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
