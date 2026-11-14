import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Bookmark, ChevronRight, Download, Flag, Languages, Layers3, Link2, LockKeyhole, LogOut, Palette, PlayCircle, Plus, Radio, RefreshCw, Search, ShieldCheck, Sparkles, Trash2, UserRound, Bell, Grid2X2 } from 'lucide-react';
import { AppearanceStudio, ThemeGallery } from './Appearance.jsx';
import { AccountSecurity } from './AccountSecurity.jsx';

const featureCatalog = [
  { key: 'search_enabled', name: 'Search', description: 'Find titles and sources', icon: Search },
  { key: 'downloads_enabled', name: 'Downloads', description: 'Download controls', icon: Download },
  { key: 'library_enabled', name: 'My library', description: 'Saved lists and favorites', icon: Bookmark },
  { key: 'profile_enabled', name: 'Profiles', description: 'Profile and account area', icon: UserRound },
  { key: 'notifications_enabled', name: 'Notifications', description: 'In-app notification access', icon: Bell },
  { key: 'subtitles_enabled', name: 'Subtitles', description: 'Subtitle controls', icon: Languages },
  { key: 'autoplay_enabled', name: 'Autoplay', description: 'Next episode playback', icon: PlayCircle },
  { key: 'source_selection_enabled', name: 'Source selection', description: 'Choose a provider', icon: Grid2X2 },
];
const defaultRepo = 'https://raw.githubusercontent.com/Abhishekred/Stream-1/refs/heads/builds/repo.json';
const settingsMap = items => Object.fromEntries(items.map(item => [item.key, item.value]));

