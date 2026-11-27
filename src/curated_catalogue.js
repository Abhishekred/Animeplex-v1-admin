import { escapeHtml as esc } from './utils.js';

const table = 'animeplex_curated_titles';
const metadata = 'https://v3-cinemeta.strem.io';
const kinds = ['series', 'movie'];
const key = row => row.kind + ':' + row.tmdb_id;
const kindName = kind => kind === 'series' ? 'Web series' : 'Movie';
const image = row => '<img loading="lazy" alt="" width="48" height="72" style="object-fit:cover;border-radius:6px" src="'+esc(row.poster_url)+'">';

export function providerOrder(form) {
  const providers = form.getAll('provider').map(id => String(id).trim()).filter(Boolean);
  if (!providers.length || providers.length > 4 || providers.some(p => p.length > 220) ||
      new Set(providers).size !== providers.length) {
    throw Error('Choose one to four different providers in playback order.');
  }
  return providers;
}

export async function loadCurated(db, state) {
  const choices = await db.rpc('animeplex_catalogue_provider_options');
  if (choices.error) throw choices.error;
  const rows = [];
  for (let start = 0; ; start += 500) {
    const page = await db.from(table).select('*').order('kind').order('sort_order')
      .order('tmdb_id').range(start, start + 499);
    if (page.error) throw page.error;
    rows.push(...page.data);
    if (page.data.length < 500) break;
  }
  state.curatedRows = rows;
  state.curatedChoices = choices.data || [];
}

async function json(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw Error('Title search is unavailable. Please retry.');
  return response.json();
}

export async function searchCurated(state, form) {
  const query = String(form.get('query') || '').trim();
  const kind = form.get('kind');
  if (!query || !kinds.includes(kind)) throw Error('Enter a title and choose a section.');
  state.curatedQuery = query;
  state.curatedKind = kind;
  const {metas} = await json(metadata+'/catalog/'+kind+'/top/search='+encodeURIComponent(query)+'.json');
  if (!Array.isArray(metas)) throw Error('Invalid title search response.');
  state.curatedHits = metas.filter(m => /^tt\d+$/.test(m.id) && m.name && /^https:\/\//.test(m.poster))
    .map(m => ({ imdb: m.id, kind, title:m.name, poster_url:m.poster,
      release_year:String(m.releaseInfo || '').match(/^\d{4}/)?.[0] || '' }));
}

export async function pickCurated(state, imdb) {
  const hit = state.curatedHits?.find(x => x.imdb === imdb);
  if (!hit) throw Error('Search again to select this title.');
  const {meta} = await json(metadata+'/meta/'+hit.kind+'/'+hit.imdb+'.json');
  const id = Number(meta?.moviedb_id);
  if (meta?.id !== imdb || !Number.isSafeInteger(id) || id <= 0) throw Error('This result has no matching TMDB title. Choose another result.');
  state.curatedDraft = state.curatedRows.find(row => row.kind === hit.kind && row.tmdb_id === id) ||
    {...hit, tmdb_id:id, sort_order:0, provider_ids:[]};
}

export async function publishCurated(db, state, form) {
  const row = state.curatedDraft;
  if (!row) throw Error('Select a title first.');
  const sort = Number(form.get('sort_order'));
  if (!Number.isSafeInteger(sort) || sort < 0) throw Error('Enter a non-negative display order.');
  const data = {kind:row.kind, tmdb_id:row.tmdb_id, title:row.title, poster_url:row.poster_url,
    release_year:row.release_year, sort_order:sort, provider_ids:providerOrder(form)};
  const {error} = await db.from(table).upsert(data, {onConflict:'kind,tmdb_id'});
  if (error) throw error;
  state.curatedDraft = null;
  await loadCurated(db,state);
}

export async function removeCurated(db,state,id) {
  const row = state.curatedRows.find(r => key(r) === id);
  if (!row || !window.confirm('Remove '+row.title+' from the app catalogue?')) return;
  const {error} = await db.from(table).delete().eq('kind',row.kind).eq('tmdb_id',row.tmdb_id);
  if (error) throw error;
  if (state.curatedDraft && key(state.curatedDraft) === id) state.curatedDraft = null;
  await loadCurated(db,state);
}

export function curatedPage(state) {
  const draft = state.curatedDraft;
  const button = (action,id,label) => '<button type="button" class="btn btn-ghost btn-sm" data-curated="'+action+'" data-id="'+esc(id)+'">'+label+'</button>';
  const item = (row,actions) => '<div class="catalogue-entry">'+image(row)+'<div><strong>'+esc(row.title)+'</strong><br><small>'+esc(kindName(row.kind)+' · '+(row.release_year || 'Year unknown'))+'</small></div><div>'+actions+'</div></div>';
  const list = state.curatedRows || [];
  return '<div class="page-head"><h1 class="heading">AnimePlex Catalogue</h1></div>'+
    '<section class="card"><div class="card-head"><h2>Find a title</h2></div><div class="card-body">'+
    '<form id="curated-search" class="provider-filter"><select name="kind" class="field">'+kinds.map(k=>'<option value="'+k+'" '+(state.curatedKind===k?'selected':'')+'>'+kindName(k)+'</option>').join('')+
    '</select><input name="query" class="field" type="search" maxlength="150" required placeholder="Title name" value="'+esc(state.curatedQuery||'')+'"><button class="btn btn-primary">Search</button></form>'+
    (state.curatedHits?.map(r=>item(r,button('pick',r.imdb,'Select'))).join('') ?? '')+
    (state.curatedHits?.length===0?'<p>No matching titles with posters.</p>':'')+'</div></section>'+
    (draft?'<section class="card"><div class="card-head"><h2>Edit selection</h2></div><form id="curated-publish" class="card-body">'+item(draft,'')+
    '<datalist id="catalogue-provider-ids">'+(state.curatedChoices||[]).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name||p.id)+'</option>').join('')+'</datalist>'+
    '<p>Choose a reported provider or enter its exact installed source ID.</p>'+
    Array.from({length:4},(_,i)=>'<label class="field-label">'+(i===0?'Primary provider':'Fallback '+i)+'<input class="field" name="provider" list="catalogue-provider-ids" maxlength="220" '+(i===0?'required':'')+' value="'+esc(draft.provider_ids[i]||'')+'"></label>').join('')+
    '<label class="field-label">Display order (lowest first)<input name="sort_order" class="field" type="number" min="0" max="2147483647" required value="'+draft.sort_order+'"></label>'+
    '<button class="btn btn-primary">Publish title</button> '+button('cancel','','Cancel')+'</form></section>':'')+
    kinds.map(k=>'<section class="card"><div class="card-head"><h2>'+(k==='movie'?'Movies':'Web Series')+'</h2></div><div class="card-body">'+
      (list.filter(r=>r.kind===k).map(r=>item(r,button('edit',key(r),'Edit')+button('remove',key(r),'Remove'))).join('') || '<p>No published titles.</p>')+'</div></section>').join('');
}

export async function handleCuratedAction(action,id,db,state) {
  if (action==='pick') await pickCurated(state,id);
  if (action==='edit') state.curatedDraft=state.curatedRows.find(r=>key(r)===id);
  if (action==='remove') await removeCurated(db,state,id);
  if (action==='cancel') state.curatedDraft=null;
}
