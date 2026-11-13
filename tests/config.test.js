import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSetting } from '../api/_lib/config.js';
import { APP_UI_OPTIONS, DEFAULT_APP_UI, THEMES } from '../shared/themes.js';

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

test('all eight app themes are accepted by the settings API', () => {
  assert.equal(THEMES.length, 8);
  assert.equal(new Set(THEMES.map(theme => theme.id)).size, 8);
  for (const theme of THEMES) assert.equal(validateSetting('theme_preset', theme.id), theme.id);
  assert.throws(() => validateSetting('theme_preset', 'missing-theme'));
});

test('appearance settings validate supported options and safe artwork URLs', () => {
  const value = { ...DEFAULT_APP_UI, display_name: ' AnimePlex ', home_layout: 'compact', background_url: 'https://example.com/art.png' };
  assert.deepEqual(validateSetting('app_ui', value), { ...value, display_name: 'AnimePlex' });
  for (const [key, options] of Object.entries(APP_UI_OPTIONS)) {
    for (const option of options) assert.equal(validateSetting('app_ui', { [key]: option })[key], option);
    assert.throws(() => validateSetting('app_ui', { [key]: 'unsupported' }));
  }
  assert.throws(() => validateSetting('app_ui', { display_name: '  ' }));
  assert.throws(() => validateSetting('app_ui', { tagline: 'x'.repeat(121) }));
  assert.throws(() => validateSetting('app_ui', { background_url: 'http://example.com/art.png' }));
  assert.throws(() => validateSetting('app_ui', { unexpected: true }));
});
