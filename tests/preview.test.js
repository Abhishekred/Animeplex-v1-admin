import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoApi } from '../src/lib/demo.js';

test('preview CRUD is isolated and never contacts a server', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Network access in preview'); };
  try {
    const api = createDemoApi();
    const otherPreview = createDemoApi();
    const initial = await api('content');
    const created = await api('content', 'POST', { title: 'Preview title', is_active: true });
    await api('content', 'PATCH', { id: created.content.id, title: 'Edited title' });
    assert.equal((await api('content')).content[0].title, 'Edited title');
    await api('content', 'DELETE', { id: created.content.id });
    assert.equal((await api('content')).content.length, initial.content.length);
    await api('config', 'PUT', { key: 'maintenance_mode', value: true });
    await api('config', 'PUT', { key: 'theme_preset', value: 'emerald-noir' });
    await api('config', 'PUT', { key: 'app_ui', value: { tagline: 'A new adventure', home_layout: 'compact' } });
    assert.equal((await api('dashboard')).settings.maintenance_mode, true);
    assert.equal((await api('dashboard')).settings.theme_preset, 'emerald-noir');
    assert.equal((await api('dashboard')).settings.app_ui.tagline, 'A new adventure');
    assert.equal((await api('dashboard')).settings.app_ui.home_layout, 'compact');
    assert.equal((await otherPreview('dashboard')).settings.maintenance_mode, false);
    await assert.rejects(() => api('config', 'PUT', { key: 'maintenance_mode', value: 'yes' }));
    assert.equal((await api('devices')).pairings[0].status, 'pending');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
