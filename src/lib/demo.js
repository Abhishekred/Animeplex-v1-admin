import { buildAuditTrend } from '../../api/_lib/analytics.js';
import { validateSetting } from '../../api/_lib/config.js';
import { DEFAULT_APP_UI } from '../../shared/themes.js';

export const PREVIEW_SESSION = Object.freeze({ user: { email: 'preview@animeplex.example' } });
const clone = (value) => JSON.parse(JSON.stringify(value));
const ago = (days, hour = 12) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

/** A separate, in-memory preview. It never receives credentials or calls a server. */
export function createDemoApi() {
  let next = 100;
  const state = {
    users: [
      { id: 'demo-user-1', email: 'sora@example.com', created_at: ago(12), last_sign_in_at: ago(0), banned_until: null, profile: { display_name: 'Sora' } },
      { id: 'demo-user-2', email: 'hikari@example.com', created_at: ago(7), last_sign_in_at: ago(1), banned_until: null, profile: { display_name: 'Hikari' } },
      { id: 'demo-user-3', email: 'ren@example.com', created_at: ago(4), last_sign_in_at: ago(2), banned_until: null, profile: { display_name: 'Ren' } },
    ],
    releases: [{ id: 'demo-release-1', version: '1.2.0', version_code: 120, platform: 'android', channel: 'stable', status: 'published', rollout_percent: 100, created_at: ago(3) }],
    content: [{ id: 'demo-content-1', title: 'Your next adventure', description: 'A sample featured card for your home screen.', category: 'featured', image_url: null, target_url: null, position: 0, is_active: true, created_at: ago(2) }],
    announcements: [{ id: 'demo-announcement-1', title: 'Welcome to AnimePlex', body: 'A sample announcement for your community.', type: 'info', action_url: null, is_active: true, created_at: ago(1) }],
    settings: {
      maintenance_mode: false, community_popup_enabled: false,
      theme_preset: 'midnight-gold', accent_color: '#f3b35e',
      app_ui: { ...DEFAULT_APP_UI },
      default_source: 'MovieBoxProvider', home_message: 'Your next story starts here.',
      feature_flags: { downloads_enabled: true, search_enabled: true },
      source_repositories: [{ id: 'stream-1', name: 'Stream-1', url: 'https://raw.githubusercontent.com/Abhishekred/Stream-1/refs/heads/builds/repo.json', enabled: true }],
    },
    pairings: [{ id: 'demo-tv-1', code: 'DEMO', status: 'pending', device_name: 'Living room TV', app_user_id: 'demo-user-1', expires_at: Date.now() + 600000, created_at: ago(0) }],
    admins: [{ user_id: 'demo-owner', role: 'owner', is_active: true, created_at: ago(20) }],
    backups: [{ user_key: 'demo-user-1', updated_at: ago(1) }],
    events: Array.from({ length: 14 }, (_, i) => ({
      id: `demo-event-${i}`, actor_email: 'preview@animeplex.example', actor_role: 'owner',
      action: ['config.update', 'content.update', 'announcement.create', 'release.publish'][i % 4],
      target_type: 'preview', target_id: `item-${i + 1}`, created_at: ago(i % 7, 9 + (i % 8)), details: {},
    })),
  };
  const record = (action, target, targetId) => state.events.unshift({
    id: `demo-event-${next++}`, actor_email: 'preview@animeplex.example', actor_role: 'owner',
    action, target_type: target, target_id: targetId, created_at: new Date().toISOString(), details: {},
  });
  const get = (list, id) => {
    const item = list.find(row => row.id === id);
    if (!item) throw new Error('Preview item not found.');
    return item;
  };

  return async function demoApi(resource, method = 'GET', body = null, params = '') {
    const b = body || {};
    let result;
    if (resource === 'dashboard' && method === 'GET') {
      result = {
        role: 'owner', stats: { users: state.users.length, activeAnnouncements: state.announcements.filter(x => x.is_active).length, backupAccounts: state.backups.length, admins: state.admins.filter(x => x.is_active).length },
        releases: state.releases.slice(0, 5), backups: state.backups.slice(0, 5), activity: state.events.slice(0, 8), auditTrend: buildAuditTrend(state.events), settings: state.settings,
      };
    } else if (resource === 'users') {
      if (method === 'GET') {
        const page = Math.max(1, Number(new URLSearchParams(params).get('page')) || 1);
        result = { users: state.users.slice((page - 1) * 30, page * 30), total: state.users.length };
      } else {
        const user = get(state.users, b.userId);
        if (b.action === 'delete') state.users = state.users.filter(x => x.id !== b.userId);
        else if (b.action === 'ban') user.banned_until = new Date(Date.now() + 86400000).toISOString();
        else if (b.action === 'unban') user.banned_until = null;
        else throw new Error('Unsupported preview action.');
        record(`user.${b.action}`, 'user', b.userId); result = { ok: true };
      }
    } else if (resource === 'config') {
      if (method === 'GET') result = { settings: Object.entries(state.settings).map(([key, value]) => ({ key, value })) };
      else { state.settings[b.key] = validateSetting(b.key, b.value); record('config.update', 'setting', b.key); result = { ok: true }; }
    } else if (resource === 'content' || resource === 'announcements') {
      const list = state[resource];
      const singular = resource === 'content' ? 'content' : 'announcement';
      if (method === 'GET') result = { [resource]: list };
      else if (method === 'POST') { const row = { ...b, id: `demo-${next++}`, created_at: new Date().toISOString() }; list.unshift(row); record(`${singular}.create`, singular, row.id); result = { [singular]: row }; }
      else if (method === 'PATCH') { const row = get(list, b.id); Object.assign(row, b); record(`${singular}.update`, singular, row.id); result = { [singular]: row }; }
      else if (method === 'DELETE') { state[resource] = list.filter(row => row.id !== b.id); record(`${singular}.delete`, singular, b.id); result = { ok: true }; }
    } else if (resource === 'releases') {
      if (method === 'GET') result = { releases: state.releases };
      else if (b.action === 'create-upload') result = { path: 'preview/only.apk', token: 'preview-only' };
      else if (b.action === 'create') { const row = { ...b, id: `demo-release-${next++}`, status: 'draft', created_at: new Date().toISOString() }; state.releases.unshift(row); record('release.create', 'release', row.id); result = { release: row }; }
      else { const row = get(state.releases, b.id); row.status = ({ publish: 'published', pause: 'paused', rollback: 'rolled_back' })[b.action] || row.status; record(`release.${b.action}`, 'release', row.id); result = { ok: true }; }
    } else if (resource === 'devices') {
      if (method === 'GET') result = { pairings: state.pairings };
      else { const row = get(state.pairings, b.id); row.status = 'expired'; record('device.pairing.expire', 'tv_pairing', row.id); result = { ok: true }; }
    } else if (resource === 'backups') result = { backups: state.backups };
    else if (resource === 'audit') result = { events: state.events };
    else if (resource === 'admins') {
      if (method === 'GET') result = { admins: state.admins };
      else if (method === 'POST') { const row = { user_id: `demo-admin-${next++}`, role: b.role, is_active: true, created_at: new Date().toISOString() }; state.admins.push(row); record('admin.grant', 'admin', row.user_id); result = { ok: true }; }
      else { const row = state.admins.find(x => x.user_id === b.user_id); if (!row) throw new Error('Preview admin not found.'); Object.assign(row, b); record('admin.update', 'admin', row.user_id); result = { ok: true }; }
    } else if (resource === 'health') result = { services: [
      { name: 'Supabase database', status: 'operational', detail: 'Example status' },
      { name: 'OTA release registry', status: 'operational', detail: 'Example status' },
      { name: 'Admin access registry', status: 'operational', detail: 'Example status' },
    ] };
    if (!result) throw new Error('Unsupported preview operation.');
    return clone(result);
  };
}
