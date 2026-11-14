import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { AUTH_OPTIONS, observeAuthSession, requestWithSessionRetry } from '../src/lib/session.js';

test('a newer auth event wins over a delayed session restore', async () => {
  let listener, resolveRestore;
  let unsubscribed = false;
  const auth = {
    onAuthStateChange(callback) { listener = callback; return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } }; },
    getSession() { return new Promise(resolve => { resolveRestore = resolve; }); },
  };
  const sessions = [];
  const observer = observeAuthSession(auth, { onSession: (session, event) => sessions.push([session, event]), onUnavailable: () => assert.fail('Unexpected recovery error') });
  const pending = observer.restore();
  listener('SIGNED_OUT', null);
  resolveRestore({ data: { session: { access_token: 'stale' } }, error: null });
  await pending;
  assert.deepEqual(sessions, [[null, 'SIGNED_OUT']]);
  observer.close();
  assert.equal(unsubscribed, true);
});

test('a temporary recovery error keeps the saved session available for retry', async () => {
  let attempts = 0;
  const savedSession = { access_token: 'saved' };
  const auth = {
    onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
    async getSession() { attempts += 1; return attempts === 1 ? { data: { session: null }, error: new Error('offline') } : { data: { session: savedSession }, error: null }; },
  };
  const sessions = [], errors = [];
  const observer = observeAuthSession(auth, { onSession: session => sessions.push(session), onUnavailable: error => errors.push(error.message) });
  await observer.restore();
  assert.deepEqual(errors, ['offline']);
  assert.deepEqual(sessions, []);
  await observer.restore();
  assert.deepEqual(sessions, [savedSession]);
  observer.close();
});

test('admin requests retry only a 401 and use the renewed token once', async () => {
  const used = [];
  const auth = { async getSession() { return { data: { session: { access_token: 'old' } }, error: null }; }, async refreshSession() { return { data: { session: { access_token: 'new' } }, error: null }; } };
  const result = await requestWithSessionRetry(auth, 'old', async token => { used.push(token); return { status: token === 'old' ? 401 : 200 }; });
  assert.equal(result.status, 200);
  assert.deepEqual(used, ['old', 'new']);
  const denied = await requestWithSessionRetry(auth, 'old', async () => ({ status: 403 }));
  assert.equal(denied.status, 403);
  const signedOut = await requestWithSessionRetry({ async getSession() { return { data: { session: null }, error: null }; } }, 'old', async () => ({ status: 401 }));
  assert.equal(signedOut.status, 401);
});

test('Supabase session survives a new client, refreshes and signs out locally', async () => {
  assert.equal(AUTH_OPTIONS.persistSession, true);
  assert.equal(AUTH_OPTIONS.autoRefreshToken, true);
  const entries = new Map();
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
  const requests = [];
  const mockFetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    requests.push({ path: url.pathname, query: url.searchParams.toString(), method: init.method });
    if (url.pathname.endsWith('/token')) {
      const refreshed = url.searchParams.get('grant_type') === 'refresh_token';
      return new Response(JSON.stringify({ access_token: refreshed ? 'access-two' : 'access-one', refresh_token: refreshed ? 'refresh-two' : 'refresh-one', expires_in: 3600, token_type: 'bearer', user: { id: 'test-user', email: 'admin@example.com', app_metadata: {}, user_metadata: {} } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname.endsWith('/logout')) return new Response(null, { status: 204 });
    return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } });
  };
  const options = { auth: { ...AUTH_OPTIONS, storage, storageKey: 'test-admin-session', autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: mockFetch } };
  const first = createClient('https://unit-test.supabase.co', 'test-publishable-key', options);
  try {
    const login = await first.auth.signInWithPassword({ email: 'admin@example.com', password: 'test-only-password' });
    assert.equal(login.error, null);
    assert.equal(login.data.session.access_token, 'access-one');
  } finally { await first.auth.dispose(); }
  // Simulate reopening the browser after the old access token has expired.
  const saved = JSON.parse(entries.get('test-admin-session'));
  saved.expires_at = Math.floor(Date.now() / 1000) - 1;
  entries.set('test-admin-session', JSON.stringify(saved));
  const next = createClient('https://unit-test.supabase.co', 'test-publishable-key', { ...options, auth: { ...options.auth, autoRefreshToken: true } });
  try {
    const restored = await next.auth.getSession();
    assert.equal(restored.error, null);
    assert.equal(restored.data.session.access_token, 'access-two');
    assert.match(entries.get('test-admin-session'), /refresh-two/);
    assert.equal((await next.auth.signOut({ scope: 'local' })).error, null);
    assert.equal(entries.has('test-admin-session'), false);
    assert.ok(requests.some(request => request.path.endsWith('/logout') && request.query.includes('scope=local')));
  } finally { await next.auth.dispose(); }
});
