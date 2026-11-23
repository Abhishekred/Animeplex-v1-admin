import { escapeHtml as esc, shortDate } from './utils.js';

export const canManageUsers = (role) => role === 'owner' || role === 'admin';
const allowed = (role) => {
  if (!canManageUsers(role)) throw new Error('Owner/admin permission required.');
};
export function validateManagedProvider(value) {
  const repo_url = String(value.repo_url || '').trim();
  const plugin_id = String(value.plugin_id || '').trim();
  const label = String(value.label || '').trim();
  const priority = Number(value.priority ?? 100);
  if (!/^https:\/\/raw\.githubusercontent\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+\/repo\.json$/.test(repo_url) ||
      repo_url.includes('..') || repo_url.length > 500) {
    return { error: 'Use a raw.githubusercontent.com HTTPS repo.json URL.' };
  }
  if (!/^[A-Za-z0-9_.-]{1,120}$/.test(plugin_id)) {
    return { error: 'Enter the exact plugin internalName from that repo.' };
  }
  if (!label || label.length > 120) return { error: 'Provider label must be 1–120 characters.' };
  if (!Number.isInteger(priority) || priority < 0 || priority > 9999) {
    return { error: 'Priority must be an integer from 0 to 9999.' };
  }
  return { data: {
    kind: 'cloudstream', repo_url, plugin_id, label, priority,
    enabled: Boolean(value.enabled),
    auto_install: Boolean(value.auto_install),
    is_default: Boolean(value.is_default),
  } };
}
export async function loadAdminUsers(db, state, query = '', offset = 0) {
  allowed(state.member?.role);
  const {data,error} = await db.rpc('animeplex_admin_user_page', {
    p_search:String(query).slice(0,120),p_limit:25,p_offset:Math.max(0,offset),
  });
  if (error) throw error;
  state.userSearch = String(query).slice(0,120);
  state.userOffset = data?.offset || 0;
  state.userCount = data?.total || 0;
  state.userRows = Array.isArray(data?.users) ? data.users : [];
  state.userDetail = null;
  state.userLoadingError = '';
}
export async function openAdminUser(db, state, id) {
  allowed(state.member?.role);
  if (!state.userRows?.some(row=>row.id===id)) throw new Error('Select a listed user.');
  const {data,error} = await db.rpc('animeplex_admin_user_detail', {p_user_id:id});
  if (error) throw error;
  state.userDetail = data;
}
export async function loadAdminProviders(db, state) {
  allowed(state.member?.role);
  const {data,error} = await db.from('animeplex_managed_providers')
    .select('id,kind,repo_url,plugin_id,label,enabled,auto_install,is_default,priority,created_at,updated_at')
    .order('priority',{ascending:true});
  if (error) throw error;
  state.managedProviders = data || [];
}
export async function saveAdminProvider(db, state, values, id = null) {
  allowed(state.member?.role);
  const checked = validateManagedProvider(values);
  if (checked.error) throw new Error(checked.error);
  // The single-default constraint guarantees no conflicting remote defaults.
  if (checked.data.is_default) {
    const {error} = await db.from('animeplex_managed_providers')
      .update({is_default:false,updated_at:new Date().toISOString()})
      .eq('is_default',true);
    if (error) throw error;
  }
  const payload = {...checked.data,updated_at:new Date().toISOString()};
  const request = id
    ? db.from('animeplex_managed_providers').update(payload).eq('id',id)
    : db.from('animeplex_managed_providers').insert(payload);
  const {error} = await request;
  if (error) throw error;
  await loadAdminProviders(db,state);
  state.editProviderId = null;
}
export async function changeAdminProvider(db,state,id,values) {
  allowed(state.member?.role);
  if (!state.managedProviders.some(p=>p.id===id)) throw new Error('Unknown provider.');
  if (values.is_default===true) {
    const {error} = await db.from('animeplex_managed_providers')
      .update({is_default:false}).eq('is_default',true);
    if (error) throw error;
  }
  const {error} = await db.from('animeplex_managed_providers')
    .update({...values,updated_at:new Date().toISOString()}).eq('id',id);
  if(error)throw error;
  await loadAdminProviders(db,state);
}
export async function removeAdminProvider(db,state,id) {
  allowed(state.member?.role);
  const {error} = await db.from('animeplex_managed_providers').delete().eq('id',id);
  if(error)throw error;
  await loadAdminProviders(db,state);
}
const date = (value) => value ? esc(new Date(value).toLocaleString('en-IN')) : 'Never';
const col = (value) => esc(value == null || value === '' ? '—' : value);
const count = (n) => esc(Number(n||0).toLocaleString('en-IN'));
function tableRows(rows, keys) {
  if (!rows?.length) return '<div class="empty"><p>No synced records found.</p></div>';
  return '<div class="admin-data-table"><table><thead><tr>'+
    keys.map(([k,label])=>'<th>'+esc(label)+'</th>').join('')+
    '</tr></thead><tbody>'+rows.map(row=>'<tr>'+keys.map(([k])=>
    '<td>'+col(row[k])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
export function usersPage(state) {
  if (!canManageUsers(state.member?.role)) return '<div class="alert warning">Owner/admin access required.</div>';
  if(state.userDetail) {
    const d=state.userDetail, u=d.user || {};
    const sections=[
      ['My List',d.mylist,[['title','Title'],['type','Type'],['status','Status'],['source_id','Source']]],
      ['Watch history',d.watch_history,[['show_title','Title'],['episode_number','Episode'],['position_ms','Position (ms)']]],
      ['Reading history',d.reading_history,[['title','Title'],['chapter_number','Chapter'],['pos','Progress']]],
      ['Viewer profiles',d.viewer_profiles,[['name','Name'],['is_kids','Kids'],['created_at','Created']]],
      ['My List categories',d.categories,[['source_id','Source'],['item_id','Item'],['category_id','Category']]],
    ];
    return '<div class="page-head"><div><div class="eyebrow">Read-only · audited</div><h1 class="heading">'+col(u.display_name||u.email)+'</h1><p class="subtitle">'+col(u.email)+' · Last login '+date(u.last_sign_in_at)+'</p></div>'+
      '<button class="btn btn-ghost" data-action="user-back">Back to users</button></div>'+
      '<div class="alert">Only synced library metadata is shown, up to 100 recent rows per category. Passwords, session tokens and profile PINs are never accessible here.</div>'+
      sections.map(([title,rows,columns])=>'<section class="card" style="margin-top:20px"><div class="card-head"><h2>'+esc(title)+'</h2><span class="pill">'+count(rows?.length)+'</span></div><div class="card-body">'+tableRows(rows,columns)+'</div></section>').join('');
  }
  const rows=state.userRows || [], total=state.userCount || 0, offset=state.userOffset||0;
  return '<div class="page-head"><div><div class="eyebrow">Authorized user analytics</div><h1 class="heading">User <span>management</span></h1>'+
    '<p class="subtitle">Accounts, last sign-in and synced library activity. Every user access is audited.</p></div></div>'+
    '<section class="card"><form class="card-body" id="admin-user-search" style="display:flex;gap:12px;flex-wrap:wrap">'+
      '<input class="field" name="query" type="search" maxlength="120" placeholder="Search email or display name" value="'+esc(state.userSearch||'')+'" style="flex:1;min-width:220px">'+
      '<button class="btn btn-primary" type="submit">Search</button>'+
      '<button type="button" class="btn btn-ghost" data-action="refresh-users">Refresh</button></form>'+
      '<div class="admin-data-table"><table><thead><tr><th>User</th><th>Registered</th><th>Last login</th><th>My List</th><th>Watched</th><th>Read</th><th>Profiles</th><th></th></tr></thead><tbody>'+
      rows.map(u=>'<tr><td><strong>'+col(u.display_name||u.email)+'</strong><small style="display:block">'+col(u.email)+'</small></td><td>'+date(u.created_at)+'</td><td>'+date(u.last_sign_in_at)+'</td><td>'+count(u.mylist_count)+'</td><td>'+count(u.watch_count)+'</td><td>'+count(u.reading_count)+'</td><td>'+count(u.profile_count)+'</td><td><button class="btn btn-ghost btn-sm" data-action="view-user" data-id="'+esc(u.id)+'">View</button></td></tr>').join('')+
      '</tbody></table></div><div class="card-body" style="display:flex;justify-content:space-between;align-items:center"><span>'+count(Math.min(offset+1,total))+'–'+count(Math.min(offset+rows.length,total))+' of '+count(total)+'</span><div style="display:flex;gap:8px">'+
      '<button class="btn btn-ghost btn-sm" data-action="user-prev" '+(offset===0?'disabled':'')+'>Previous</button><button class="btn btn-ghost btn-sm" data-action="user-next" '+(offset+rows.length>=total?'disabled':'')+'>Next</button></div></div></section>';
}
export function providersPage(state) {
  if (!canManageUsers(state.member?.role)) return '<div class="alert warning">Owner/admin access required.</div>';
  const items=state.managedProviders || [];
  const edit=items.find(p=>p.id===state.editProviderId);
  const value=(key,fallback='')=>esc(edit?.[key]??fallback);
  return '<div class="page-head"><div><div class="eyebrow">Remote extension control</div><h1 class="heading">Managed <span>providers</span></h1>'+
    '<p class="subtitle">Install multiple CloudStream repo plugins on Android, choose priorities and toggle availability. Changes sync at next app launch.</p></div></div>'+
    '<div class="dual-grid"><section class="card"><div class="card-head"><h2>'+(edit?'Edit provider':'Add provider')+'</h2></div>'+
    '<form class="card-body stack" id="admin-provider-form"><label class="label">Display name</label><input class="field" required name="label" maxlength="120" value="'+value('label')+'" placeholder="Example: MovieBox">'+
    '<label class="label">CloudStream repo.json URL</label><input class="field" required name="repo_url" type="url" value="'+value('repo_url')+'" placeholder="https://raw.githubusercontent.com/owner/repo/branch/repo.json">'+
    '<label class="label">Plugin internalName</label><input class="field" required name="plugin_id" value="'+value('plugin_id')+'" placeholder="MovieBoxProvider">'+
    '<label class="label">Priority (lower first)</label><input class="field" required type="number" name="priority" min="0" max="9999" value="'+value('priority',100)+'">'+
    '<label><input type="checkbox" name="enabled" '+(edit?.enabled!==false?'checked':'')+'> Enabled</label>'+
    '<label><input type="checkbox" name="auto_install" '+(edit?.auto_install!==false?'checked':'')+'> Install on Android app</label>'+
    '<label><input type="checkbox" name="is_default" '+(edit?.is_default===true?'checked':'')+'> Default playback provider</label>'+
    '<div style="display:flex;gap:10px"><button class="btn btn-primary" type="submit">'+(edit?'Save changes':'Add provider')+'</button>'+
    (edit?'<button class="btn btn-ghost" data-action="cancel-provider-edit" type="button">Cancel</button>':'')+
    '</div></form></section><section class="card"><div class="card-head"><h2>Provider registry</h2><span class="pill">'+count(items.length)+' configured</span></div>'+
    '<div class="card-body"><div class="alert">Android only. The URL must be a GitHub raw repo.json. Plugin code runs inside the app: enable only trusted repositories. Removing a managed provider stops future remote use; per-device install status is not collected.</div>'+
    (items.length?items.map(p=>'<div class="activity-row" style="flex-wrap:wrap;gap:10px"><div class="activity-content"><strong>'+col(p.label)+'</strong><div class="activity-sub">'+col(p.plugin_id)+' · Priority '+col(p.priority)+' · '+(p.enabled?'Enabled':'Disabled')+(p.is_default?' · Default':'')+'</div><small class="activity-sub">'+col(p.repo_url)+'</small></div>'+
      '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" data-action="edit-provider" data-id="'+esc(p.id)+'">Edit</button>'+
      '<button class="btn btn-ghost btn-sm" data-action="toggle-provider" data-id="'+esc(p.id)+'">'+(p.enabled?'Disable':'Enable')+'</button>'+
      (!p.is_default?'<button class="btn btn-ghost btn-sm" data-action="default-provider" data-id="'+esc(p.id)+'">Make default</button>':'')+
      '<button class="btn btn-ghost btn-sm" data-action="remove-provider" data-id="'+esc(p.id)+'">Remove</button></div></div>').join(''):'<div class="empty"><p>No remote providers configured. Add one to start.</p></div>')+'</div></section></div>';
}
