import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/admin/[resource].js';

test('admin API refuses unauthenticated reads and writes', async () => {
  for (const [resource, method] of [['dashboard', 'GET'], ['config', 'PUT'], ['content', 'POST'], ['account', 'POST']]) {
    const response = { code: 0, body: null, headers: {}, status(code) { this.code = code; return this; }, setHeader(key, value) { this.headers[key] = value; return this; }, json(body) { this.body = body; return this; } };
    await handler({ method, query: { resource }, headers: {}, body: {} }, response);
    assert.equal(response.code, 401);
    assert.equal(response.body.error, 'Sign in required.');
    assert.equal(response.headers['Cache-Control'], 'no-store');
  }
});
