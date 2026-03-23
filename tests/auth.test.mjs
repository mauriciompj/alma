/**
 * ALMA Integration Tests — Auth, Health, Chat, Memories
 * Run: node tests/auth.test.mjs
 *
 * Environment variables:
 *   TEST_URL  — target URL (default: https://alma-demo.netlify.app)
 *   TEST_USER — login username (default: Lucas)
 *   TEST_PASS — login password (default: demo123)
 *
 * Examples:
 *   node tests/auth.test.mjs                                          # demo
 *   set TEST_URL=https://projeto-alma.netlify.app&& set TEST_USER=Noah&& set TEST_PASS=67jASyxC&& node tests/auth.test.mjs  # prod (Windows)
 *
 * Tests are grouped by concern:
 *   1. Login & token management
 *   2. Token verification
 *   3. Health check
 *   4. Chat (authenticated)
 *   5. Memories / public endpoints
 *   6. Edge cases & security
 */

import { strict as assert } from 'assert';

const BASE_URL = (process.env.TEST_URL || 'https://alma-demo.netlify.app').trim();
const TEST_USER = (process.env.TEST_USER || 'Lucas').trim();
const TEST_PASS = (process.env.TEST_PASS || 'demo123').trim();

let passCount = 0;
let failCount = 0;
let skipCount = 0;

// Shared state across tests
let authToken = null;
let sitePasswordBlocking = false;

function test(name, fn) {
  return fn().then(() => {
    console.log(`  \u2713 ${name}`);
    passCount++;
  }).catch(e => {
    console.error(`  \u2717 ${name}: ${e.message}`);
    failCount++;
  });
}

function skip(name, reason) {
  console.log(`  \u2298 ${name} (skipped: ${reason})`);
  skipCount++;
  return Promise.resolve();
}

// Helper: check if a response is HTML (Netlify password page) instead of JSON
function isHtmlResponse(res) {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('text/html');
}

// Helper: safe JSON parse (returns null if HTML/non-JSON)
async function safeJson(res) {
  if (isHtmlResponse(res)) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Helper: authenticated fetch
function authFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return fetch(url, { ...options, headers });
}

