/**
 * ALMA Deep Test — Tests all features end-to-end
 * Covers: login, legacy, ingest, voice, search, chat, pages, headers
 *
 * Usage: node tests/deep-test.mjs
 * Env: TEST_URL (default: https://projeto-alma.netlify.app)
 *       TEST_USER, TEST_PASS
 */

const BASE = process.env.TEST_URL || 'https://projeto-alma.netlify.app';
const USER = process.env.TEST_USER || 'Mauricio';
const PASS = process.env.TEST_PASS || 'Alma@2026';

const results = [];
function log(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? '  \u2713' : '  \u2717') + ' ' + name + (detail ? ' \u2014 ' + detail : ''));
}

async function run() {
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

  const leg2 = await fetch(BASE + '/api/legacy', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: 'eu seguro irm\u00e3o' })
  });
  const ld2 = await leg2.json();
  log('Davi legacy_admin', ld2.unlocked && ld2.accessLevel === 'legacy_admin', ld2.person);
  log('Davi personal message', (ld2.personalMessage || '').length > 50, (ld2.personalMessage || '').length + ' chars');
  log('Davi tech notes', (ld2.technicalNotes || '').length > 50, (ld2.technicalNotes || '').length + ' chars');

  const leg3 = await fetch(BASE + '/api/legacy', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: 'o primog\u00eanito que mudou tudo' })
  });
  const ld3 = await leg3.json();
  log('Noah legacy_owner', ld3.unlocked && ld3.accessLevel === 'legacy_owner', ld3.person);

  const leg4 = await fetch(BASE + '/api/legacy', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: 'zaquinho do pai' })
  });
  const ld4 = await leg4.json();
  log('Isaac legacy_owner', ld4.unlocked && ld4.accessLevel === 'legacy_owner', ld4.person);

  const leg5 = await fetch(BASE + '/api/legacy', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: 'o sil\u00eancio que processa' })
  });
  const ld5 = await leg5.json();
  log('Nathan legacy_owner', ld5.unlocked && ld5.accessLevel === 'legacy_owner', ld5.person);

  const leg6 = await fetch(BASE + '/api/legacy', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: 'oi nega' })
  });
  const ld6 = await leg6.json();
  log('Nivalda legacy_read', ld6.unlocked && ld6.accessLevel === 'legacy_read', ld6.person);

  const leg7 = await fetch(BASE + '/api/legacy', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: 'o foco \u00e9 a leslen e eu' })
  });
  const ld7 = await leg7.json();
  log('Leslen legacy_read', ld7.unlocked && ld7.accessLevel === 'legacy_read', ld7.person);

  const leg8 = await fetch(BASE + '/api/legacy', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: 'dois pais separados podem ser melhores' })
  });
  const ld8 = await leg8.json();
  log('Chris legacy_read', ld8.unlocked && ld8.accessLevel === 'legacy_read', ld8.person);

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

  const s5 = await fetch(BASE + '/api/memories?action=get_persons');
  const sd5 = await s5.json();
  log('Persons endpoint', (sd5.persons || []).length > 0, sd5.author + ' + ' + (sd5.persons || []).length + ' persons');

  // --- DIRECTIVES ---
  console.log('\n\u2500\u2500 Directives \u2500\u2500');

  const dir1 = await fetch(BASE + '/api/memories?action=list_directives&person=_all');
  const dd1 = await dir1.json();
  log('List all directives', (dd1.directives || []).length > 0, (dd1.directives || []).length + ' directives');

  // --- CHAT PER PERSON ---
  console.log('\n\u2500\u2500 Chat per Person \u2500\u2500');

  const ch1 = await fetch(BASE + '/api/chat', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ message: 'Pai, o que e coragem?', personName: 'Noah', lang: 'pt-BR' })
  });
  const cd1 = await ch1.json();
  log('Chat Noah (PT-BR)', !!cd1.response, cd1.memoriesUsed + ' memories');

  const ch2 = await fetch(BASE + '/api/chat', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ message: 'Como faz deploy?', personName: 'Davi', lang: 'pt-BR' })
  });
  const cd2 = await ch2.json();
  log('Chat Davi (dev)', !!cd2.response, cd2.memoriesUsed + ' memories');

  const ch3 = await fetch(BASE + '/api/chat', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ message: 'What is courage?', personName: 'Noah', lang: 'en' })
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
