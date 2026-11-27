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
