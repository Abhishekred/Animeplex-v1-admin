import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDER_TYPES, validateProviderRepo, multiProvidersPage,
  addProviderRepository, openProviderCatalogue, saveProviderSelection,
  loadProviderRepositories, removeProviderRepository, visibleProviderSources }
  from '../src/provider_management.js';

const repoUrl='https://raw.githubusercontent.com/owner/repo/main/repo.json';
test('CNC manifest aliases scan and sync under one client-compatible repository URL',()=>{
  const root='https://raw.githubusercontent.com/Abhishekred/CNCVerse-Cloud-Stream-Extension/';
  const validate=(path)=>validateProviderRepo({kind:'cloudstream',label:'CNC',repo_url:root+path});
  for(const path of ['refs/heads/builds/CNC.json','builds/CNC.json','refs/heads/builds/repo.json','builds/repo.json']){
    assert.equal(validate(path).data.repo_url,root+'refs/heads/builds/repo.json');
  }
  assert.ok(validate('refs/heads/builds/CNC.json?token=value').error);
  assert.ok(validate('other/CNC.json').error);
});
test('seven ecosystems offered in provider dropdown',()=>{
  assert.deepEqual(PROVIDER_TYPES.map(x=>x[0]),[
    'cloudstream','mangayomi','zangetsu','stremio','aniyomi','mihon','lnreader'
  ]);
  const html=multiProvidersPage({member:{role:'owner'}});
  for(const [,title] of PROVIDER_TYPES)assert.match(html,new RegExp(title));
});
test('validates repository kinds and public HTTPS URLs',()=>{
  assert.equal(validateProviderRepo({kind:'cloudstream',repo_url:repoUrl,label:'Stream'}).error,undefined);
  assert.equal(validateProviderRepo({kind:'lnreader',
    repo_url:'https://raw.githubusercontent.com/x/y/main/plugins.min.json',label:'Novel'}).error,undefined);
  assert.match(validateProviderRepo({kind:'stremio',label:'Hi',
    repo_url:'http://localhost/manifest.json'}).error,/public HTTPS/);
  assert.match(validateProviderRepo({kind:'cloudstream',label:'Wrong',
    repo_url:'https://example.com/repo.json'}).error,/CloudStream/);
  assert.match(validateProviderRepo({kind:'nope',repo_url:repoUrl,label:'Wrong'}).error,/supported/);
});
test('escapes repo and catalog source labels',()=>{
  const html=multiProvidersPage({member:{role:'admin'},providerRepositories:[
    {id:'one',kind:'mihon',label:'<img src=x>',repo_url:'https://example.org/index.json'}
  ],managedProviders:[],activeProviderRepoId:'one',providerCatalog:[
    {id:'pkg.test',name:'<script>alert(1)</script>',lang:'en',type:'apk'}
  ],providerSelection:new Set()});
  assert.doesNotMatch(html,/<script>|<img src=x>/);
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/&lt;img src=x&gt;/);
  assert.match(html,/Save selected extensions/);
});
test('non-admin cannot list, add, delete or discover catalogs',async()=>{
  const state={member:{role:'release_manager'}};
  await assert.rejects(loadProviderRepositories({},state),/Owner\/admin/);
  await assert.rejects(addProviderRepository({},state,{}),/Owner\/admin/);
  await assert.rejects(openProviderCatalogue({},state,'abc'),/Owner\/admin/);
  await assert.rejects(removeProviderRepository({},state,'abc'),/Owner\/admin/);
  assert.match(multiProvidersPage(state),/permission required/);
});
test('adding a repository scans catalog, saves registry, but never auto-selects',async()=>{
  const calls=[];
  const repos=[{id:'one',kind:'mangayomi',repo_url:'https://example.org/index.json',label:'Test',enabled:true}];
  const db={
    functions:{invoke:async(name,args)=>{
      calls.push([name,args]);
      return {data:{ok:true,items:[{id:'a',name:'Alpha',type:'manga',lang:'en'},
        {id:'b',name:'Beta',type:'novel',lang:'en'}]},error:null};
    }},
    from:(table)=>({
      upsert:()=>({select:()=>({single:async()=>({data:repos[0],error:null})})}),
      select:()=>({order:async()=>({data:table==='animeplex_managed_repositories'?repos:[],error:null})})
    })
  };
  const state={member:{role:'owner'}};
  const n=await addProviderRepository(db,state,{
    kind:'mangayomi',repo_url:repos[0].repo_url,label:'Test'});
  assert.equal(n,2);assert.equal(calls[0][0],'provider-catalog');
  assert.equal(state.providerSelection.size,0);
  assert.equal(state.activeProviderRepoId,'one');
});
test('selection saves only checked IDs through transactional authenticated RPC',async()=>{
  const state={
    member:{role:'owner'},activeProviderRepoId:'one',
    providerRepositories:[{id:'one',kind:'mihon'}],
    providerCatalog:[{id:'a',name:'Alpha',type:'manga',version:'1.0'},
      {id:'b',name:'Beta',type:'manga',version:'1.0'}],
    providerSelection:new Set(['b']),
  };
  const calls=[];
  const db={
    rpc:async(name,args)=>{calls.push([name,args]);return {data:1,error:null}},
    from:(table)=>({
      select:()=>({order:async()=>({data:table==='animeplex_managed_repositories'?
        state.providerRepositories:[],error:null})}),
    }),
  };
  assert.deepEqual(visibleProviderSources(state).map(x=>x.id),['a','b']);
  assert.equal(await saveProviderSelection(db,state),1);
  assert.equal(calls[0][0],'animeplex_admin_set_repo_sources');
  assert.deepEqual(calls[0][1].p_items,[{id:'b',name:'Beta',type:'manga',lang:undefined,version:'1.0'}]);
});
test('repo removal requires an existing selected repo',async()=>{
  const s={member:{role:'admin'},providerRepositories:[]};
  await assert.rejects(removeProviderRepository({},s,'not-found'),/not found/);
});