async function runTests() {
  console.log(`\n\ud83e\uddea ALMA Integration Tests \u2014 ${BASE_URL}\n`);

  // ===============================================
  // PRE-FLIGHT: detect Netlify site password
  // ===============================================
  console.log('\u2500\u2500 Pre-flight \u2500\u2500');
  {
    const probe = await fetch(`${BASE_URL}/.netlify/functions/memories?action=health`);
    if (isHtmlResponse(probe)) {
      sitePasswordBlocking = true;
      console.log('  \u26a0  Netlify site password detected \u2014 GET endpoints return HTML');
      console.log('     GET-based tests will be skipped. POST-based tests will proceed.\n');
      console.log('  \ud83d\udca1 To fix: Netlify > Site settings > Access & Security > Visitor Access');
      console.log('     Exclude function paths from password protection.\n');
    } else {
      console.log('  \u2713 Functions reachable (no site password blocking)\n');
    }
  }

  // ===============================================
  // 1. LOGIN & TOKEN MANAGEMENT
  // ===============================================
  console.log('\u2500\u2500 Login & Token \u2500\u2500');

  await test('Login with valid credentials returns token', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username: TEST_USER, password: TEST_PASS }),
    });
    const data = await safeJson(res);
    assert.ok(data, `Expected JSON response, got HTML (status ${res.status}). Site password may be blocking functions.`);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(data)}`);
    assert.equal(data.success, true);
    assert.ok(data.token, 'Token should exist');
    assert.ok(data.token.length >= 32, 'Token should be at least 32 chars');
    assert.ok(data.name, 'Name should exist');
    assert.ok(data.type, 'Type should exist');

    // Save token for authenticated tests
    authToken = data.token;
  });

  await test('Login with wrong password returns 401', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username: TEST_USER, password: 'wrongpassword' }),
    });
    const data = await safeJson(res);
    assert.ok(data, 'Expected JSON response, got HTML');
    assert.equal(res.status, 401);
  });

  await test('Login with nonexistent user returns 401', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username: 'NobodyExists', password: 'test' }),
    });
    const data = await safeJson(res);
    assert.ok(data, 'Expected JSON response, got HTML');
    assert.equal(res.status, 401);
  });

  await test('Login without username returns 400', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', password: TEST_PASS }),
    });
    const data = await safeJson(res);
    assert.ok(data, 'Expected JSON response, got HTML');
    assert.equal(res.status, 400);
  });

  await test('Login without password returns 400', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username: TEST_USER }),
    });
    const data = await safeJson(res);
    assert.ok(data, 'Expected JSON response, got HTML');
    assert.equal(res.status, 400);
  });

  // ===============================================
  // 2. TOKEN VERIFICATION
  // ===============================================
  console.log('\n\u2500\u2500 Token Verification \u2500\u2500');

  if (authToken) {
    await test('Verify valid token returns user info', async () => {
      const res = await fetch(`${BASE_URL}/.netlify/functions/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', token: authToken }),
      });
      const data = await safeJson(res);
      assert.ok(data, 'Expected JSON response, got HTML');
      assert.equal(res.status, 200);
      assert.equal(data.valid, true);
      assert.ok(data.name, 'Should return user name');
      assert.ok(data.type, 'Should return user type');
    });
  } else {
    await skip('Verify valid token returns user info', 'no token from login');
  }

  await test('Verify invalid token returns valid=false', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', token: 'totally-fake-token-12345' }),
    });
    const data = await safeJson(res);
    assert.ok(data, 'Expected JSON response, got HTML');
    assert.equal(data.valid, false);
  });

  await test('Verify without token returns 400', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify' }),
    });
    const data = await safeJson(res);
    assert.ok(data, 'Expected JSON response, got HTML');
    assert.equal(res.status, 400);
  });

  await test('Unknown auth action returns 400', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'something_invalid' }),
    });
    const data = await safeJson(res);
    assert.ok(data, 'Expected JSON response, got HTML');
    assert.equal(res.status, 400);
  });

  // ===============================================
  // 3. HEALTH CHECK
  // ===============================================
  console.log('\n\u2500\u2500 Health Check \u2500\u2500');

  if (sitePasswordBlocking) {
    await skip('Health check returns status ok and timestamp', 'site password blocks GET');
  } else {
    await test('Health check returns status ok and timestamp', async () => {
      const res = await fetch(`${BASE_URL}/.netlify/functions/memories?action=health`);
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.status, 'ok');
      assert.ok(data.timestamp, 'Should include timestamp');
      assert.ok(!isNaN(Date.parse(data.timestamp)), 'Timestamp should be valid ISO date');
    });
  }

  // ===============================================
  // 4. CHAT (AUTHENTICATED)
  // ===============================================
  console.log('\n\u2500\u2500 Chat \u2500\u2500');

  await test('Chat without auth token returns 401', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello',
        personName: TEST_USER,
        lang: 'en',
        history: [],
      }),
    });
    // Accept both JSON 401 (function auth) and HTML 401 (Netlify site password)
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
  });

  if (authToken) {
    await test('Chat with valid auth returns AI response', async () => {
      const res = await authFetch(`${BASE_URL}/.netlify/functions/chat`, {
        method: 'POST',
        body: JSON.stringify({
          message: 'What is courage?',
          personName: TEST_USER,
          lang: 'en',
          history: [],
        }),
      });
      const data = await safeJson(res);
      assert.ok(data, 'Expected JSON response, got HTML. Site password may be blocking authenticated requests.');
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
      assert.ok(data.response, 'Should have a response');
      assert.ok(data.response.length > 20, 'Response should be substantial');
      assert.ok(data.memoriesUsed >= 0, 'Should report memories used');
      assert.ok(Array.isArray(data.categories), 'Should report categories array');
    });

    await test('Chat without message returns 400', async () => {
      const res = await authFetch(`${BASE_URL}/.netlify/functions/chat`, {
        method: 'POST',
        body: JSON.stringify({
          personName: TEST_USER,
          lang: 'en',
          history: [],
        }),
      });
      const data = await safeJson(res);
      assert.ok(data, 'Expected JSON response, got HTML');
      assert.equal(res.status, 400);
    });

    await test('Chat without personName returns 400', async () => {
      const res = await authFetch(`${BASE_URL}/.netlify/functions/chat`, {
        method: 'POST',
        body: JSON.stringify({
          message: 'test',
          lang: 'en',
          history: [],
        }),
      });
      const data = await safeJson(res);
      assert.ok(data, 'Expected JSON response, got HTML');
      assert.equal(res.status, 400);
    });
  } else {
    await skip('Chat with valid auth', 'no auth token available');
    await skip('Chat without message', 'no auth token available');
    await skip('Chat without personName', 'no auth token available');
  }

  // ===============================================
  // 5. MEMORIES / PUBLIC ENDPOINTS
  // ===============================================
  console.log('\n\u2500\u2500 Memories & Public Endpoints \u2500\u2500');

  if (sitePasswordBlocking) {
    await skip('Stats endpoint', 'site password blocks GET');
    await skip('Categories endpoint', 'site password blocks GET');
    await skip('Get persons endpoint', 'site password blocks GET');
    await skip('Search without params', 'site password blocks GET');
    await skip('Search with query', 'site password blocks GET');
  } else {
    await test('Stats endpoint returns chunk count and categories', async () => {
      const res = await fetch(`${BASE_URL}/.netlify/functions/memories?action=stats`);
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.ok(typeof data.chunks === 'number', 'Should have chunks count');
      assert.ok(data.chunks >= 0, 'Chunks count should be non-negative');
      assert.ok(Array.isArray(data.categories), 'Should have categories array');
      assert.ok(typeof data.totalCharacters === 'number', 'Should have totalCharacters');
    });

    await test('Categories endpoint returns category list', async () => {
      const res = await fetch(`${BASE_URL}/.netlify/functions/memories?action=categories`);
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(data.categories), 'Should have categories array');
    });

    await test('Get persons endpoint returns person list', async () => {
      const res = await fetch(`${BASE_URL}/.netlify/functions/memories?action=get_persons`);
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(data.persons), 'Should have persons array');
      if (data.persons.length > 0) {
        assert.ok(data.persons[0].name, 'Person should have name');
      }
    });

    await test('Search without params returns error', async () => {
      const res = await fetch(`${BASE_URL}/.netlify/functions/memories?action=search`);
      const data = await res.json();
      assert.ok(data.error, 'Should return error when no q or category');
    });

    await test('Search with query returns results', async () => {
      const res = await fetch(`${BASE_URL}/.netlify/functions/memories?action=search&q=coragem`);
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(data.results), 'Should have results array');
      assert.ok(data.query === 'coragem', 'Should echo query');
    });
  }

  // ===============================================
  // 6. EDGE CASES & SECURITY
  // ===============================================
  console.log('\n\u2500\u2500 Edge Cases & Security \u2500\u2500');

  if (sitePasswordBlocking) {
    await skip('Auth endpoint rejects GET method', 'site password blocks GET');
    await skip('Chat endpoint rejects GET method', 'site password blocks GET');
  } else {
    await test('Auth endpoint rejects GET method', async () => {
      const res = await fetch(`${BASE_URL}/.netlify/functions/auth`);
      assert.equal(res.status, 405);
    });

    await test('Chat endpoint rejects GET method', async () => {
      const res = await fetch(`${BASE_URL}/.netlify/functions/chat`);
      assert.equal(res.status, 405);
    });
  }

  await test('Protected memories action without auth returns 401', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_config', key: 'test', value: 'hack' }),
    });
    // Accept both JSON 401 (function auth) and HTML 401 (Netlify site password)
    assert.equal(res.status, 401, 'Admin action without auth should be 401');
  });

  if (authToken) {
    await test('Unknown POST action on memories returns 400', async () => {
      const res = await authFetch(`${BASE_URL}/.netlify/functions/memories`, {
        method: 'POST',
        body: JSON.stringify({ action: 'nonexistent_action' }),
      });
      const data = await safeJson(res);
      assert.ok(data, 'Expected JSON response, got HTML');
      assert.equal(res.status, 400);
    });
  } else {
    await skip('Unknown POST action on memories returns 400', 'no auth token available');
  }

  // ===============================================
  // RESULTS
  // ===============================================
  const total = passCount + failCount + skipCount;
  console.log(`\n\ud83d\udcca Results: ${passCount} passed, ${failCount} failed, ${skipCount} skipped (${total} total)`);
  if (sitePasswordBlocking) {
    console.log(`\u26a0  ${skipCount} tests skipped due to Netlify site password on GET endpoints`);
  }
  console.log('');
  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