export function AuditChart({ trend }) {
  const days = Array.isArray(trend?.days) ? trend.days : [];
  const maximum = Math.max(1, ...days.map(day => day.count));
  return <div className="audit-chart" role="img" aria-label="Admin actions by day over the last seven days">
    {days.length ? days.map(day => <div className="audit-column" key={day.date}>
      <span className="audit-count">{day.count}</span><div className="audit-track"><i style={{ height: `${(day.count / maximum) * 100}%` }} /></div>
      <span className="audit-day">{new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day.date}T00:00:00Z`))}</span>
    </div>) : <div className="chart-placeholder"><Activity size={22}/><strong>Waiting for activity</strong><span>The chart appears after the dashboard loads.</span></div>}
  </div>;
}

export function AnalyticsPage({ data, go }) {
  const total = data.auditTrend?.total ?? 0;
  return <div className="studio-stack">
    <div className="studio-feature-intro"><div className="studio-feature-icon"><Activity size={22}/></div><div><span className="studio-kicker">OPERATIONS ANALYTICS</span><h2>Know what’s happening.</h2><p>Live registry and admin activity from your secured admin API.</p></div></div>
    <div className="stats-grid analytics-stats"><div className="stat-card"><span>Admin actions · 7 days</span><strong>{total}</strong><small>{data.auditTrend?.truncated ? 'Latest 1,000 events' : 'Audit log records'}</small></div><div className="stat-card"><span>Profiles</span><strong>{typeof data.stats.users === 'number' ? data.stats.users.toLocaleString() : '—'}</strong><small>{data.stats.users === null ? 'App profiles not connected' : 'Stored profile records'}</small></div><div className="stat-card"><span>Announcements</span><strong>{data.stats.activeAnnouncements}</strong><small>Currently enabled</small></div><div className="stat-card"><span>Active viewers</span><strong>—</strong><small>App telemetry pending</small></div></div>
    <div className="studio-grid"><section className="panel"><div className="panel-heading"><div><h3>Admin activity</h3><p>Actions per day · last seven days, UTC</p></div><span className="preview-pill">API DATA</span></div><AuditChart trend={data.auditTrend}/><div className="chart-caption">{data.auditTrend?.truncated ? 'Showing the most recent 1,000 events in this period.' : 'Based on your admin audit log.'}</div></section><section className="panel telemetry-panel"><div className="telemetry-icon"><Radio size={20}/></div><h3>App telemetry is next</h3><p>Playback, active viewers, crashes and source success rates need mobile-app events. They won’t be guessed here.</p><button className="text-link" onClick={()=>go('System Health')}>View system health <ChevronRight size={14}/></button></section></div>
  </div>;
}

function Toggle({ checked, label, disabled, onChange }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={Boolean(checked)} disabled={disabled} className={checked ? 'toggle-switch on' : 'toggle-switch'} onClick={() => onChange(!checked)}><i/></button>;
}

export function AppControlPage({ items, api, refresh, notify, canEdit, appearanceOnly = false }) {
  const values = useMemo(() => settingsMap(items), [items]);
  const [homeMessage, setHomeMessage] = useState('');
  const [flags, setFlags] = useState({});
  const [flagName, setFlagName] = useState('');
  const [saving, setSaving] = useState('');
  const flagSignature = JSON.stringify(values.feature_flags && typeof values.feature_flags === 'object' && !Array.isArray(values.feature_flags) ? values.feature_flags : {});
  useEffect(() => setHomeMessage(typeof values.home_message === 'string' ? values.home_message : ''), [values.home_message]);
  useEffect(() => setFlags(JSON.parse(flagSignature)), [flagSignature]);
  const save = async (key, value) => {
    setSaving(key);
    try { await api('config', 'PUT', { key, value }); notify('Setting saved to the registry.'); await refresh(); }
    catch (error) { notify(error.message); }
    finally { setSaving(''); }
  };
  const updateFlags = (next) => save('feature_flags', next);
  const addFlag = (event) => {
    event.preventDefault();
    const name = flagName.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{0,49}$/.test(name)) return notify('Use a lowercase name with letters, numbers or underscores.');
    if (Object.hasOwn(flags, name)) return notify('This feature flag already exists.');
    setFlagName(''); updateFlags({ ...flags, [name]: true });
  };
  const removeFlag = (name) => {
    if (!window.confirm(`Delete the ${name} feature flag?`)) return;
    const next = { ...flags }; delete next[name]; updateFlags(next);
  };
  if (appearanceOnly) return <AppearanceStudio items={items} api={api} refresh={refresh} notify={notify} canEdit={canEdit}/>;
  const customFlags = Object.entries(flags).filter(([name]) => !featureCatalog.some(feature => feature.key === name));
  return <div className="studio-stack">
    <div className="integration-strip"><AlertTriangle size={17}/><span>Settings are saved to the admin registry. The mobile app will use them after its separate integration.</span></div>
    <section className="control-banner"><div><div className="studio-kicker">THE CONTROL ROOM</div><h2>Every detail, under control.</h2><p>Shape the experience your community sees, from one thoughtfully organized workspace.</p></div><div className="control-banner-mark"><span>✦</span><Layers3 size={30}/></div></section>
    <div className="studio-grid"><section className="panel"><div className="panel-heading"><div><div className="section-index">01 / APP STATUS</div><h3>App-wide switches</h3><p>Controls for supported mobile versions</p></div><SlidersIcon/></div>
      <div className="control-row"><div><strong>Maintenance mode</strong><small>Pause access when the app supports it</small></div><Toggle label="Maintenance mode" checked={values.maintenance_mode === true} disabled={!canEdit || Boolean(saving)} onChange={value => { if (!value || window.confirm('Enable maintenance mode in the app settings registry?')) save('maintenance_mode', value); }}/></div>
      <div className="control-row"><div><strong>Community prompt</strong><small>Show or hide the community message</small></div><Toggle label="Community prompt" checked={values.community_popup_enabled === true} disabled={!canEdit || Boolean(saving)} onChange={value => save('community_popup_enabled', value)}/></div>
    </section><section className="panel"><div className="panel-heading"><div><div className="section-index">02 / HOME MESSAGE</div><h3>Speak to your audience</h3><p>Text prepared for the app home screen</p></div><Sparkles size={18}/></div><label className="studio-label" htmlFor="studio-home-message">Message</label><textarea id="studio-home-message" className="text-input textarea studio-textarea" maxLength={1000} disabled={!canEdit} value={homeMessage} onChange={event => setHomeMessage(event.target.value)} placeholder="Write a message for your users"/><div className="studio-actions"><span>{homeMessage.length}/1000</span><button className="button button-primary" disabled={!canEdit || Boolean(saving)} onClick={() => save('home_message', homeMessage)}>Save message</button></div></section></div>
    <section className="panel feature-panel"><div className="panel-heading"><div><div className="section-index">03 / EXPERIENCE CONTROLS</div><h3>Features at your fingertips</h3><p>Set feature flags for each supported mobile feature.</p></div><span className="preview-pill">{featureCatalog.length} CONTROLS</span></div><div className="feature-grid">{featureCatalog.map(({key,name,description,icon:Icon}) => <article className="feature-card" key={key}><div className="feature-card-icon"><Icon size={18}/></div><div className="feature-card-copy"><strong>{name}</strong><small>{description}</small><span>{Object.hasOwn(flags,key) ? (flags[key] ? 'Enabled' : 'Disabled') : 'Not configured'}</span></div><Toggle label={name} checked={flags[key] === true} disabled={!canEdit || Boolean(saving)} onChange={value => updateFlags({ ...flags, [key]: value })}/></article>)}</div></section>
    <section className="panel"><div className="panel-heading"><div><div className="section-index">04 / ADVANCED</div><h3>Custom feature flags</h3><p>Add or remove additional controls as the app supports them.</p></div><Flag size={18}/></div><div className="flag-list">{customFlags.map(([name, enabled]) => <div className="control-row" key={name}><div><strong>{name.replaceAll('_', ' ')}</strong><small>{name}</small></div><Toggle label={name} checked={enabled} disabled={!canEdit || Boolean(saving)} onChange={value => updateFlags({ ...flags, [name]: value })}/><button className="icon-button" aria-label={`Delete ${name}`} disabled={!canEdit || Boolean(saving)} onClick={() => removeFlag(name)}><Trash2 size={15}/></button></div>)}{!customFlags.length && <p className="muted-copy">No custom feature flags added yet.</p>}</div><form className="inline-form" onSubmit={addFlag}><input className="text-input" aria-label="New feature flag name" value={flagName} onChange={event => setFlagName(event.target.value)} placeholder="e.g. watch_party_enabled" maxLength="50" disabled={!canEdit}/><button className="button button-quiet" disabled={!canEdit || Boolean(saving)}><Plus size={15}/> Add flag</button></form></section>
  </div>;
}

function SlidersIcon() { return <Layers3 size={18} aria-hidden="true"/>; }

export function SourcesPage({ items, api, refresh, notify, canEdit }) {
  const values = useMemo(() => settingsMap(items), [items]);
  const repositories = Array.isArray(values.source_repositories) ? values.source_repositories : [];
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [source, setSource] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => setSource(typeof values.default_source === 'string' ? values.default_source : ''), [values]);
  const save = async (key, value) => {
    setSaving(true);
    try { await api('config', 'PUT', { key, value }); notify('Source settings saved.'); await refresh(); return true; }
    catch (error) { notify(error.message); return false; }
    finally { setSaving(false); }
  };
  const openForm = repo => { setEditing(repo || { id: '', enabled: true }); setName(repo?.name || ''); setUrl(repo?.url || defaultRepo); };
  const submit = async event => {
    event.preventDefault();
    const id = editing.id || globalThis.crypto?.randomUUID?.() || `repo-${Date.now()}`;
    const next = { id, name: name.trim(), url: url.trim(), enabled: editing.enabled };
    const list = editing.id ? repositories.map(repo => repo.id === id ? next : repo) : [...repositories, next];
    if (await save('source_repositories', list)) setEditing(null);
  };
  const remove = repo => {
    if (window.confirm(`Remove ${repo.name} from the source registry?`)) save('source_repositories', repositories.filter(item => item.id !== repo.id));
  };
  return <div className="studio-stack"><div className="integration-strip"><AlertTriangle size={17}/><span>Source settings are managed here now; automatic changes on devices require app-side integration later.</span></div>
    <div className="studio-grid"><section className="panel"><div className="panel-heading"><div><h3>Source repositories</h3><p>Add, edit, enable or remove repository entries.</p></div><button className="button button-primary" disabled={!canEdit || saving} onClick={() => openForm(null)}><Plus size={15}/> Add repo</button></div>
      {editing && <form className="source-form" onSubmit={submit}><label className="studio-label">Repository name<input className="text-input" value={name} onChange={event => setName(event.target.value)} maxLength="80" required/></label><label className="studio-label">HTTPS repository URL<input className="text-input" type="url" value={url} onChange={event => setUrl(event.target.value)} required/></label><div className="source-form-actions"><button className="button button-quiet" type="button" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" disabled={saving}>Save repository</button></div></form>}
      <div className="source-list">{repositories.map(repo => <article className="source-row" key={repo.id}><div className="source-logo"><Link2 size={17}/></div><div className="source-copy"><strong>{repo.name}</strong><small>{repo.url}</small></div><Toggle label={`Enable ${repo.name}`} checked={repo.enabled} disabled={!canEdit || saving} onChange={enabled => save('source_repositories', repositories.map(item => item.id === repo.id ? { ...item, enabled } : item))}/><button className="table-action" disabled={!canEdit || saving} onClick={() => openForm(repo)}>Edit</button><button className="icon-button" aria-label={`Remove ${repo.name}`} disabled={!canEdit || saving} onClick={() => remove(repo)}><Trash2 size={15}/></button></article>)}{!repositories.length && <div className="empty-state">No repositories configured yet. Add the Stream-1 URL to get started.</div>}</div>
    </section><section className="panel"><div className="panel-heading"><div><h3>Default source</h3><p>Choose the provider the app should use first.</p></div><Layers3 size={18}/></div><label className="studio-label" htmlFor="default-source">Provider identifier</label><input id="default-source" className="text-input" value={source} onChange={event => setSource(event.target.value)} placeholder="MovieBoxProvider" maxLength="120" disabled={!canEdit}/><div className="studio-actions"><span>Example: MovieBoxProvider</span><button className="button button-primary" disabled={!canEdit || saving} onClick={() => save('default_source', source.trim())}>Save default</button></div><div className="source-note"><ShieldCheck size={17}/><span>Only HTTPS repository URLs are accepted. Signed or verified extensions should be used when connecting the app.</span></div></section></div></div>;
}

export function DashboardPreferences({ dark, setDark, accent, setAccent, autoRefresh, setAutoRefresh, email, onSignOut, api, notify, refreshSession }) {
  return <div className="studio-stack"><section className="panel session-panel"><div className="session-badge"><ShieldCheck size={20}/></div><div className="session-copy"><div className="section-index">YOUR SESSION</div><h3>Signed in on this browser</h3><p>{`${email || 'Admin account'} · Your session refreshes automatically.`}</p></div><button type="button" className="button button-quiet session-signout" onClick={onSignOut}><LogOut size={15}/> Sign out</button></section><AccountSecurity email={email} api={api} notify={notify} refreshSession={refreshSession}/><div className="studio-grid"><section className="panel"><div className="panel-heading"><div><h3>Dashboard appearance</h3><p>These preferences apply only in this browser.</p></div><Palette size={18}/></div><div className="control-row"><div><strong>Dark mode</strong><small>Switch between dark and light</small></div><Toggle label="Dark dashboard" checked={dark} onChange={setDark}/></div></section><section className="panel"><div className="panel-heading"><div><h3>Dashboard refresh</h3><p>Keep operational information current.</p></div><RefreshCw size={18}/></div><div className="control-row"><div><strong>Auto-refresh</strong><small>Refresh dashboard data every 30 seconds</small></div><Toggle label="Auto-refresh dashboard" checked={autoRefresh} onChange={setAutoRefresh}/></div></section></div><section className="panel"><div className="panel-heading"><div><div className="section-index">DASHBOARD THEME</div><h3>Set the mood</h3><p>Pick one of eight themes for this browser. App themes are managed separately.</p></div><Palette size={18}/></div><ThemeGallery selected={accent} onSelect={setAccent} compact/><div className="source-note"><LockKeyhole size={17}/><span>Your session and access are managed by Supabase. App-side integration is a separate step.</span></div></section></div>;
}
