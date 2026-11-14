import test from 'node:test';
import assert from 'node:assert/strict';
import { updateOwnCredentials } from '../api/_lib/account.js';

function setup(verification = { data: { user: { id: 'owner-id' } }, error: null }) {
  const writes = [], audits = [], verifications = [], signouts = [];
  const ctx = { user: { id: 'owner-id', email: 'admin@example.com' }, supabase: { auth: { admin: { async updateUserById(id, changes) { writes.push({ id, changes }); return { error: null }; } } } } };
  const options = {
    makeVerifier: () => ({ auth: { async signInWithPassword(value) { verifications.push(value); return verification; }, async signOut(value) { signouts.push(value); } } }),
    recordAudit: async (...args) => { audits.push(args); },
  };
  return { ctx, options, writes, audits, verifications, signouts };
}

test('credentials change only for the authenticated account after password verification', async () => {
  const s = setup();
  const result = await updateOwnCredentials(s.ctx, { currentPassword: 'current-test', email: 'new@example.com', password: 'new-test-password' }, s.options);
  assert.equal(result.ok, true);
  assert.deepEqual(s.verifications, [{ email: 'admin@example.com', password: 'current-test' }]);
  assert.deepEqual(s.writes, [{ id: 'owner-id', changes: { email: 'new@example.com', password: 'new-test-password' } }]);
  assert.deepEqual(s.signouts, [{ scope: 'local' }]);
  assert.equal(s.audits[0][1], 'admin.credentials.updated');
  assert.deepEqual(s.audits[0][4], { emailChanged: true, passwordChanged: true });
  assert.ok(!JSON.stringify(s.audits).includes('current-test'));
  assert.ok(!JSON.stringify(s.audits).includes('new-test-password'));
});

test('wrong password or a different verified user cannot change credentials', async () => {
  for (const verification of [{ data: { user: null }, error: new Error('invalid') }, { data: { user: { id: 'other' } }, error: null }]) {
    const s = setup(verification);
    const result = await updateOwnCredentials(s.ctx, { currentPassword: 'wrong', password: 'new-test-password' }, s.options);
    assert.equal(result.status, 403);
    assert.equal(s.writes.length, 0);
  }
});

test('invalid or empty changes are rejected before any sign-in', async () => {
  for (const body of [{ currentPassword: '', password: 'valid-password' }, { currentPassword: 'ok' }, { currentPassword: 'ok', email: 'bad email' }, { currentPassword: 'ok', password: 'short' }]) {
    const s = setup();
    const result = await updateOwnCredentials(s.ctx, body, s.options);
    assert.equal(result.status, 400);
    assert.equal(s.verifications.length, 0);
  }
});
