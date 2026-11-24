import { escapeHtml as esc } from './utils.js';

export const PROVIDER_TYPES = Object.freeze([
  ['cloudstream','CloudStream','CloudStream repo.json (plugins.json lists)'],
  ['mangayomi','Mangayomi','Mangayomi index.json / novel_index.json'],
  ['zangetsu','Zangetsu','Built-in JavaScript provider index.json'],
  ['stremio','Stremio','Public addon manifest.json / base URL'],
  ['aniyomi','Aniyomi','Aniyomi index.json / index.min.json'],
  ['mihon','Mihon','Mihon index.json / index.min.json'],
  ['lnreader','LNReader','Novel plugins.min.json'],
]);
const typeNames=Object.fromEntries(PROVIDER_TYPES.map(([id,name])=>[id,name]));
const safe=(value)=>esc(String(value??''));
export function validateProviderRepo(form){
  const kind=String(form.kind||'');
  const label=String(form.label||'').trim();
  const url=String(form.repo_url||'').trim();
  if(!typeNames[kind])return {error:'Select a supported provider type.'};
  if(!label||label.length>120)return {error:'Repository name must be 1–120 characters.'};
  if(url.length>700)return {error:'URL is too long.'};
  let u;
  try {u=new URL(url);} catch {return {error:'Enter a valid HTTPS URL.'};}
  if(u.protocol!=='https:'||!u.hostname.includes('.')||u.username||u.password||
     u.search||u.hash||u.port||/^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[|::)/i.test(u.hostname))
    return {error:'Use a public HTTPS URL without a password or token.'};
  if(kind==='cloudstream' && (u.hostname!=='raw.githubusercontent.com' ||
     !u.pathname.endsWith('/repo.json')))
    return {error:'CloudStream requires a raw.githubusercontent.com repo.json URL.'};
  return {data:{kind,label,repo_url:url}};
}
function assertAdmin(state){
  if(!['owner','admin'].includes(state.member?.role))throw Error('Owner/admin permission required.');
}
export async function loadProviderRepositories(db,state){
  assertAdmin(state);
  const [repos,entries]=await Promise.all([
    db.from('animeplex_managed_repositories')
      .select('id,kind,repo_url,label,enabled,updated_at')
      .order('updated_at',{ascending:false}),
    db.from('animeplex_managed_providers')
      .select('id,repository_id,kind,repo_url,plugin_id,label,priority,enabled,auto_install,is_default')
      .order('priority',{ascending:true}),
  ]);
  if(repos.error)throw repos.error;
  if(entries.error)throw entries.error;
  state.providerRepositories=repos.data||[];
  state.managedProviders=entries.data||[];
}
async function discover(db,kind,url){
  const {data,error}=await db.functions.invoke('provider-catalog',{body:{kind,url}});
  if(error){
    let detail='';
    try {detail=(await error.context?.json?.())?.error||'';}catch(_){}
    throw Error(detail||error.message||'Could not scan repository.');
  }
  if(!data?.ok||!Array.isArray(data.items))throw Error(data?.error||'Invalid catalogue response.');
  return data;
}
function rememberCatalogue(state,repo,items){
  state.activeProviderRepoId=repo.id;
  state.providerCatalog=items;
  state.providerCatalogQuery='';
  state.providerCatalogPage=0;
  const prior=state.managedProviders||[];
  state.providerSelection=new Set(prior.filter(x=>x.repository_id===repo.id).map(x=>x.plugin_id));
}
export async function addProviderRepository(db,state,form){
  assertAdmin(state);
  const check=validateProviderRepo(form);
  if(check.error)throw Error(check.error);
  const {kind,label,repo_url}=check.data;
  const discovered=await discover(db,kind,repo_url);
  if(!discovered.items.length)throw Error('No installable sources were found in this repository.');
  const {data,error}=await db.from('animeplex_managed_repositories')
    .upsert({kind,repo_url,label,updated_at:new Date().toISOString()},{
      onConflict:'kind,repo_url'
    }).select('id,kind,repo_url,label,enabled,updated_at').single();
  if(error)throw error;
  await loadProviderRepositories(db,state);
  rememberCatalogue(state,data,discovered.items);
  return discovered.items.length;
}
export async function openProviderCatalogue(db,state,repoId){
  assertAdmin(state);
  const repo=state.providerRepositories?.find(p=>p.id===repoId);
  if(!repo)throw Error('Repository not found.');
  const result=await discover(db,repo.kind,repo.repo_url);
  rememberCatalogue(state,repo,result.items);
  return result.items.length;
}
export async function saveProviderSelection(db,state){
  assertAdmin(state);
  const id=state.activeProviderRepoId;
  const repo=state.providerRepositories?.find(p=>p.id===id);
  if(!repo)throw Error('Open a repository first.');
  const selected=(state.providerCatalog||[]).filter(p=>state.providerSelection?.has(p.id));
  if(selected.length>150)throw Error('Select up to 150 extensions per save.');
  const items=selected.map(x=>({id:x.id,name:x.name,type:x.type,lang:x.lang,version:x.version}));
  const {error}=await db.rpc('animeplex_admin_set_repo_sources',{
    p_repo_id:id,p_items:items
  });
  if(error)throw error;
  await loadProviderRepositories(db,state);
  return selected.length;
}
export async function removeProviderRepository(db,state,repoId){
  assertAdmin(state);
  if(!state.providerRepositories?.some(r=>r.id===repoId))throw Error('Repository not found.');
  const {error}=await db.from('animeplex_managed_repositories').delete().eq('id',repoId);
  if(error)throw error;
  if(state.activeProviderRepoId===repoId){
    state.activeProviderRepoId=null;
    state.providerCatalog=[];
    state.providerSelection=new Set();
  }
  await loadProviderRepositories(db,state);
}
const count=(n)=>Number(n||0).toLocaleString('en-IN');
const details=(item)=>[item.type,item.lang,item.version,item.detail].filter(Boolean).map(safe).join(' · ');
function picker(state){
  const repo=state.providerRepositories?.find(r=>r.id===state.activeProviderRepoId);
  if(!repo)return '';
  const items=state.providerCatalog||[];
  const query=(state.providerCatalogQuery||'').trim().toLowerCase();
  const filtered=query?items.filter(p=>
    (p.name+' '+p.id+' '+p.type+' '+p.lang).toLowerCase().includes(query)):items;
  const page=Math.min(state.providerCatalogPage||0,Math.max(0,Math.ceil(filtered.length/40)-1));
  const list=filtered.slice(page*40,(page+1)*40);
  const chosen=state.providerSelection||new Set();
  return '<section class="card provider-catalog"><div class="card-head"><div><h2>'+
    safe(repo.label)+' · Select extensions</h2><p class="subtitle">'+safe(typeNames[repo.kind])+
    ' · '+count(items.length)+' discovered · <strong id="provider-selected-count">'+count(chosen.size)+'</strong> selected</p></div>'+
    '<button class="btn btn-ghost btn-sm" data-action="provider-close-catalogue">Close</button></div>'+
    '<div class="card-body"><p class="subtitle">Checked extensions are selected for remote installation; unchecked ones will be removed from this repository\'s managed selection when you save. Installed APKs are not remotely uninstalled.</p>'+
    '<form id="provider-catalog-filter" class="provider-filter"><input class="field" name="query" type="search" placeholder="Search by name, language or ID" value="'+safe(state.providerCatalogQuery||'')+'">'+
    '<button class="btn btn-ghost" type="submit">Search</button></form>'+
    '<div class="provider-select-toolbar"><button class="btn btn-ghost btn-sm" type="button" data-action="provider-select-visible">Select this page</button>'+
    '<button class="btn btn-ghost btn-sm" type="button" data-action="provider-clear-visible">Clear this page</button></div>'+
    (list.length?'<div class="provider-source-list">'+list.map(item=>
      '<label class="provider-source-item"><input type="checkbox" data-provider-source-id="'+safe(item.id)+'"'+(chosen.has(item.id)?' checked':'')+'>'+
      '<span class="provider-source-info"><strong>'+safe(item.name)+'</strong><small>'+safe(item.id)+
      (details(item)?' · '+details(item):'')+'</small></span></label>').join('')+'</div>':
      '<div class="empty">No sources match this search.</div>')+
    '<div class="provider-pagination"><span>'+count(filtered.length)+' matches · Page '+(page+1)+' / '+Math.max(1,Math.ceil(filtered.length/40))+'</span>'+
    '<div><button type="button" class="btn btn-ghost btn-sm" data-action="provider-page-prev"'+(page===0?' disabled':'')+'>Previous</button> '+
    '<button type="button" class="btn btn-ghost btn-sm" data-action="provider-page-next"'+((page+1)*40>=filtered.length?' disabled':'')+'>Next</button></div></div>'+
    '<button class="btn btn-primary" type="button" data-action="provider-save-selection">Save selected extensions</button>'+
    '</div></section>';
}
export function multiProvidersPage(state){
  if(!['owner','admin'].includes(state.member?.role))
    return '<div class="alert warning">Owner/admin permission required.</div>';
  const repos=state.providerRepositories||[];
  const selected=state.managedProviders||[];
  const counts=new Map(repos.map(r=>[r.id,selected.filter(x=>x.repository_id===r.id)]));
  const newKind=state.providerDraftKind||'cloudstream';
  return '<div class="page-head"><div><div class="eyebrow">Seven provider ecosystems</div>'+
    '<h1 class="heading">Provider <span>repositories</span></h1>'+
    '<p class="subtitle">Add a repository, inspect its source catalogue, and choose which extensions to install remotely.</p></div></div>'+
    '<div class="dual-grid"><section class="card"><div class="card-head"><h2>Add repository</h2></div>'+
    '<form class="card-body stack" id="admin-repository-form">'+
    '<label class="label" for="provider-kind">Provider type</label>'+
    '<select class="field" name="kind" id="provider-kind">'+
    PROVIDER_TYPES.map(([id,label])=>'<option value="'+id+'"'+(newKind===id?' selected':'')+'>'+safe(label)+'</option>').join('')+'</select>'+
    '<div class="provider-format-hint" id="provider-format-hint">'+safe(PROVIDER_TYPES.find(x=>x[0]===newKind)?.[2]||'')+'</div>'+
    '<label class="label" for="provider-label">Repository name</label>'+
    '<input class="field" id="provider-label" name="label" required maxlength="120" placeholder="My manga / novel repository">'+
    '<label class="label" for="provider-repo-url">Repository / addon HTTPS URL</label>'+
    '<input class="field" id="provider-repo-url" name="repo_url" required type="url" placeholder="https://.../index.json">'+
    '<button class="btn btn-primary" type="submit">Scan & add repository</button>'+
    '</form></section>'+
    '<section class="card"><div class="card-head"><h2>Repository registry</h2><span class="pill">'+count(repos.length)+' repos</span></div>'+
    '<div class="card-body"><div class="alert">Extension packages run external code on Android. Use trusted repositories only. Selection is a configuration request, not proof of installation on a device; install status is not collected.</div>'+
    (repos.length?repos.map(repo=>{
      const rows=counts.get(repo.id)||[];
      return '<div class="activity-row provider-repo-row"><div class="activity-content"><strong>'+
      safe(repo.label)+'</strong><div class="activity-sub">'+safe(typeNames[repo.kind]||repo.kind)+
      ' · '+count(rows.length)+' selected · '+count(rows.filter(r=>r.enabled&&r.auto_install).length)+' requested for install</div>'+
      '<small class="activity-sub provider-url">'+safe(repo.repo_url)+'</small></div>'+
      '<div class="provider-row-actions"><button class="btn btn-ghost btn-sm" data-action="provider-manage-repo" data-id="'+safe(repo.id)+'">Choose sources</button>'+
      '<button class="btn btn-ghost btn-sm user-delete-btn" data-action="provider-remove-repo" data-id="'+safe(repo.id)+'">Remove</button></div></div>';
    }).join(''):'<div class="empty"><p>No repositories configured. Add one to discover sources.</p></div>')+
    '</div></section></div>'+
    picker(state)+
    (selected.length?'<section class="card provider-selected-table"><div class="card-head"><h2>Selected sources</h2><span class="pill">'+count(selected.length)+'</span></div>'+
    '<div class="admin-data-table"><table><thead><tr><th>Source</th><th>Type</th><th>Install request</th><th>Actions</th></tr></thead><tbody>'+
    selected.map(x=>'<tr><td><strong>'+safe(x.label)+'</strong><small>'+safe(x.plugin_id)+'</small></td>'+
      '<td>'+safe(typeNames[x.kind]||x.kind)+'</td><td>'+(x.enabled&&x.auto_install?'Requested':'Disabled')+'</td>'+
      '<td><button class="btn btn-ghost btn-sm" data-action="toggle-provider" data-id="'+safe(x.id)+'">'+
      (x.enabled?'Disable':'Enable')+'</button>'+
      (x.kind==='cloudstream'&&!x.is_default?
        ' <button class="btn btn-ghost btn-sm" data-action="default-provider" data-id="'+safe(x.id)+'">Default</button>':'')+
      ' <button class="btn btn-ghost btn-sm user-delete-btn" data-action="remove-provider" data-id="'+safe(x.id)+'">Remove</button></td></tr>').join('')+
    '</tbody></table></div></section>':'');
}
export function visibleProviderSources(state){
  const items=state.providerCatalog||[];
  const q=(state.providerCatalogQuery||'').trim().toLowerCase();
  const filtered=q?items.filter(p=>(p.name+' '+p.id+' '+p.type+' '+p.lang).toLowerCase().includes(q)):items;
  return filtered.slice((state.providerCatalogPage||0)*40,((state.providerCatalogPage||0)+1)*40);
}
