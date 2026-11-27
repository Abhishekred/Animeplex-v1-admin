import { escapeHtml as esc } from './utils.js';

const table = 'animeplex_curated_titles';
const defaultsTable = 'animeplex_catalogue_defaults';
const pageSize = 12;
const metadata = 'https://v3-cinemeta.strem.io';
const kinds = ['series', 'movie'];
const key = row => row.kind + ':' + row.tmdb_id;
const kindName = kind => kind === 'series' ? 'Web series' : 'Movie';
const image = row => '<img loading="lazy" alt="" width="48" height="72" style="object-fit:cover;border-radius:6px" src="'+esc(row.poster_url)+'">';

export function providerOrder(form) {
  const providers = form.getAll('provider').map(id => String(id).trim()).filter(Boolean);
  if (!providers.length || providers.some(p => p.length > 220) ||
      new Set(providers).size !== providers.length) {
    throw Error('Enter at least one provider. Use each ID once, with up to 220 characters.');
  }
  return providers;
}

export async function loadCurated(db, state) {
  const [choices, defaults] = await Promise.all([
    db.rpc('animeplex_catalogue_provider_options'),
    db.from(defaultsTable).select('provider_ids').eq('singleton',true).single(),
  ]);
  if (defaults.error) throw defaults.error;
  if (choices.error) throw choices.error;
  const rows = [];
  for (let start = 0; ; start += 500) {
    const page = await db.from(table).select('*').order('kind').order('sort_order')
      .order('tmdb_id').range(start, start + 499);
    if (page.error) throw page.error;
    rows.push(...page.data);
    if (page.data.length < 500) break;
  }
  state.curatedDefaults = defaults.data.provider_ids;
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
  const score = Number.parseFloat(meta.imdbRating);
  const artwork = {backdrop_url:/^https:\/\//.test(meta.background || '') ? meta.background : '',
    rating:Number.isFinite(score) && score >= 0 && score <= 10 ? score : null};
  state.curatedDraft = state.curatedRows.find(row => row.kind === hit.kind && row.tmdb_id === id) ||
    {...hit, ...artwork, tmdb_id:id, sort_order:0, language_badge:'Hindi', provider_ids:null};
}

export function presentationFields(form, rows) {
  const entered = String(form.get('platform') || '').trim();
  const platform = rows.find(row => row.platform && row.platform.toLowerCase() === entered.toLowerCase())?.platform || entered;
  const language_badge = String(form.get('language_badge') || '').trim();
  const backdrop_url = String(form.get('backdrop_url') || '').trim();
  const score = String(form.get('rating') ?? '').trim();
  const rating = score === '' ? null : Number(score);
  if (platform.length > 60 || language_badge.length > 24) throw Error('Platform or language badge is too long.');
  if (backdrop_url && (new URL(backdrop_url).protocol !== 'https:' || backdrop_url.length > 2048)) throw Error('Use an HTTPS banner image URL.');
  if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 10)) throw Error('Rating must be between 0 and 10.');
  return {platform, language_badge, backdrop_url, rating, trending:form.has('trending')};
}

