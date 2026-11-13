import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSetting } from '../api/_lib/config.js';

test('settings accept only known keys and correct types', () => {
  assert.equal(validateSetting('maintenance_mode', false), false);
  assert.equal(validateSetting('home_message', 'Welcome'), 'Welcome');
  assert.equal(validateSetting('theme_preset', 'sakura'), 'sakura');
  assert.equal(validateSetting('accent_color', '#F3B35E'), '#f3b35e');
  assert.throws(() => validateSetting('maintenance_mode', 'false'));
  assert.throws(() => validateSetting('not_allowed', true));
  assert.throws(() => validateSetting('home_message', 'x'.repeat(1001)));
  assert.throws(() => validateSetting('theme_preset', 'unknown'));
});

test('repository URLs are HTTPS, unique, and do not contain credentials', () => {
  const item = { id: 'stream-1', name: ' Stream-1 ', url: 'https://example.com/repo.json', enabled: true };
  assert.deepEqual(validateSetting('source_repositories', [item]), [{ ...item, name: 'Stream-1' }]);
  assert.throws(() => validateSetting('source_repositories', [{ ...item, url: 'http://example.com/repo.json' }]));
  assert.throws(() => validateSetting('source_repositories', [{ ...item, url: 'https://u:p@example.com/repo.json' }]));
  assert.throws(() => validateSetting('source_repositories', [item, { ...item, id: 'other' }]));
  assert.throws(() => validateSetting('source_repositories', [item, { ...item, url: 'https://other.example/' }]));
});

test('feature flag names and values are validated on the server', () => {
  assert.deepEqual(validateSetting('feature_flags', { downloads_enabled: true, search_enabled: false }), { downloads_enabled: true, search_enabled: false });
  assert.throws(() => validateSetting('feature_flags', { 'invalid-name': true }));
  assert.throws(() => validateSetting('feature_flags', { valid_name: 'true' }));
  assert.throws(() => validateSetting('feature_flags', []));
});
