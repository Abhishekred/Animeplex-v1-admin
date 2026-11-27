import { curatedPage, loadCurated, searchCurated, publishCurated, handleCuratedAction } from './curated_catalogue.js';

import './style.css';
import './glass.css';
import './control_manager.css';
import './admin_management.css';
import { canManageUsers, usersPage, providersPage, loadAdminUsers, openAdminUser,
  loadAdminProviders, saveAdminProvider, changeAdminProvider, removeAdminProvider,
  setAdminUserSourcesAccess, updateAdminUser, deleteAdminUser,
  setAdminUserProvider, setAdminUserBan }
  from './admin_management.js';
import { multiProvidersPage, loadProviderRepositories, addProviderRepository, openProviderCatalogue,
  saveProviderSelection, removeProviderRepository, visibleProviderSources, PROVIDER_TYPES } from './provider_management.js';
import { PLAYER_CONTROLS, PLAYER_SLOTS, REGION_CODES, REGION_NAMES,
  DEFAULT_PLAYER_LAYOUT, cleanPlayerLayout, hiddenPlayerControls,
  movePlayerControl, reorderPlayerControl } from './control_manager.js';
import { createClient } from '@supabase/supabase-js';
import { escapeHtml as esc, isHttpsUrl, validateRelease, shortDate, compareVersions, validUploadParts, APK_CHUNK_BYTES, APK_MAX_BYTES, APK_BUCKET, linkMbToBytes, linkBytesToMb, validateAboutSettings, normalizeInstagramHandle } from './utils.js';

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
  delivery_method: 'upload', apk_url: '', apk_parts: [], apk_size: 0, mandatory: false, status: 'draft',
});
const state = {
  user: null, member: null, config: null, releases: [], page: 'overview',
  selectedId: null, draft: null, loading: true, busy: false,
  playerDraft: null, playerDirty: false, playerAllowCustom: true,
  regionDraft: null, regionDirty: false,
  error: '', loginError: '', mobileOpen: false,
  userRows: [], userSearch:'', userOffset:0, userCount:0, userDetail:null,
  managedProviders:[], editProviderId:null, providerRepositories:[],
  activeProviderRepoId:null, providerCatalog:[], providerSelection:new Set(),
  providerCatalogQuery:'', providerCatalogPage:0, providerDraftKind:'cloudstream',
};
const iconShapes = {
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 4"/>',
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
  gauge:'<path d="M5 18a9 9 0 1 1 14 0M12 14l4-5"/><circle cx="12" cy="15" r="2"/>',
  subtitles:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6 12h5m-5 3h7m1-3h4m-3 3h3"/>',
  monitor:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 13h8"/>',
  layers:'<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5"/>',
  film:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16m10-16v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/>',
  maximize:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  'rotate-cw':'<path d="M21 9V3h-6M21 3a9 9 0 1 0 1 12"/>',
  cast:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 17a4 4 0 0 1 4 4M3 12a9 9 0 0 1 9 9"/>',
  cpu:'<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 1v5m6-5v5m-6 12v5m6-5v5M1 9h5M1 15h5m12-6h5m-5 6h5"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 2-2 2 2 0 0 0-1-2 2 2 0 0 1 1-3 5 5 0 0 0 5-5 9 9 0 0 0-9-6Z"/><circle cx="7" cy="12" r="1"/><circle cx="9" cy="7" r="1"/><circle cx="14" cy="7" r="1"/>',
  camera:'<path d="M3 7h4l2-3h6l2 3h4v13H3V7Z"/><circle cx="12" cy="13" r="4"/>',
  moon:'<path d="M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11Z"/>',
  'picture-in-picture':'<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="12" y="12" width="7" height="6" rx="1"/>',
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
      <div class="nav-list">
        ${nav('Player controls','controls','sliders')}
        ${nav('Streaming region','region','globe')}
        ${nav('About page','about','globe')}
        ${nav('Update settings','settings','sliders')}
        ${canManageUsers(state.member?.role) ? nav('Users','users','users') + nav('Provider sources','providers','layers') + nav('Catalogue','catalogue','grid') : ''}
      </div>
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
      <div class="breadcrumb"><span>AnimePlex</span> ${icon('arrow',13)} <strong>${state.page === 'overview' ? 'Overview' : state.page === 'releases' ? 'Releases' : state.page === 'controls' ? 'Player controls' : state.page === 'region' ? 'Streaming region' : state.page === 'about' ? 'About page' : state.page === 'catalogue' ? 'Catalogue' : state.page === 'users' ? 'Users' : state.page === 'providers' ? 'Provider sources' : 'Update settings'}</strong></div>
      <div class="bar-actions"><span class="bar-time">${esc(new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}))}</span>
        <div class="bar-chip">${icon('shield',15)} Secure workspace</div>
      </div></div>
      <div class="content">
        ${state.error ? `<div class="alert warning" style="margin-bottom:22px">${icon('alert',19)} ${esc(state.error)}</div>` : ''}
        ${state.page === 'overview' ? overview() : state.page === 'releases' ? releasePage() : state.page === 'controls' ? controlsPage() : state.page === 'region' ? regionPage() : state.page === 'about' ? aboutPage() : state.page === 'catalogue' ? curatedPage(state) : state.page === 'users' ? usersPage(state) : state.page === 'providers' ? multiProvidersPage(state) : settingsPage()}
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
        <p>${esc(r.title || 'AnimePlex Android')} · ${r.delivery_method === 'upload' ? 'Uploaded APK' : 'Direct link'} · ${shortDate(r.published_at || r.created_at)}</p>
        <div style="margin-top:8px">${pill(r.status)}</div>
      </div><div class="arrow">${icon('arrow',17)}</div>
    </button>`).join('')}</div>`;
}
function field(label, name, value, placeholder='', opts={}) {
  return `<div class="${opts.wide ? 'form-wide' : ''}"><label for="release-${name}" class="label">${esc(label)}</label>
    ${opts.area ? `<textarea id="release-${name}" class="field-area" name="${name}" placeholder="${esc(placeholder)}" ${opts.disabled ? 'disabled' : ''}>${esc(value ?? '')}</textarea>` :
    `<input id="release-${name}" class="field" type="${opts.type || 'text'}" name="${name}" value="${esc(value ?? '')}" placeholder="${esc(placeholder)}" ${opts.disabled ? 'disabled' : ''} ${opts.required ? 'required' : ''} ${opts.type === 'number' ? 'min="0" step="' + (opts.step ?? '1') + '"' : ''}>`}
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
      <div class="form-wide">
        <span class="label">Choose APK source</span>
        <div class="apk-method-switch" role="group" aria-label="APK source">
          <label class="apk-method-option"><input type="radio" name="delivery_method" value="upload" ${(row.delivery_method ?? 'link') === 'upload' ? 'checked' : ''} ${locked ? 'disabled' : ''}><span>${icon('upload',18)} Upload APK</span></label>
          <label class="apk-method-option"><input type="radio" name="delivery_method" value="link" ${(row.delivery_method ?? 'link') === 'link' ? 'checked' : ''} ${locked ? 'disabled' : ''}><span>${icon('out',18)} Paste APK link</span></label>
        </div>
      </div>
      <div class="form-wide apk-source-section" data-apk-source="upload" ${(row.delivery_method ?? 'link') === 'upload' ? '' : 'hidden'}>
        <label class="label" for="release-apk-file">Signed AnimePlex APK file</label>
        <div class="apk-dropzone">
          ${icon('upload',25)}
          <div><strong>Select .apk from your device</strong><p>Phone or PC · Secure Supabase Storage · 32 MB upload parts for large files</p></div>
          <input id="release-apk-file" class="apk-file-input" type="file" accept=".apk,application/vnd.android.package-archive" ${locked ? 'disabled' : ''}>
        </div>
        ${row.delivery_method === 'upload' && validUploadParts(row.apk_parts,Number(row.apk_size)) ?
          `<div class="alert success" style="margin-top:12px">${icon('check',16)} APK uploaded · ${Math.round(row.apk_size/1048576)} MB · ${row.apk_parts.length} stored parts</div>` : ''}
        <div id="upload-status" class="upload-status" aria-live="polite" role="status"></div>
        <div class="hint">First Save Draft uploads the signed APK and stores the download parts. Publish separately. Maximum 800 MB. No GitHub upload needed.</div>
      </div>
      <div class="form-wide apk-source-section" data-apk-source="link" ${(row.delivery_method ?? 'link') === 'link' ? '' : 'hidden'}>
        ${field('Direct signed APK download URL *','apk_url',row.apk_url,
          'https://files.example.com/download?id=AnimePlex-v2.3.8',
          {disabled:locked,required:(row.delivery_method ?? 'link') === 'link',
           hint:'HTTPS download links and redirects supported (even without .apk in URL). The link must return the actual signed AnimePlex APK without login or browser cookies.'})}
        <div style="margin-top:17px">${field('APK size (MB)','apk_size_mb',linkBytesToMb(row.delivery_method === 'upload' ? 0 : row.apk_size || 0),'0',
          {type:'number',step:'0.01',disabled:locked,hint:'Enter size in MB (e.g. 24 or 24.5). Optional: 0 if unknown. Uploaded APK sizes are automatic.'})}</div>
      </div>
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


function aboutPage() {
  const c = config();
  const website = String(c.about_website_url || 'https://Abhishek.dpdns.org/');
  const handle = String(c.about_instagram_handle || 'animeplexofficial').replace(/^@/, '');
  const siteLabel = website.startsWith('https://') ? website.slice(8) : website;
  return `${heading('Remote configuration','About <span>page</span>',
    'Edit the website URL and Instagram handle displayed in AnimePlex About → Social.')}
    <div class="dual-grid">
      <section class="card">
        <div class="card-head"><div><h2>Social links</h2><p>Admin-only editing through protected Supabase settings</p></div>${icon('edit',20)}</div>
        <form id="about-form" class="card-body stack">
          <div>
            <label class="label" for="about-website">Website URL</label>
            <input class="field" id="about-website" name="about_website_url" type="url" required
              maxlength="512" value="${esc(website)}" placeholder="https://Abhishek.dpdns.org/" autocomplete="url">
            <div class="hint">Include https:// — this will become the displayed website and destination link.</div>
          </div>
          <div>
            <label class="label" for="about-instagram">Instagram handle</label>
            <input class="field" id="about-instagram" name="about_instagram_handle" type="text" required
              maxlength="31" value="${esc(handle)}" placeholder="@animeplexofficial"
              autocapitalize="off" spellcheck="false" autocomplete="off">
            <div class="hint">Use @username or username; the profile URL is generated from this handle.</div>
          </div>
          <div class="alert">${icon('info',17)} Changes save to Supabase. Current test2 APK uses hardcoded social links, so app-side sync is still needed before changes appear on devices.</div>
          <button type="submit" class="btn btn-primary" style="justify-self:start" ${state.busy?'disabled':''}>${icon('save',16)} Save About settings</button>
        </form>
      </section>
      <section class="card">
        <div class="card-head"><div><h2>About page preview</h2><p>How the two social entries will look</p></div><span class="pill">Preview only</span></div>
        <div class="card-body">
          <div class="about-phone">
            <div class="about-phone-brand">AnimePlex<span>About</span></div>
            <div class="about-preview-label">SOCIAL</div>
            <div class="about-preview-row">${icon('globe',20)}<div><strong>Website</strong><small id="about-preview-website">${esc(siteLabel)}</small></div></div>
            <div class="about-preview-row">${icon('camera',20)}<div><strong>Instagram</strong><small id="about-preview-instagram">@${esc(handle)}</small></div></div>
          </div>
          <div class="hint">Preview is local to the admin editor, not the installed app.</div>
        </div>
      </section>
    </div>`;
}

const controlByName = Object.fromEntries(PLAYER_CONTROLS.map(v=>[v.id,v]));
const laneNames={top:'TOP BAR',left:'LEFT SIDE',right:'RIGHT SIDE',hidden:'HIDDEN'};
function playerDraft() {
  if (!state.playerDraft) state.playerDraft=cleanPlayerLayout(config().player_controls ?? DEFAULT_PLAYER_LAYOUT);
  return state.playerDraft;
}
function controlPreview() {
  const layout=playerDraft();
  const buttons=(ids)=>ids.map(id=> {
    const entry=controlByName[id];
    return entry? `<span class="control-stage-button" title="${esc(entry.label)}">${icon(entry.icon,19)}</span>`:'';
  }).join('');
  return `<div class="control-stage" aria-label="Player layout preview">
    <div class="control-top"><span class="control-stage-button fixed">${icon('arrow',17)}</span>
    <span class="control-stage-title">Show title · E2</span>${buttons(layout.top)}
    <span class="control-stage-button fixed">${icon('lock',19)}</span>
    <span class="control-stage-button fixed">${icon('sliders',19)}</span></div>
    <div class="control-rail left">${buttons(layout.left)}</div>
    <div class="control-rail right">${buttons(layout.right)}</div>
  </div>`;
}
function controlLane(slot) {
  const layout=playerDraft();
  const ids=slot==='hidden'?hiddenPlayerControls(layout):layout[slot];
  return `<section class="control-lane" data-control-lane="${slot}">
    <h3>${esc(laneNames[slot])}${slot==='top'?' · '+ids.length+'/5':''}</h3>
    ${ids.length?ids.map((id,index)=>{
      const c=controlByName[id], options=PLAYER_SLOTS
        .filter(target=>target===slot||!(c.pinned&&target==='hidden'))
        .map(target=>`<option value="${target}" ${target===slot?'selected':''}>${esc(laneNames[target])}</option>`).join('');
      return `<div class="control-row" draggable="true" data-control-id="${esc(id)}">
        <span style="cursor:grab" title="Drag to arrange">⋮⋮</span>
        <span class="control-row-label">${icon(c.icon,18)} <span title="${esc(c.label)}">${esc(c.label)}${c.pinned?' · Pinned':''}</span></span>
        <button class="control-mini" data-action="control-up" data-id="${esc(id)}" ${slot==='hidden'||index===0?'disabled':''} title="Move up">↑</button>
        <button class="control-mini" data-action="control-down" data-id="${esc(id)}" ${slot==='hidden'||index===ids.length-1?'disabled':''} title="Move down">↓</button>
        <select class="control-select" data-control-place="${esc(id)}" aria-label="Move ${esc(c.label)}">${options}</select>
      </div>`;
    }).join(''):'<div class="control-empty">Drop buttons here, or use the Move selector</div>'}
  </section>`;
}
function controlsPage() {
  const c=config(),layout=playerDraft();
  return `${heading('Remote configuration','Player <span>controls</span>',
    'Manage the real Android player layout. Preview changes before publishing to the app.')}
    <div class="manager-grid">
      <div class="stack">
        <section class="card">
          <div class="card-head"><div><h2>Live player preview</h2><p>Updates immediately while you arrange buttons</p></div>
          <span class="pill ${c.player_controls_enabled?'published':'paused'}">${c.player_controls_enabled?'Published':'Not active'}</span></div>
          <div class="card-body stack">
            ${controlPreview()}
            <div class="manager-note">Back, Lock and Settings are fixed safety controls. Top bar holds a maximum of 5 movable controls. Hidden controls remain reachable through More. Engine-specific actions only appear when supported by the selected player.</div>
            ${switchSetting('allow_player_customization','Let users customize controls','ON preserves each viewer’s personal layout. OFF enforces this admin layout for everyone.',state.playerAllowCustom)}
            ${state.playerDirty?'<div class="alert warning">Unpublished changes. Users still see the last published layout.</div>':''}
            <div class="manager-actions">
              <button class="btn btn-primary" data-action="publish-player-controls">${icon('save',16)} Publish player controls</button>
              <button class="btn btn-ghost" data-action="reset-player-draft">${icon('refresh',15)} Undo edits</button>
              <button class="btn btn-ghost" data-action="restore-player-defaults">Restore app defaults</button>
              ${c.player_controls_enabled?'<button class="btn btn-ghost" data-action="disable-player-controls">Disable admin override</button>':''}
            </div>
          </div>
        </section>
      </div>
      <div class="control-lanes">
        ${PLAYER_SLOTS.map(controlLane).join('')}
      </div>
    </div>`;
}
function regionPage() {
  const c=config(), r=state.regionDraft || {
    streaming_region:c.streaming_region || 'IN',
    allow_region_customization:c.allow_region_customization!==false,
  };
  state.regionDraft=r;
  return `${heading('Remote configuration','Streaming <span>region</span>',
    'Choose the TMDB watch-region catalogue seen in AnimePlex. This does not change device language, VPN or stream geoblocks.')}
    <div class="dual-grid">
      <div class="stack">
        <section class="card">
          <div class="card-head"><div><h2>Country catalogue</h2><p>One region, synced across your audience</p></div>${icon('globe',22)}</div>
          <div class="card-body stack">
            <div><label for="admin-streaming-region" class="label">Select streaming region</label>
            <select class="field region-select" id="admin-streaming-region">
              ${REGION_CODES.map(code=>`<option value="${code}" ${r.streaming_region===code?'selected':''}>${code} · ${esc(REGION_NAMES[code])}</option>`).join('')}
            </select></div>
            ${switchSetting('allow_region_customization','Let viewers change their region',
              'ON uses this as a default if they have not chosen one. OFF locks this region for every device.',r.allow_region_customization)}
            ${state.regionDirty?'<div class="alert warning">Region changes are not published yet.</div>':''}
            <div class="manager-actions">
              <button class="btn btn-primary" data-action="publish-region">${icon('save',16)} Publish region</button>
              ${c.streaming_region_enabled?'<button class="btn btn-ghost" data-action="disable-region">Disable region override</button>':''}
            </div>
          </div>
        </section>
      </div>
      <div class="stack">
        <section class="card">
          <div class="card-head"><div><h2>Live distribution status</h2></div><span class="pill ${c.streaming_region_enabled?'published':'paused'}">${c.streaming_region_enabled?'Active':'Inactive'}</span></div>
          <div class="card-body stack">
            <div class="kpi-inline">${icon('globe',17)} Currently published region: <b>${esc(c.streaming_region || 'IN')}</b></div>
            <div class="kpi-inline">${icon('lock',17)} User override: <b>${c.allow_region_customization===false?'Locked':'Allowed'}</b></div>
            <div class="alert">${icon('info',16)} Once published, the connected APK reads this setting anonymously from Supabase. Offline devices keep their last synced region.</div>
          </div>
        </section>
      </div>
    </div>`;
}
function updateControlDraft(next) {
  state.playerDraft=cleanPlayerLayout(next);
  state.playerDirty=true;
  render();
}
async function publishAdminControls() {
  if(state.busy)return;
  if(!window.confirm('Publish this player layout to connected AnimePlex apps?'))return;
  await mutate(async()=>{
    const {error}=await supabase.from('animeplex_update_config')
      .update({player_controls:cleanPlayerLayout(playerDraft()),
        player_controls_enabled:true,
        allow_player_customization:state.playerAllowCustom,
        updated_at:new Date().toISOString()}).eq('id',true);
    if(error)throw error;
    state.playerDirty=false;
    toast('Player layout published. The app syncs it on launch/foreground.');
  });
}
async function publishAdminRegion() {
  if(state.busy)return;
  const draft=state.regionDraft;
  if(!draft||!REGION_CODES.includes(draft.streaming_region))return toast('Choose a valid region.',true);
  if(!window.confirm(`Publish ${draft.streaming_region} streaming region to AnimePlex?`))return;
  await mutate(async()=>{
    const {error}=await supabase.from('animeplex_update_config')
      .update({streaming_region:draft.streaming_region,
        allow_region_customization:draft.allow_region_customization,
        streaming_region_enabled:true,updated_at:new Date().toISOString()}).eq('id',true);
    if(error)throw error;
    state.regionDirty=false;
    toast('Streaming region published.');
  });
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
    if(!state.playerDirty || !state.playerDraft){
      state.playerDraft=cleanPlayerLayout(state.config?.player_controls ?? DEFAULT_PLAYER_LAYOUT);
      state.playerAllowCustom=state.config?.allow_player_customization!==false;
    }
    if(!state.regionDirty || !state.regionDraft){
      state.regionDraft={streaming_region:state.config?.streaming_region || 'IN',
        allow_region_customization:state.config?.allow_region_customization!==false};
    }
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
/** Upload without proxying the APK through Vercel's small request-body limit.
 *  Each part stays under the Supabase Free plan's per-file limit. */
async function uploadApkChunks(file) {
  if (!file || !file.name.toLowerCase().endsWith('.apk')) {
    throw new Error('Select a .apk file from your device.');
  }
  if (file.size < 1000000 || file.size > APK_MAX_BYTES) {
    throw new Error('Select an APK between 1 MB and 800 MB.');
  }
  const bytes = new Uint8Array(await file.slice(0,4).arrayBuffer());
  if (bytes.length !== 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b ||
      bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    throw new Error('This file does not have a valid APK/ZIP header.');
  }
  const folder = `releases/${state.user.id}/${crypto.randomUUID()}`;
  const parts = [], paths = [];
  const count = Math.ceil(file.size / APK_CHUNK_BYTES);
  const status = document.getElementById('upload-status');
  const setStatus = (message) => {if(status)status.textContent=message;};
  try {
    for (let i = 0; i < count; i++) {
      const begin = i * APK_CHUNK_BYTES;
      const chunk = file.slice(begin, Math.min(begin+APK_CHUNK_BYTES,file.size));
      const path = `${folder}/part-${String(i+1).padStart(3,'0')}.bin`;
      setStatus(`Uploading part ${i+1} of ${count} · ${Math.round(begin/file.size*100)}% completed`);
      const {error} = await supabase.storage.from(APK_BUCKET).upload(path,chunk,{
        contentType:'application/octet-stream',cacheControl:'31536000',upsert:false,
      });
      if(error) throw error;
      paths.push(path);
      parts.push({path,size:chunk.size});
      setStatus(`Uploaded ${i+1}/${count} parts · ${Math.round((begin+chunk.size)/file.size*100)}%`);
    }
    return parts;
  } catch(error) {
    if(paths.length) await supabase.storage.from(APK_BUCKET).remove(paths);
    throw error;
  }
}
async function saveDraft(form) {
  if (state.busy) return;
  const chosen = selectedRelease();
  if (chosen?.status === 'published') {
    toast('Pause the release before editing it.',true);return;
  }
  const f = new FormData(form);
  const method = f.get('delivery_method') || chosen?.delivery_method || 'link';
  const file = form.querySelector('#release-apk-file')?.files?.[0] || null;
  const input = {
    version:f.get('version'),channel:f.get('channel'),title:f.get('title'),
    release_notes:f.get('release_notes'),apk_url:f.get('apk_url'),
    apk_size:method==='link' ? linkMbToBytes(f.get('apk_size_mb')) : 0,
    mandatory:f.get('mandatory')==='on',
    delivery_method:method,apk_parts:[],
  };
  if (method === 'upload' && !file && chosen?.delivery_method === 'upload') {
    input.apk_parts=chosen.apk_parts;
    input.apk_size=chosen.apk_size;
  }
  if (method === 'upload' && file) {
    // Validate version and other fields before uploading large APK bytes.
    const version=String(input.version??'').trim();
    if(!/^v?\d+(\.\d+){1,3}(-[a-zA-Z0-9.-]+)?$/.test(version)) {
      toast('Enter a valid version before uploading.',true);return;
    }
  } else {
    const checked=validateRelease(input);
    if(checked.error){toast(checked.error,true);return;}
  }
  await mutate(async()=>{
    let uploadedParts=[];
    try {
      if(method === 'upload' && file) {
        uploadedParts=await uploadApkChunks(file);
        input.apk_parts=uploadedParts;
        input.apk_size=file.size;
        input.apk_url=null;
      }
      const checked=validateRelease(input);
      if(checked.error)throw new Error(checked.error);
      const request=chosen
        ? supabase.from('animeplex_update_releases')
          .update({...checked.data,updated_at:new Date().toISOString()}).eq('id',chosen.id)
        : supabase.from('animeplex_update_releases')
          .insert({...checked.data,status:'draft',created_by:state.user.id});
      const {data,error}=await request.select('id').single();
      if(error)throw error;
      state.selectedId=data.id;
      state.draft=null;
      toast(method==='upload'?'APK uploaded, release draft saved. Publish when ready.':
        chosen?'Changes saved (not republished).':'Draft saved. Not sent to users.');
    } catch(error) {
      if(uploadedParts.length) {
        await supabase.storage.from(APK_BUCKET).remove(uploadedParts.map(p=>p.path));
      }
      throw error;
    }
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
  if(['curated-search','curated-publish'].includes(e.target.id)){
    e.preventDefault();
    if(state.busy || !canManageUsers(state.member?.role))return;
    state.busy=true;
    try {
      const form=new FormData(e.target);
      if(e.target.id==='curated-search') await searchCurated(state,form);
      else {await publishCurated(supabase,state,form);toast('Catalogue title published.');}
    } catch(error){toast(errorMessage(error),true);}
    finally {state.busy=false;render();}
    return;
  }
  if(e.target.id==='login-form'){e.preventDefault();await login(e.target);}
  if(e.target.id==='release-form'){e.preventDefault();await saveDraft(e.target);}
  if(e.target.id==='admin-user-search'){
    e.preventDefault();
    try { await loadAdminUsers(supabase,state,new FormData(e.target).get('query')||'',0); render(); }
    catch(error){toast(errorMessage(error),true);}
  }
  if(e.target.id==='admin-user-provider'){
    e.preventDefault();
    try{
      const form=new FormData(e.target);
      const id=e.target.dataset.id;
      const sourceId=String(form.get('source_id')||'');
      await setAdminUserProvider(supabase,state,id,{
        sourceId,locked:form.has('provider_locked'),
      });
      toast('Provider control saved for this account.');
      render();
    }catch(error){toast(errorMessage(error),true);}
    return;
  }
  if(e.target.id==='admin-user-ban'){
    e.preventDefault();
    try{
      const id=e.target.dataset.id;
      const reason=String(new FormData(e.target).get('reason')||'').trim();
      if(!window.confirm('Ban this account? The user will be blocked from signing in.'))return;
      await setAdminUserBan(supabase,state,id,true,reason);
      toast('User account banned.');
      render();
    }catch(error){toast(errorMessage(error),true);}
    return;
  }
  if(e.target.id==='admin-user-edit'){
    e.preventDefault();
    try {
      const id=e.target.dataset.id;
      await updateAdminUser(supabase,state,id,Object.fromEntries(new FormData(e.target)));
      toast('User details saved.');
      render();
    } catch(error){toast(errorMessage(error),true);}
    return;
  }
  if(e.target.id==='admin-repository-form'){
    e.preventDefault();
    try{
      const form=Object.fromEntries(new FormData(e.target));
      state.providerDraftKind=String(form.kind||'cloudstream');
      const total=await addProviderRepository(supabase,state,form);
      toast(total+' available sources found. Select the ones to install.');
      render();
    }catch(error){toast(errorMessage(error),true);}
    return;
  }
  if(e.target.id==='provider-catalog-filter'){
    e.preventDefault();
    state.providerCatalogQuery=String(new FormData(e.target).get('query')||'');
    state.providerCatalogPage=0;
    render();
    return;
  }
  if(e.target.id==='admin-provider-form'){
    e.preventDefault();
    const f = new FormData(e.target);
    const data = Object.fromEntries(f);
    data.enabled=f.has('enabled'); data.auto_install=f.has('auto_install'); data.is_default=f.has('is_default');
    try { await saveAdminProvider(supabase,state,data,state.editProviderId); toast('Provider configuration saved.'); render(); }
    catch(error){toast(errorMessage(error),true);}
  }
  if(e.target.id==='repo-form'){
    e.preventDefault();
    const url=String(new FormData(e.target).get('repository_url')||'').trim();
    if(!isHttpsUrl(url)){toast('Repository URL must be HTTPS.',true);return;}
    await saveSettings({repository_url:url},'Repository link saved.');
  }
  if(e.target.id==='about-form'){
    e.preventDefault();
    const checked=validateAboutSettings(Object.fromEntries(new FormData(e.target)));
    if(checked.error){toast(checked.error,true);return;}
    await saveSettings(checked.data,'About social links saved.');
  }
});
document.addEventListener('input',(e)=>{
  const form=e.target.closest('#about-form');
  if(!form)return;
  const site=String(form.elements.namedItem('about_website_url')?.value ?? '').trim();
  const rawHandle=form.elements.namedItem('about_instagram_handle')?.value ?? '';
  const siteLabel=site.startsWith('https://') ? site.slice(8) : site;
  const sitePreview=document.getElementById('about-preview-website');
  const instagramPreview=document.getElementById('about-preview-instagram');
  if(sitePreview)sitePreview.textContent=siteLabel;
  if(instagramPreview)instagramPreview.textContent='@'+(normalizeInstagramHandle(rawHandle) || String(rawHandle).trim().replace(/^@/,''));
});
document.addEventListener('change',async(e)=>{
  if(e.target?.id==='provider-kind'){
    state.providerDraftKind=e.target.value;
    const hint=document.getElementById('provider-format-hint');
    if(hint)hint.textContent=PROVIDER_TYPES.find(x=>x[0]===e.target.value)?.[2]||'';
    return;
  }
  if(e.target?.matches?.('[data-provider-source-id]')){
    const id=e.target.dataset.providerSourceId;
    if(e.target.checked)state.providerSelection.add(id);
    else state.providerSelection.delete(id);
    const counter=document.getElementById('provider-selected-count');
    if(counter)counter.textContent=state.providerSelection.size.toLocaleString('en-IN');
    return;
  }
  if (e.target?.name === 'delivery_method') {
    const method=e.target.value;
    document.querySelectorAll('[data-apk-source]').forEach(section=>{
      section.hidden=section.dataset.apkSource !== method;
    });
    const input=document.querySelector('#release-apk_url');
    if(input)input.required=method==='link';
    return;
  }
  if (e.target?.id === 'release-apk-file') {
    const file=e.target.files?.[0];
    const status=document.getElementById('upload-status');
    if(status)status.textContent=file
      ? `${file.name} · ${(file.size/1048576).toFixed(1)} MB selected. Press Save draft to upload.`
      : '';
    return;
  }
  if(e.target?.dataset?.controlPlace){
    updateControlDraft(movePlayerControl(playerDraft(),e.target.dataset.controlPlace,e.target.value));
    return;
  }
  if(e.target?.id==='admin-streaming-region'){
    state.regionDraft.streaming_region=e.target.value;state.regionDirty=true;render();return;
  }
  const key=e.target?.dataset?.setting;
  if(key==='allow_player_customization'){
    state.playerAllowCustom=e.target.checked;state.playerDirty=true;render();return;
  }
  if(key==='allow_region_customization'){
    state.regionDraft.allow_region_customization=e.target.checked;state.regionDirty=true;render();return;
  }
  if(!key||!['enabled','auto_check','beta_enabled'].includes(key))return;
  const value=e.target.checked;
  await saveSettings({[key]:value},key==='enabled'?(value?'Update delivery enabled.':'All update offers paused.'):'Update setting saved.');
});
document.addEventListener('click',async(e)=>{
  const catalogue=e.target.closest('[data-curated]');
  if(catalogue && canManageUsers(state.member?.role)){
    if(state.busy)return;
    state.busy=true;
    try {await handleCuratedAction(catalogue.dataset.curated,catalogue.dataset.id,supabase,state);}
    catch(error){toast(errorMessage(error),true);}
    finally {state.busy=false;render();}
    return;
  }
  const page=e.target.closest('[data-page]')?.dataset.page;
  if(page&&['overview','releases','settings','controls','region','about','users','providers','catalogue'].includes(page)){
    if (['users','providers','catalogue'].includes(page) && !canManageUsers(state.member?.role)) {
      toast('Owner/admin permission required.',true);return;
    }
    state.page=page;state.mobileOpen=false;state.error='';render();window.scrollTo(0,0);
    try {
      if(page==='catalogue') await loadCurated(supabase,state);
      if(page==='users') await loadAdminUsers(supabase,state,state.userSearch,state.userOffset);
      if(page==='providers') await loadProviderRepositories(supabase,state);
      render();
    } catch(error){state.error=errorMessage(error);render();}
    return;
  }
  const btn=e.target.closest('[data-action]');
  if(!btn)return;
  const action=btn.dataset.action;
  if(['view-user','edit-user','user-back','user-prev','user-next','refresh-users'].includes(action)){
    try {
      if(action==='view-user'||action==='edit-user') await openAdminUser(supabase,state,btn.dataset.id);
      if(action==='user-back')state.userDetail=null;
      if(action==='user-prev')await loadAdminUsers(supabase,state,state.userSearch,Math.max(0,state.userOffset-25));
      if(action==='user-next')await loadAdminUsers(supabase,state,state.userSearch,state.userOffset+25);
      if(action==='refresh-users')await loadAdminUsers(supabase,state,state.userSearch,state.userOffset);
      render();
      if(action==='edit-user') document.getElementById('edit-user-name')?.focus();
    } catch(error){toast(errorMessage(error),true);}
    return;
  }
  if(action==='unban-user'){
    try{
      const id=btn.dataset.id;
      if(!window.confirm('Unban this account and allow sign-in again?'))return;
      await setAdminUserBan(supabase,state,id,false);
      toast('User account unbanned.');
      render();
    }catch(error){toast(errorMessage(error),true);}
    return;
  }
  if(action==='delete-user'){
    try {
      const id=btn.dataset.id;
      const user=(state.userDetail?.user?.id===id ? state.userDetail.user : state.userRows.find(u=>u.id===id));
      if(!user)throw new Error('Account not found in current user list.');
      const typed=window.prompt('Permanently delete '+user.email+' and its synced data? Type the exact account email:');
      if(typed===null)return;
      if(typed.trim().toLowerCase()!==String(user.email).toLowerCase()){
        toast('Email confirmation did not match. Nothing deleted.',true);return;
      }
      if(!window.confirm('FINAL CONFIRMATION: Delete '+user.email+' permanently? This cannot be undone.'))return;
      if(state.userDetail?.user?.id!==id)await openAdminUser(supabase,state,id);
      await deleteAdminUser(supabase,state,id,typed);
      toast('User account deleted from AnimePlex.');
      render();
    } catch(error){toast(errorMessage(error),true);}
    return;
  }
  if(action==='toggle-sources-access'){
    try {
      const id=btn.dataset.id;
      if (!state.userDetail || state.userDetail.user?.id !== id) throw new Error('User profile not open.');
      const newValue = state.userDetail.sourcesAccess !== true;
      await setAdminUserSourcesAccess(supabase,state,id,newValue);
      toast(newValue ? 'Sources access granted to this user.' : 'Sources access revoked.');
      render();
    } catch(error){toast(errorMessage(error),true);}
    return;
  }
  if(['provider-manage-repo','provider-remove-repo','provider-save-selection',
      'provider-close-catalogue','provider-page-prev','provider-page-next',
      'provider-select-visible','provider-clear-visible'].includes(action)){
    try{
      if(action==='provider-manage-repo'){
        const n=await openProviderCatalogue(supabase,state,btn.dataset.id);
        toast(n+' available extensions found.');
      }else if(action==='provider-remove-repo'){
        const repo=state.providerRepositories.find(x=>x.id===btn.dataset.id);
        if(!repo)throw new Error('Repository no longer exists.');
        if(!window.confirm('Remove '+repo.label+' and its selected source configurations? Existing Android installs will not be uninstalled.'))return;
        await removeProviderRepository(supabase,state,repo.id);
        toast('Repository removed from admin registry.');
      }else if(action==='provider-save-selection'){
        const n=await saveProviderSelection(supabase,state);
        toast(n+' sources selected for remote installation.');
      }else if(action==='provider-close-catalogue'){
        state.activeProviderRepoId=null;state.providerCatalog=[];state.providerSelection=new Set();
      }else if(action==='provider-page-prev'){
        state.providerCatalogPage=Math.max(0,state.providerCatalogPage-1);
      }else if(action==='provider-page-next'){
        state.providerCatalogPage++;
      }else{
        for(const source of visibleProviderSources(state)){
          if(action==='provider-select-visible')state.providerSelection.add(source.id);
          else state.providerSelection.delete(source.id);
        }
      }
      render();
    }catch(error){toast(errorMessage(error),true);}
    return;
  }
  if(['edit-provider','cancel-provider-edit','toggle-provider','default-provider','remove-provider'].includes(action)){
    try {
      if(action==='cancel-provider-edit')state.editProviderId=null;
      else if(action==='edit-provider')state.editProviderId=btn.dataset.id;
      else {
        const row=state.managedProviders.find(p=>p.id===btn.dataset.id);
        if(!row)throw new Error('Provider no longer exists.');
        if(action==='toggle-provider')await changeAdminProvider(supabase,state,row.id,{enabled:!row.enabled});
        if(action==='default-provider')await changeAdminProvider(supabase,state,row.id,{is_default:true,enabled:true});
        if(action==='remove-provider'){
          if(!window.confirm('Remove '+row.label+' from remote-managed providers?'))return;
          await removeAdminProvider(supabase,state,row.id);
        }
      }
      render();
    } catch(error){toast(errorMessage(error),true);}
    return;
  }
  if(action==='menu'){state.mobileOpen=true;render();}
  if(action==='close-menu'){state.mobileOpen=false;render();}
  if(action==='control-up'||action==='control-down'){
    updateControlDraft(reorderPlayerControl(playerDraft(),btn.dataset.id,action==='control-up'?-1:1));
    return;
  }
  if(action==='restore-player-defaults'){
    updateControlDraft(cleanPlayerLayout(DEFAULT_PLAYER_LAYOUT));return;
  }
  if(action==='reset-player-draft'){
    state.playerDraft=cleanPlayerLayout(config().player_controls ?? DEFAULT_PLAYER_LAYOUT);
    state.playerAllowCustom=config().allow_player_customization!==false;
    state.playerDirty=false;render();return;
  }
  if(action==='publish-player-controls'){await publishAdminControls();return;}
  if(action==='publish-region'){await publishAdminRegion();return;}
  if(action==='disable-player-controls'||action==='disable-region'){
    if(!window.confirm('Disable this admin override? Users will return to their local settings.'))return;
    await saveSettings(action==='disable-player-controls'?
      {player_controls_enabled:false}:{streaming_region_enabled:false},
      'Admin override disabled.');return;
  }
  if(action==='new-release'){state.page='releases';state.selectedId=null;state.draft=initialRelease();state.mobileOpen=false;render();window.scrollTo(0,0);}
  if(action==='select-release')selectRelease(btn.dataset.id);
  if(action==='publish')await publishRelease();
  if(action==='pause')await pauseRelease();
  if(action==='delete')await deleteDraft();
  if(action==='logout'){
    await supabase.auth.signOut();
    state.user=null;state.member=null;state.releases=[];state.userRows=[];state.userDetail=null;state.managedProviders=[];state.page='overview';state.loginError='';render();
  }
});
// HTML5 drag-and-drop supports both placement and reordering between lanes.
document.addEventListener('dragstart',(e)=>{
  const row=e.target.closest('[data-control-id]');
  if(row?.draggable && e.dataTransfer){
    e.dataTransfer.setData('text/plain',row.dataset.controlId);
    e.dataTransfer.effectAllowed='move';
  }
});
document.addEventListener('dragover',(e)=>{
  if(e.target.closest('[data-control-lane]'))e.preventDefault();
});
document.addEventListener('drop',(e)=>{
  const lane=e.target.closest('[data-control-lane]');
  if(!lane || !e.dataTransfer)return;
  e.preventDefault();
  const id=e.dataTransfer.getData('text/plain');
  const beforeId=e.target.closest('[data-control-id]')?.dataset.controlId;
  if(id && id!==beforeId)
    updateControlDraft(movePlayerControl(playerDraft(),id,lane.dataset.controlLane,beforeId));
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
