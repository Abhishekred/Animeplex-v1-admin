
import './style.css';
import './glass.css';
import { createClient } from '@supabase/supabase-js';
import { escapeHtml as esc, isHttpsUrl, validateRelease, shortDate, compareVersions } from './utils.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  : null;
const root = document.getElementById('app');
const initialRelease = () => ({
  version: '', channel: 'stable', title: '', release_notes: '',
  apk_url: '', apk_size: 0, mandatory: false, status: 'draft',
});
const state = {
  user: null, member: null, config: null, releases: [], page: 'overview',
  selectedId: null, draft: null, loading: true, busy: false,
  error: '', loginError: '', mobileOpen: false,
};
const iconShapes = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  package: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M3 11h18M8 7V4h8v3"/>',
  sliders: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="m9 18 6-6-6-6"/>',
  out: '<path d="M13 4h7v7m0-7-9 9"/><path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"/>',
  cloud: '<path d="M20 16.6A4 4 0 0 0 18 9h-1a6 6 0 0 0-11.8 1A4 4 0 0 0 7 18h11"/><path d="m9 14 3 3 3-3"/>',
  spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 13 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  toggle: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18m0-18c5 5 5 13 0 18"/>',
  logout: '<path d="M10 17l5-5-5-5m5 5H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6"/>',
  edit: '<path d="m4 20 4-1 11-11-3-3L5 16l-1 4Z"/><path d="m14 7 3 3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-4L4 9m0-5v5h5"/><path d="M4 13a8 8 0 0 0 14 4l2-2m0 5v-5h-5"/>',
  save: '<path d="M5 3h13l3 3v15H3V3h2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  alert: '<path d="m12 3 10 18H2L12 3Zm0 7v5m0 3h.01"/>',
};
function icon(name, size = 18) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconShapes[name] ?? iconShapes.info}</svg>`;
}
function pill(status) {
  return `<span class="pill ${esc(status)}">${status === 'published' ? icon('check',12) : status === 'paused' ? icon('pause',12) : icon('clock',12)} ${esc(status)}</span>`;
}
function brand() {
  return `<div class="brand"><div class="brand-mark">A</div><div><div class="brand-label">AnimePlex</div><div class="brand-caption">ADMIN CONSOLE</div></div></div>`;
}
function toast(message, bad = false) {
  let host = document.querySelector('.toast-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'toast' + (bad ? ' bad' : '');
  el.innerHTML = icon(bad ? 'alert' : 'check', 18) + '<span>' + esc(message) + '</span>';
  host.appendChild(el);
  window.setTimeout(() => el.remove(), 4600);
}
function errorMessage(e) { return e?.message ?? String(e ?? 'Unknown error'); }
function hasWriteAccess(role) { return ['owner','admin','release_manager'].includes(role); }
function selectedRelease() { return state.releases.find(r => r.id === state.selectedId) ?? null; }
function config() { return state.config ?? { enabled: true, auto_check: true, beta_enabled: true, repository_url: 'https://github.com/Abhishekred/Animeplex-V1' }; }
function published() { return state.releases.filter(r => r.status === 'published'); }
function nav(label, page, shape) {
  return `<button type="button" class="nav-link ${state.page === page ? 'is-active' : ''}" data-page="${page}">${icon(shape,18)}<span>${esc(label)}</span></button>`;
}
function authView() {
  root.innerHTML = `<div class="auth"><div class="auth-layout">
    <div class="auth-brand">${brand()}</div>
    <div class="auth-card">
      <div class="eyebrow">Authorized access only</div>
      <h1 class="auth-title">Welcome back.</h1>
      <p class="auth-copy">Sign in to control AnimePlex app releases. Only verified admin accounts can publish updates.</p>
      ${state.loginError ? `<div class="auth-error" role="alert">${esc(state.loginError)}</div><div style="height:15px"></div>` : ''}
      ${state.user && !state.member ? `<div class="alert warning">Your account is signed in but has no active AnimePlex release-manager role. Contact the database owner to grant access.</div><div style="height:16px"></div><button class="btn btn-full" data-action="logout">Sign out</button>` :
      `<form id="login-form" class="stack">
        <div><label class="label" for="admin-email">Email address</label><input required class="field" id="admin-email" type="email" name="email" autocomplete="username" placeholder="admin@example.com"></div>
        <div><label class="label" for="admin-password">Password</label><input required class="field" id="admin-password" type="password" name="password" autocomplete="current-password" placeholder="Enter your password"></div>
        <button type="submit" class="btn btn-primary btn-full" ${state.busy ? 'disabled' : ''}>${icon('lock',17)} ${state.busy ? 'Signing in…' : 'Sign in securely'} ${icon('arrow',16)}</button>
      </form>`}
    </div>
    <div class="auth-footer">Protected by Supabase Auth + row-level security. No public sign-up.</div>
  </div></div>`;
}
function shell() {
  const c = config();
  const stateLabel = c.enabled ? 'Update delivery enabled' : 'Update delivery paused';
  const userEmail = state.user?.email ?? 'Admin';
  return `
    <div class="mobile-dim ${state.mobileOpen ? 'is-open' : ''}" data-action="close-menu"></div>
    <div class="shell"><aside class="sidebar ${state.mobileOpen ? 'is-open' : ''}">
      ${brand()}
      <div class="nav-section">Release centre</div>
      <div class="nav-list">
        ${nav('Overview','overview','grid')}
        ${nav('Release management','releases','package')}
      </div>
      <div class="nav-section" style="margin-top:24px">Management</div>
      <div class="nav-list">${nav('Update settings','settings','sliders')}</div>
      <div class="nav-spacer"></div>
      <div class="side-status"><div class="side-status-title"><i class="online-dot" style="${c.enabled ? '' : 'background:#e8aa5d;box-shadow:0 0 9px #e8aa5d6b'}"></i> ${esc(stateLabel)}</div>
        <div class="side-status-sub">Only published updates can reach the app. GitHub releases are never auto-announced.</div>
      </div>
      <div class="user-panel"><div class="avatar">${esc(userEmail.slice(0,1).toUpperCase())}</div>
        <div style="min-width:0;flex:1"><div class="user-name" title="${esc(userEmail)}">${esc(userEmail)}</div><div class="user-role">${esc(state.member?.role ?? 'Admin')}</div></div>
        <button type="button" class="icon-btn" title="Sign out" aria-label="Sign out" data-action="logout">${icon('logout',19)}</button>
      </div>
    </aside>
    <main class="main">
      <div class="topbar"><div class="mobile-top"><button type="button" class="icon-btn" data-action="menu" aria-label="Open menu">${icon('menu',22)}</button></div>
      <div class="breadcrumb"><span>AnimePlex</span> ${icon('arrow',13)} <strong>${state.page === 'overview' ? 'Overview' : state.page === 'releases' ? 'Releases' : 'Update settings'}</strong></div>
      <div class="bar-actions"><span class="bar-time">${esc(new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}))}</span>
        <div class="bar-chip">${icon('shield',15)} Secure workspace</div>
      </div></div>
      <div class="content">
        ${state.error ? `<div class="alert warning" style="margin-bottom:22px">${icon('alert',19)} ${esc(state.error)}</div>` : ''}
        ${state.page === 'overview' ? overview() : state.page === 'releases' ? releasePage() : settingsPage()}
      </div>
    </main></div>`;
}
function heading(eyebrow, title, text, action = '') {
  return `<div class="page-head"><div><div class="eyebrow">${esc(eyebrow)}</div><h1 class="heading">${title}</h1><p class="subtitle">${esc(text)}</p></div>${action}</div>`;
}
function stats() {
  const items = [
    ['Published', published().length, 'Visible to eligible app users', 'cloud'],
    ['Drafts', state.releases.filter(r => r.status === 'draft').length, 'Private until you publish', 'edit'],
    ['Paused', state.releases.filter(r => r.status === 'paused').length, 'No longer offered to users', 'pause'],
    ['Update delivery', config().enabled ? 'ON' : 'OFF', config().enabled ? 'Admin published only' : 'Globally disabled', 'shield'],
  ];
  return `<div class="stats">${items.map(x => `<div class="stat"><div class="stat-top"><span>${esc(x[0])}</span><div class="stat-icon">${icon(x[3],19)}</div></div><div class="stat-value">${x[1]}</div><div class="stat-foot">${esc(x[2])}</div></div>`).join('')}</div>`;
}
function recentRows(limit = 5) {
  if (!state.releases.length) {
    return `<div class="empty"><div class="empty-orb">${icon('package',29)}</div><h3>No releases yet</h3><p>Start with a draft. Nothing is sent to users until you press Publish.</p><button class="btn btn-primary" data-action="new-release">${icon('plus',16)} Create first release</button></div>`;
  }
  return `<div class="activity-list">${state.releases.slice(0,limit).map(r => `
   <div class="activity-row"><div class="release-icon">${icon('package',19)}</div>
      <div class="activity-content"><div class="activity-main"><span>v${esc(r.version)}</span> ${pill(r.status)} <span class="pill ${esc(r.channel)}">${esc(r.channel)}</span></div>
        <div class="activity-sub">${esc(r.title || 'AnimePlex Android')} · ${shortDate(r.published_at || r.created_at)}</div></div>
      <button class="icon-btn" data-action="select-release" data-id="${esc(r.id)}" title="View release" aria-label="View release">${icon('arrow',18)}</button>
   </div>`).join('')}</div>`;
}
function preview(release) {
  const value = release || {};
  return `<div class="preview"><div class="app-popup">
    <div class="popup-icon">${icon('cloud',23)}</div>
    <div class="popup-title">${value.channel === 'beta' ? 'Beta update available' : 'Update available'}</div>
    <div class="popup-sub">AnimePlex · Version ${esc(value.version || '2.3.7')}</div>
    <div class="popup-notes">${esc(value.release_notes || 'Your release notes will appear here when an update is published.')}</div>
    <div class="popup-button">Update now</div>
  </div></div>`;
}

function overview() {
  const latest = [...published()].sort((a,b)=>compareVersions(b.version,a.version))[0];
  const repo = config().repository_url;
  return `
    ${heading('Control room','Update <span>overview</span>','One command centre to decide exactly when AnimePlex users see a new release.',
      `<button class="btn btn-primary" data-action="new-release">${icon('plus',18)} New release</button>`)}
    ${stats()}
    <div class="dual-grid">
      <section class="card"><div class="card-head"><div><h2>Release timeline</h2><p>Latest releases and draft activity</p></div><button class="btn btn-ghost btn-sm" data-page="releases">View all ${icon('arrow',15)}</button></div>${recentRows()}</section>
      <section class="card"><div class="card-head"><div><h2>Live app preview</h2><p>What your audience will see</p></div><span class="pill">Android</span></div><div class="card-body">
        ${preview(latest)}
        <div class="divider"></div>
        <div class="stack-sm">
          <div class="kpi-inline">${icon('package',15)} Latest published: <b>${latest ? 'v' + esc(latest.version) : 'None'}</b></div>
          <div class="kpi-inline">${icon('globe',15)} Repository: <a href="${esc(isHttpsUrl(repo) ? repo : '#')}" target="_blank" rel="noopener noreferrer" class="code-url">${esc(repo)}</a></div>
          <div class="kpi-inline">${icon('shield',15)} Distribution: <b>Admin publish only</b></div>
        </div>
      </div></section>
    </div>
    <div class="card" style="margin-top:22px"><div class="card-head"><div><h2>Release safety</h2><p>Designed to keep public updates under your control</p></div>${icon('shield',20)}</div>
      <div class="card-body security-list">
        <div class="security-row">${icon('check')} Draft versions never appear in the app update feed.</div>
        <div class="security-row">${icon('check')} Only active administrators can publish or pause a release.</div>
        <div class="security-row">${icon('check')} The app ignores GitHub Releases unless you publish an APK link here.</div>
        <div class="security-row">${icon('check')} Every release needs an installable, publicly accessible signed APK.</div>
      </div>
    </div>`;
}
function releaseList() {
  if (!state.releases.length) {
    return `<div class="empty"><div class="empty-orb">${icon('package',27)}</div><h3>No releases created</h3><p>Save a draft first. Publish when ready.</p></div>`;
  }
  return `<div class="release-list">${state.releases.map(r => `
    <button type="button" class="release-list-item ${state.selectedId === r.id ? 'is-selected' : ''}" data-action="select-release" data-id="${esc(r.id)}">
      <div class="release-icon">${icon('package',18)}</div>
      <div class="release-meta"><h3>v${esc(r.version)} ${r.channel === 'beta' ? '<span class="pill beta">beta</span>' : ''}</h3>
        <p>${esc(r.title || 'AnimePlex Android')} · ${shortDate(r.published_at || r.created_at)}</p>
        <div style="margin-top:8px">${pill(r.status)}</div>
      </div><div class="arrow">${icon('arrow',17)}</div>
    </button>`).join('')}</div>`;
}
function field(label, name, value, placeholder='', opts={}) {
  return `<div class="${opts.wide ? 'form-wide' : ''}"><label for="release-${name}" class="label">${esc(label)}</label>
    ${opts.area ? `<textarea id="release-${name}" class="field-area" name="${name}" placeholder="${esc(placeholder)}" ${opts.disabled ? 'disabled' : ''}>${esc(value ?? '')}</textarea>` :
    `<input id="release-${name}" class="field" type="${opts.type || 'text'}" name="${name}" value="${esc(value ?? '')}" placeholder="${esc(placeholder)}" ${opts.disabled ? 'disabled' : ''} ${opts.required ? 'required' : ''} ${opts.type === 'number' ? 'min="0" step="1"' : ''}>`}
    ${opts.hint ? `<div class="hint">${esc(opts.hint)}</div>` : ''}
  </div>`;
}
function editor() {
  const selected = selectedRelease();
  const row = state.draft ?? selected ?? initialRelease();
  const locked = selected?.status === 'published';
  const status = selected?.status ?? 'new';
  const warning = selected && validateRelease(row).error;
  const details = selected
    ? `<span>${pill(selected.status)} <span class="pill ${esc(selected.channel)}">${esc(selected.channel)}</span></span>`
    : '<span class="pill draft">New draft</span>';
  return `<section class="card">
    <div class="card-head"><div><h2>${selected ? 'Edit release · v' + esc(selected.version) : 'Create a new release'}</h2>
      <p>${locked ? 'Pause this release before editing fields.' : 'Saving a draft does not send any update to users.'}</p></div>${details}</div>
    <form id="release-form"><div class="card-body"><div class="form-grid">
      ${field('Version *','version',row.version,'2.3.7',{required:true,disabled:locked,hint:'Must be newer than the installed app version.'})}
      <div><label for="release-channel" class="label">Release channel *</label>
        <select id="release-channel" class="field-select" name="channel" ${locked ? 'disabled' : ''}>
          <option value="stable" ${row.channel === 'stable' ? 'selected' : ''}>Stable</option>
          <option value="beta" ${row.channel === 'beta' ? 'selected' : ''}>Beta · opt-in only</option>
        </select>
        <div class="hint">Only beta-enabled users receive beta releases.</div>
      </div>
      ${field('Release title','title',row.title,'Performance improvements',{disabled:locked,wide:true})}
      ${field('Signed APK direct download URL *','apk_url',row.apk_url,'https://github.com/.../releases/download/v2.3.7/AnimePlex.apk',
        {disabled:locked,wide:true,required:true,hint:'Use a DIRECT HTTPS URL ending in .apk to your SIGNED file. APKPure/store pages and unsigned GitHub Actions artifacts cannot install.'})}
      ${field('APK size (bytes)','apk_size',row.apk_size || 0,'0',{type:'number',disabled:locked,hint:'Enter the exact file size in bytes, not MB. Set 0 if unknown.'})}
      <div><div class="label">Required update</div>
        <div class="toggle-line" style="padding:11px 0;border:0"><div><div class="toggle-text">Mark as mandatory</div>
        <div class="toggle-help">App will not offer “Skip version” for this release.</div></div>
          <label class="switch"><input type="checkbox" name="mandatory" ${row.mandatory ? 'checked' : ''} ${locked ? 'disabled' : ''}><span></span></label>
        </div>
      </div>
      ${field("What's new / release notes",'release_notes',row.release_notes,'- Improved playback\\n- Fixed bugs',
        {wide:true,area:true,disabled:locked,hint:'Shown inside the AnimePlex update dialog. Markdown-friendly text.'})}
    </div></div>
    <div class="form-actions">
      ${!locked ? `<button type="submit" class="btn btn-primary" ${state.busy ? 'disabled' : ''}>${icon('save',16)} ${selected ? 'Save changes' : 'Save draft'}</button>` : ''}
      ${selected && selected.status !== 'published' ? `<button type="button" class="btn btn-outline" data-action="publish" ${state.busy ? 'disabled' : ''}>${icon('upload',16)} Publish update</button>` : ''}
      ${selected && selected.status === 'published' ? `<button type="button" class="btn btn-danger" data-action="pause" ${state.busy ? 'disabled' : ''}>${icon('pause',16)} Pause release</button>` : ''}
      ${selected && selected.status === 'draft' ? `<button type="button" class="btn btn-danger btn-sm" data-action="delete" ${state.busy ? 'disabled' : ''}>${icon('trash',15)} Delete draft</button>` : ''}
      <span class="form-note">${status === 'published' ? 'Live · visible to eligible users' : 'Not publicly announced unless published'}</span>
    </div></form>
    ${warning ? `<div style="padding:0 25px 16px"><div class="alert warning">${icon('alert',18)} <div><strong>APK configuration needs fixing:</strong> ${esc(warning)} Pause this release, then correct the APK URL and size before publishing again.</div></div></div>` : ''}
    <div style="padding:0 25px 24px"><div class="alert ${status === 'published' ? 'success' : 'warning'}">
      ${icon(status === 'published' ? 'check' : 'info',18)}
      <div>${status === 'published' ? 'This release is published. Pause it before changing the APK or notes.' :
        'Only pressing “Publish update” makes an eligible version available to the app. Save draft alone does not send updates.'}</div>
    </div></div>
  </section>`;
}
function releasePage() {
  return `${heading('Distribution','Release <span>management</span>','Draft versions privately, review update notes and publish to AnimePlex when you choose.',
    `<button class="btn btn-primary" data-action="new-release">${icon('plus',17)} New release</button>`)}
    <div class="dual-grid release-grid" style="grid-template-columns:minmax(250px,.7fr) minmax(0,1.3fr)">
      <div class="stack"><section class="card"><div class="card-head"><div><h2>All releases</h2><p>Draft, published and paused</p></div><span class="pill">${state.releases.length} total</span></div>${releaseList()}</section>
        <section class="card"><div class="card-head"><div><h2>Distribution status</h2></div><div class="card-body security-list">
          <div class="kpi-inline">${icon('shield',16)} Updates: <b>${config().enabled ? 'Enabled' : 'Paused globally'}</b></div>
          <div class="kpi-inline">${icon('refresh',16)} Auto-check: <b>${config().auto_check ? 'Enabled' : 'Manual only'}</b></div>
          <button class="btn btn-ghost btn-sm" data-page="settings">Change settings ${icon('arrow',14)}</button></div></section>
      </div><div class="stack">${editor()}
        <section class="card"><div class="card-head"><h2>In-app update preview</h2><span class="pill">Preview only</span></div><div class="card-body"><div id="live-preview">${preview(state.draft ?? selectedRelease())}</div></div></section>
      </div>
    </div>`;
}

function switchSetting(key, title, explanation, value) {
  return `<div class="toggle-line"><div><div class="toggle-text">${esc(title)}</div><div class="toggle-help">${esc(explanation)}</div></div>
  <label class="switch"><input type="checkbox" data-setting="${key}" ${value ? 'checked' : ''}><span></span></label></div>`;
}
function settingsPage() {
  const c=config(), active=published().length;
  return `${heading('Configuration','Update <span>settings</span>','Control release delivery and all the update-related links from one place.')}
    <div class="dual-grid"><div class="stack">
      <section class="card"><div class="card-head"><div><h2>Update delivery</h2><p>Changes take effect on the app's next check</p></div>${icon('sliders',20)}</div>
        <div class="card-body">
          ${switchSetting('enabled','Enable published updates','Master kill switch. OFF stops all update offers, including manually checked releases.',c.enabled)}
          ${switchSetting('auto_check','Check updates on app launch','Users see an update dialog on opening Home only when you have published a newer release.',c.auto_check)}
          ${switchSetting('beta_enabled','Allow beta channel','Beta opt-in users can receive releases you publish as beta.',c.beta_enabled)}
        </div>
      </section>
      <section class="card"><div class="card-head"><div><h2>Repository and download links</h2><p>These links belong to AnimePlex, not Zangetsu</p></div>${icon('out',20)}</div>
        <form id="repo-form" class="card-body stack">
          <div><label class="label" for="repo-url">GitHub repository URL</label>
            <input class="field" type="url" name="repository_url" id="repo-url" required value="${esc(c.repository_url)}" placeholder="https://github.com/Abhishekred/Animeplex-V1">
            <div class="hint">The About page's GitHub link uses this setting. Each release has its own APK URL.</div>
          </div>
          <button type="submit" class="btn btn-primary" style="justify-self:start">${icon('save',16)} Save repository URL</button>
        </form>
      </section>
    </div>
    <div class="stack">
      <section class="card"><div class="card-head"><div><h2>Live control status</h2><p>What the mobile client currently reads</p></div><span class="pill ${c.enabled ? 'published' : 'paused'}">${c.enabled ? 'ONLINE' : 'PAUSED'}</span></div>
      <div class="card-body stack">
        <div class="kpi-inline">${icon('cloud',15)} Public releases: <b>${active}</b></div>
        <div class="kpi-inline">${icon('globe',15)} Release metadata: <b>Supabase protected feed</b></div>
        <div class="kpi-inline">${icon('shield',15)} Control: <b>Owner / Admin / Release Manager only</b></div>
        <div class="divider"></div>
        <div class="alert">${icon('info',17)} Even with delivery ON, no update appears unless an admin explicitly publishes a higher version.</div>
      </div></section>
      <section class="card"><div class="card-head"><h2>Required APK properties</h2></div><div class="card-body security-list">
        <div class="security-row">${icon('check')} HTTPS public download, ideally a GitHub Release asset</div>
        <div class="security-row">${icon('check')} Must be SIGNED with the same signing key as installed builds</div>
        <div class="security-row">${icon('check')} Version must be greater than the version currently installed</div>
        <div class="security-row">${icon('check')} Draft releases stay private until published</div>
      </div></section>
    </div></div>`;
}
function render() {
  if (!supabase) {
    root.innerHTML = `<div class="auth"><div class="auth-layout"><div class="auth-brand">${brand()}</div><div class="auth-card"><h1 class="auth-title">Connect Supabase</h1><p class="auth-copy">Public VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required in Vercel environment settings. Never expose a service-role secret.</p></div></div></div>`;
  } else if (state.loading) {
    root.innerHTML = `<div class="auth"><div class="auth-layout"><div class="auth-brand">${brand()}</div><div class="auth-card"><div class="eyebrow">Checking your session</div><h1 class="auth-title">Opening workspace…</h1><p class="auth-copy">Verifying admin permissions.</p></div></div></div>`;
  } else if (!state.user || !state.member) {
    authView();
  } else {
    root.innerHTML = shell();
  }
}
async function loadRole(user) {
  const {data, error} = await supabase.from('admin_members')
    .select('role,is_active').eq('user_id',user.id).maybeSingle();
  if (error) throw error;
  return data?.is_active && hasWriteAccess(data.role) ? data : null;
}
async function loadData({quiet=false}={}) {
  if (!quiet) state.busy = true;
  try {
    const [settings, releases] = await Promise.all([
      supabase.from('animeplex_update_config').select('*').eq('id',true).maybeSingle(),
      supabase.from('animeplex_update_releases').select('*').order('created_at',{ascending:false}),
    ]);
    if (settings.error) throw settings.error;
    if (releases.error) throw releases.error;
    state.config = settings.data;
    state.releases = releases.data || [];
    state.error = '';
  } catch(e) {
    state.error = 'Could not read update control data: ' + errorMessage(e);
  } finally {
    state.busy = false;
    render();
  }
}
async function syncSession(user) {
  state.loading = true;
  render();
  try {
    state.user = user;
    state.member = user ? await loadRole(user) : null;
    state.loginError = '';
    if (state.member) await loadData();
    else if (user) state.loginError = 'This user is not an active release administrator.';
  } catch (e) {
    state.member = null;
    state.loginError = errorMessage(e);
  } finally { state.loading=false; render(); }
}
async function mutate(action) {
  if (state.busy) return;
  state.busy=true;
  try { await action(); await loadData({quiet:true}); }
  catch(e) { toast(errorMessage(e),true); }
  finally { state.busy=false; }
}
async function saveSettings(values,success) {
  await mutate(async()=>{
    const payload={...values,updated_at:new Date().toISOString()};
    const {error}=await supabase.from('animeplex_update_config').update(payload).eq('id',true);
    if(error) throw error;
    toast(success);
  });
}
async function saveDraft(form) {
  if (state.busy) return;
  const chosen = selectedRelease();
  if (chosen?.status === 'published') {toast('Pause the release before editing it.',true);return;}
  const f=new FormData(form);
  const input={
    version:f.get('version'),channel:f.get('channel'),title:f.get('title'),
    release_notes:f.get('release_notes'),apk_url:f.get('apk_url'),
    apk_size:f.get('apk_size'),mandatory:f.get('mandatory')==='on',
  };
  const checked=validateRelease(input);
  if(checked.error){toast(checked.error,true);return;}
  await mutate(async()=>{
    const request=chosen
      ? supabase.from('animeplex_update_releases').update({...checked.data,updated_at:new Date().toISOString()}).eq('id',chosen.id)
      : supabase.from('animeplex_update_releases').insert({...checked.data,status:'draft',created_by:state.user.id});
    const {data,error}=await request.select('id').single();
    if(error) throw error;
    state.selectedId=data.id;
    state.draft=null;
    toast(chosen?'Changes saved (not republished).':'Draft saved. Not sent to users.');
  });
}
function selectRelease(id) {
  state.selectedId=id;
  state.draft=null;
  state.page='releases';
  state.mobileOpen=false;
  render();
  window.scrollTo({top:0,behavior:'smooth'});
}
async function publishRelease() {
  const row=selectedRelease();
  if(!row) return;
  const checked=validateRelease(row);
  if(checked.error){toast(checked.error,true);return;}
  if(!window.confirm(`Publish v${row.version} (${row.channel}) to AnimePlex users? Ensure the HTTPS APK is SIGNED and installable. This action makes the update immediately eligible for display.`))return;
  await mutate(async()=>{
    const {error}=await supabase.from('animeplex_update_releases')
      .update({status:'published',published_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',row.id);
    if(error)throw error;
    toast(config().enabled?'Update published. Eligible users will see it on their next check.':'Published, but master delivery switch is OFF.');
  });
}
async function pauseRelease() {
  const row=selectedRelease();
  if(!row)return;
  if(!window.confirm(`Pause update v${row.version}? New checks will stop offering this release.`))return;
  await mutate(async()=>{
    const {error}=await supabase.from('animeplex_update_releases')
      .update({status:'paused',updated_at:new Date().toISOString()}).eq('id',row.id);
    if(error)throw error;
    toast('Release paused. Existing downloaded APKs are unaffected.');
  });
}
async function deleteDraft() {
  const row=selectedRelease();
  if(!row||row.status!=='draft')return;
  if(!window.confirm(`Delete draft v${row.version}?`))return;
  await mutate(async()=>{
    const {error}=await supabase.from('animeplex_update_releases').delete().eq('id',row.id);
    if(error)throw error;
    state.selectedId=null;state.draft=null;
    toast('Draft deleted.');
  });
}
async function login(form) {
  if(state.busy)return;
  state.busy=true;
  const f=new FormData(form);
  const {data,error}=await supabase.auth.signInWithPassword({
    email:String(f.get('email')||'').trim(),
    password:String(f.get('password')||''),
  });
  if(error){state.busy=false;state.loginError=errorMessage(error);render();return;}
  state.busy=false;
  await syncSession(data.user);
}
document.addEventListener('submit',async(e)=>{
  if(e.target.id==='login-form'){e.preventDefault();await login(e.target);}
  if(e.target.id==='release-form'){e.preventDefault();await saveDraft(e.target);}
  if(e.target.id==='repo-form'){
    e.preventDefault();
    const url=String(new FormData(e.target).get('repository_url')||'').trim();
    if(!isHttpsUrl(url)){toast('Repository URL must be HTTPS.',true);return;}
    await saveSettings({repository_url:url},'Repository link saved.');
  }
});
document.addEventListener('change',async(e)=>{
  const key=e.target?.dataset?.setting;
  if(!key||!['enabled','auto_check','beta_enabled'].includes(key))return;
  const value=e.target.checked;
  await saveSettings({[key]:value},key==='enabled'?(value?'Update delivery enabled.':'All update offers paused.'):'Update setting saved.');
});
document.addEventListener('click',async(e)=>{
  const page=e.target.closest('[data-page]')?.dataset.page;
  if(page&&['overview','releases','settings'].includes(page)){
    state.page=page;state.mobileOpen=false;state.error='';render();window.scrollTo(0,0);return;
  }
  const btn=e.target.closest('[data-action]');
  if(!btn)return;
  const action=btn.dataset.action;
  if(action==='menu'){state.mobileOpen=true;render();}
  if(action==='close-menu'){state.mobileOpen=false;render();}
  if(action==='new-release'){state.page='releases';state.selectedId=null;state.draft=initialRelease();state.mobileOpen=false;render();window.scrollTo(0,0);}
  if(action==='select-release')selectRelease(btn.dataset.id);
  if(action==='publish')await publishRelease();
  if(action==='pause')await pauseRelease();
  if(action==='delete')await deleteDraft();
  if(action==='logout'){
    await supabase.auth.signOut();
    state.user=null;state.member=null;state.releases=[];state.page='overview';state.loginError='';render();
  }
});
document.addEventListener('input',(e)=>{
  if(!e.target.closest('#release-form'))return;
  const form=e.target.closest('form');
  const f=new FormData(form);
  const val={version:f.get('version'),channel:f.get('channel'),release_notes:f.get('release_notes')};
  const el=document.getElementById('live-preview');
  if(el)el.innerHTML=preview(val);
});

async function initialize() {
  if(!supabase){state.loading=false;render();return;}
  try {
    const {data,error}=await supabase.auth.getSession();
    if(error)throw error;
    if(data.session?.user){await syncSession(data.session.user);}
  } catch(e){state.loginError=errorMessage(e);}
  state.loading=false;render();
  // Auth callbacks run outside the auth-client lock to avoid reentrant requests.
  supabase.auth.onAuthStateChange((event,session)=>{
    if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event)){
      window.setTimeout(()=>{if(session?.user?.id!==state.user?.id)syncSession(session?.user??null);},0);
    }
  });
}
initialize();
