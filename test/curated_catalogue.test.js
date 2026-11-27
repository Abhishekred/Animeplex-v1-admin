import test from 'node:test';
import assert from 'node:assert/strict';
import { providerOrder, searchCurated, pickCurated } from '../src/curated_catalogue.js';

test('provider order preserves priority and refuses repeated or missing providers', () => {
  const form = new FormData();
  assert.throws(() => providerOrder(form));
  form.append('provider','cs:AniVortex');
  form.append('provider','');
  form.append('provider','VegaMovies');
  assert.deepEqual(providerOrder(form), ['cs:AniVortex','VegaMovies']);
  form.append('provider','cs:AniVortex');
  assert.throws(() => providerOrder(form));
});

test('picking a search result uses its section, poster and confirmed TMDB identity', async t => {
  const state={curatedRows:[]}, form = new FormData();
  form.set('query','Farzi'); form.set('kind','series');
  const item={id:'tt15477488',type:'series',name:'Farzi',poster:'https://example.com/poster',releaseInfo:'2023'};
  t.mock.method(globalThis,'fetch',async url=>({ok:true,json:async()=>url.includes('/catalog/')?{metas:[item]}:{meta:{...item,moviedb_id:156016}}}));
  await searchCurated(state,form);
  await pickCurated(state,item.id);
  assert.equal(state.curatedDraft.poster_url,item.poster);
  assert.equal(state.curatedDraft.tmdb_id,156016);
  assert.equal(state.curatedDraft.kind,'series');
});

test('catalogue presentation retains platform spelling and optional badges', async () => {
  const { presentationFields } = await import('../src/curated_catalogue.js');
  const form = new FormData();
  form.set('platform', ' prime video ');
  form.set('language_badge','Hindi');
  form.set('rating','8.3');
  form.set('trending','on');
  const value = presentationFields(form,[{platform:'Prime Video'}]);
  assert.deepEqual(value,{platform:'Prime Video',language_badge:'Hindi',rating:8.3,trending:true,backdrop_url:''});
  assert.equal(presentationFields(new FormData(),[]).rating,null);
  form.set('rating','15');
  assert.throws(()=>presentationFields(form,[]));
});

test('published search filters both sections and pages each one independently', async () => {
  const {publishedColumns}=await import('../src/curated_catalogue.js');
  const make=(kind,i)=>({kind,tmdb_id:i,title:'Title '+i,poster_url:'https://example.com/p.jpg'});
  const state={curatedRows:[...Array.from({length:14},(_,i)=>make('movie',i)),make('series',90)]};
  assert.match(publishedColumns(state),/data-id="movie:0"/);
  assert.doesNotMatch(publishedColumns(state),/data-id="movie:13"/);
  state.curatedPages={movie:1};
  let html=publishedColumns(state);
  assert.match(html,/data-id="movie:13"/);
  assert.match(html,/data-id="series:90"/);
  state.curatedFilter=' TITLE 90 ';
  html=publishedColumns(state);
  assert.match(html,/No matching titles/);
  assert.match(html,/data-id="series:90"/);
  assert.doesNotMatch(html,/data-id="movie:/);
});
