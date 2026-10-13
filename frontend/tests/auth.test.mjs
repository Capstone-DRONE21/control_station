import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { login, logout, restoreSession } from '../src/features/auth/api.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('login sends credentials and CSRF header, and returns the operator', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/auth/login');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.headers['X-CSRF-Protection'], '1');
    assert.deepEqual(JSON.parse(options.body), { username: 'operator', password: 'example-password' });
    return Response.json({ id: 1, username: 'operator' });
  };
  assert.deepEqual(await login('operator', 'example-password'), { id: 1, username: 'operator' });
});

test('invalid credentials do not produce an authenticated account', async () => {
  globalThis.fetch = async () => new Response(null, { status: 401 });
  await assert.rejects(login('operator', 'wrong'), /Invalid username or password/);
});

test('session restoration distinguishes expired sessions from server failures', async () => {
  globalThis.fetch = async () => new Response(null, { status: 401 });
  assert.equal(await restoreSession(new AbortController().signal), null);
  globalThis.fetch = async () => new Response(null, { status: 500 });
  await assert.rejects(restoreSession(new AbortController().signal), /Could not check your session/);
});

test('failed logout rejects so the dashboard can retain the session', async () => {
  globalThis.fetch = async () => new Response(null, { status: 500 });
  await assert.rejects(logout(), /Could not log out/);
});
