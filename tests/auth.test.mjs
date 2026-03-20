/**
 * ALMA Auth Tests — Basic integration tests for authentication
 * Run: node tests/auth.test.mjs
 *
 * Requires: DATABASE_URL env var pointing to a test/demo database
 */

import { strict as assert } from 'assert';

const BASE_URL = process.env.TEST_URL || 'https://alma-demo.netlify.app';

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  return fn().then(() => {
    console.log(`  ✓ ${name}`);
    passCount++;
  }).catch(e => {
    console.error(`  ✗ ${name}: ${e.message}`);
    failCount++;
  });
}

async function runTests() {
  console.log(`\n🧪 ALMA Auth Tests — ${BASE_URL}\n`);

  // --- LOGIN TESTS ---

  await test('Login with valid credentials returns token', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username: 'Lucas', password: 'demo123' }),
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(data.token, 'Token should exist');
    assert.ok(data.token.length >= 32, 'Token should be at least 32 chars');
    assert.equal(data.name, 'Lucas');
    assert.equal(data.type, 'filho');
  });

  await test('Login with wrong password returns 401', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username: 'Lucas', password: 'wrongpassword' }),
    });
    assert.equal(res.status, 401);
  });

  await test('Login with nonexistent user returns 401', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username: 'NobodyExists', password: 'test' }),
    });
    assert.equal(res.status, 401);
  });

  await test('Login without username returns 400', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', password: 'demo123' }),
    });
    assert.equal(res.status, 400);
  });

  // --- TOKEN VERIFY TESTS ---

  await test('Verify valid token returns user info', async () => {
    // First login to get a token
    const loginRes = await fetch(`${BASE_URL}/.netlify/functions/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username: 'Lucas', password: 'demo123' }),
    });
    const loginData = await loginRes.json();

    // Now verify the token
    const verifyRes = await fetch(`${BASE_URL}/.netlify/functions/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', token: loginData.token }),
    });
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.valid, true);
    assert.equal(verifyData.name, 'Lucas');
  });

  await test('Verify invalid token returns 401', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', token: 'totally-fake-token-12345' }),
    });
    const data = await res.json();
    assert.equal(data.valid, false);
  });

  // --- HEALTH CHECK ---

  await test('Health check returns ok', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/memories?action=health`);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.checks.database, true);
    assert.equal(data.checks.anthropic, true);
  });

  // --- CHAT TEST ---

  await test('Chat endpoint responds with AI message', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'What is courage?',
        personName: 'Lucas',
        lang: 'en',
        history: [],
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.response, 'Should have a response');
    assert.ok(data.response.length > 50, 'Response should be substantial');
    assert.ok(data.memoriesUsed >= 0, 'Should report memories used');
  });

  // --- RESULTS ---

  console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed\n`);
  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