export async function publishCurated(db, state, form) {
  const row = state.curatedDraft;
  if (!row) throw Error('Select a title first.');
  const sort = Number(form.get('sort_order'));
  if (!Number.isSafeInteger(sort) || sort < 0) throw Error('Enter a non-negative display order.');
  const data = {kind:row.kind, tmdb_id:row.tmdb_id, title:row.title, poster_url:row.poster_url,
    release_year:row.release_year, sort_order:sort, provider_ids:form.get('provider_mode') === 'universal' ? null : providerOrder(form),
    ...presentationFields(form,state.curatedRows)};
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

export async function applyCatalogueProviders(db, state, form) {
  const order = providerOrder(form);
  const {error} = await db.from(defaultsTable).update({provider_ids: order})
    .eq('singleton',true).select('singleton').single();
  if (error) throw error;
  state.curatedDraft = null;
  await loadCurated(db,state);
}

function providerField(index, id = '') {
  const label = index === 0 ? 'Primary provider' : 'Fallback '+index;
  return '<label class="field-label">'+label+'<input class="field" name="provider" list="catalogue-provider-ids" maxlength="220" '+
    (index===0?'required ':'')+'value="'+esc(id)+'"></label>';
}

function providerFields(ids) {
  const fields = Array.from({length:Math.max(11, ids.length)}, (_,i)=>providerField(i,ids[i])).join('');
  return '<div class="catalogue-fields" data-provider-order>'+fields+'</div>'+
    '<button type="button" class="btn btn-ghost btn-sm" data-add-fallback>+ Add fallback</button>';
}

export function addFallback(button) {
  const fields = button.previousElementSibling;
  fields.insertAdjacentHTML('beforeend', providerField(fields.children.length));
  fields.lastElementChild.querySelector('input').focus();
}

function button(action,id,label) {
  return '<button type="button" class="btn btn-ghost btn-sm" data-curated="'+action+'" data-id="'+esc(id)+'">'+label+'</button>';
}

function item(row,actions) {
  return '<div class="catalogue-entry">'+image(row)+'<div><strong>'+esc(row.title)+'</strong><br><small>'+
    esc(kindName(row.kind)+' · '+(row.release_year || 'Year unknown'))+'</small></div><div class="catalogue-entry-actions">'+actions+'</div></div>';
}

export function publishedColumns(state) {
  const query=(state.curatedFilter || '').trim().toLowerCase();
  return ['movie','series'].map(kind => {
    const rows=(state.curatedRows || []).filter(r=>r.kind===kind && r.title.toLowerCase().includes(query));
    const count=rows.length;
    const pages=Math.max(1,Math.ceil(count/pageSize));
    const page=Math.min(pages-1,Math.max(0,state.curatedPages?.[kind] || 0));
    const name=kind==='movie'?'Movies':'Web Series';
    const cards=rows.slice(page*pageSize,(page+1)*pageSize)
      .map(r=>item(r,button('edit',key(r),'Edit')+button('remove',key(r),'Remove'))).join('');
    const pager=(dir,label,disabled)=>'<button type="button" class="btn btn-sm" data-catalogue-page="'+(page+dir)+
      '" data-kind="'+kind+'" aria-label="'+label+' '+name+'" '+(disabled?'disabled':'')+'>'+label+'</button>';
    return '<section class="card catalogue-column" data-kind="'+kind+'"><div class="card-head"><h2>'+name+
      '</h2><span class="muted">'+count+'</span></div><div class="card-body">'+
      (cards || '<p>'+(query?'No matching titles.':'No published titles yet.')+'</p>')+
      (pages>1?'<div class="provider-pagination">'+pager(-1,'Previous',page===0)+'<span>Page '+(page+1)+' of '+pages+'</span>'+
        pager(1,'Next',page+1===pages)+'</div>':'')+'</div></section>';
  }).join('');
}

export function curatedPage(state) {
  if (state.curatedLoading) return '<div class="page-head"><h1 class="heading">AnimePlex Catalogue</h1></div><p role="status">Loading catalogue…</p>';
  const draft = state.curatedDraft;
  const list = state.curatedRows || [];
  const defaults=state.curatedDefaults || [];
  const universal=!draft?.provider_ids || JSON.stringify(draft.provider_ids)===JSON.stringify(defaults);
  const mobileKind=state.curatedMobileKind || 'movie';
  return '<div class="page-head"><h1 class="heading">AnimePlex Catalogue</h1></div>'+
    '<datalist id="catalogue-provider-ids">'+(state.curatedChoices||[]).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name||p.id)+'</option>').join('')+'</datalist>'+
    '<details class="card catalogue-tool"><summary>AnimePlex Provider</summary><form id="curated-defaults" class="card-body">'+
    '<p>Set the playback order for all movies and web series, including new titles. Applying again replaces individual provider orders.</p>'+
    providerFields(defaults)+'<button class="btn btn-primary">Apply to all titles</button></form></details>'+
    '<details class="card catalogue-tool" '+(state.curatedQuery?'open':'')+'><summary>Add a title</summary><div class="card-body">'+
    '<form id="curated-search" class="provider-filter"><select name="kind" class="field">'+kinds.map(k=>'<option value="'+k+'" '+(state.curatedKind===k?'selected':'')+'>'+kindName(k)+'</option>').join('')+
    '</select><input name="query" class="field" type="search" maxlength="150" required placeholder="Title name" value="'+esc(state.curatedQuery||'')+'"><button class="btn btn-primary">Search</button></form>'+
    (state.curatedHits?.map(r=>item(r,button('pick',r.imdb,'Select'))).join('') ?? '')+
    (state.curatedHits?.length===0?'<p>No matching titles with posters.</p>':'')+'</div></details>'+
    (draft?'<section class="card"><div class="card-head"><h2>Edit selection</h2></div><form id="curated-publish" class="card-body">'+item(draft,'')+
    '<label class="field-label">Platform<input class="field" name="platform" list="catalogue-platforms" maxlength="60" placeholder="e.g. Prime Video" value="'+esc(draft.platform||'')+'"></label>'+
    '<datalist id="catalogue-platforms">'+[...new Set(list.map(r=>r.platform).filter(Boolean))].map(p=>'<option value="'+esc(p)+'"></option>').join('')+'</datalist>'+
    '<label class="field-label">Language badge<input class="field" name="language_badge" maxlength="24" placeholder="Hindi, Multi…" value="'+esc(draft.language_badge||'')+'"></label>'+
    '<label><input name="trending" type="checkbox" '+(draft.trending?'checked':'')+'> Show in Trending</label>'+
    '<label class="field-label">Trending banner image<input class="field" type="url" name="backdrop_url" maxlength="2048" placeholder="HTTPS image URL" value="'+esc(draft.backdrop_url||'')+'"></label>'+
    '<label class="field-label">Movie rating (0–10)<input class="field" name="rating" type="number" min="0" max="10" step="0.1" value="'+esc(draft.rating??'')+'"></label>'+
    '<label class="field-label">Playback order<select class="field" name="provider_mode" id="catalogue-provider-mode">'+
    '<option value="universal" '+(universal?'selected':'')+'>Use AnimePlex Provider</option><option value="custom" '+(universal?'':'selected')+'>Custom for this title</option></select></label>'+
    '<fieldset id="catalogue-custom" '+(universal?'disabled hidden':'')+'><legend>Title providers</legend>'+
    providerFields(draft.provider_ids || defaults)+'</fieldset>'+
    '<label class="field-label">Display order (lowest first)<input name="sort_order" class="field" type="number" min="0" max="2147483647" required value="'+draft.sort_order+'"></label>'+
    '<button class="btn btn-primary">Publish title</button> '+button('cancel','','Cancel')+'</form></section>':'')+
    '<label class="catalogue-filter">Search published titles<input class="field" type="search" id="catalogue-filter" placeholder="Search movies and web series" value="'+esc(state.curatedFilter || '')+'"></label>'+
    '<div class="catalogue-switch" role="group" aria-label="Published section">'+['movie','series'].map(k=>
      '<button type="button" class="btn" data-catalogue-kind="'+k+'" aria-pressed="'+(mobileKind===k)+'">'+(k==='movie'?'Movies':'Web Series')+'</button>').join('')+'</div>'+
    '<div id="catalogue-columns" class="catalogue-columns" data-mobile-kind="'+mobileKind+'">'+publishedColumns(state)+'</div>';
}

export async function handleCuratedAction(action,id,db,state) {
  if (action==='pick') await pickCurated(state,id);
  if (action==='edit') state.curatedDraft=state.curatedRows.find(r=>key(r)===id);
  if (action==='remove') await removeCurated(db,state,id);
  if (action==='cancel') state.curatedDraft=null;
}
