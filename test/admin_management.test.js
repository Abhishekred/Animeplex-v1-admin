import test from 'node:test';
import assert from 'node:assert/strict';
import { validateManagedProvider, canManageUsers, usersPage, providersPage,
  setAdminUserSourcesAccess } from '../src/admin_management.js';

const input = {
  label: 'MovieBox', repo_url: 'https://raw.githubusercontent.com/Abhishekred/Stream-1/test/repo.json',
  plugin_id: 'MovieBoxProvider', priority: 10, enabled: true, auto_install: true, is_default: false,
};

test('provider registry accepts multiple trusted CloudStream plugin definitions',()=>{
  const a=validateManagedProvider(input);
  const b=validateManagedProvider({...input,plugin_id:'OtherProvider',priority:20});
  assert.equal(a.error,undefined);
  assert.equal(b.data.priority,20);
  assert.equal(a.data.auto_install,true);
});

test('rejects arbitrary web plugins and malformed settings',()=>{
  for(const repo of ['http://raw.githubusercontent.com/o/r/main/repo.json',
    'https://evil.example/repo.json','https://raw.githubusercontent.com/o/r/../repo.json']) {
    assert.ok(validateManagedProvider({...input,repo_url:repo}).error);
  }
  assert.ok(validateManagedProvider({...input,plugin_id:'../../bad'}).error);
  assert.ok(validateManagedProvider({...input,priority:-1}).error);
});

test('only owner/admin see sensitive dashboard',()=>{
  assert.equal(canManageUsers('owner'),true);
  assert.equal(canManageUsers('admin'),true);
  assert.equal(canManageUsers('release_manager'),false);
  assert.match(usersPage({member:{role:'release_manager'}}),/required/);
  assert.match(providersPage({member:{role:'release_manager'}}),/required/);
});

test('dashboard escapes untrusted usernames and provider metadata',()=>{
  const users=usersPage({member:{role:'owner'},userRows:[{id:'abc',
    email:'<img src=x>', display_name:'<script>alert(1)</script>',
    created_at:null,last_sign_in_at:null}],userCount:1,userOffset:0,userSearch:''});
  assert.doesNotMatch(users,/<script>/);
  assert.match(users,/&lt;script&gt;/);
  const providers=providersPage({member:{role:'owner'},managedProviders:[
    {...input,id:'abc',label:'<iframe>'}]});
  assert.doesNotMatch(providers,/<iframe>/);
  assert.match(providers,/&lt;iframe&gt;/);
});

test('admin can grant and revoke per-user Sources access; never other accounts',async()=>{
  const user={id:'user-1',email:'one@example.com'};
  const state={member:{role:'owner'},userDetail:{user,sourcesAccess:false}};
  const calls=[];
  const db={rpc:async(name,args)=>{
    calls.push([name,args]);return {data:args.p_allowed,error:null};
  }};
  const html=usersPage(state);
  assert.match(html,/Grant Sources access/);
  await setAdminUserSourcesAccess(db,state,'user-1',true);
  assert.equal(state.userDetail.sourcesAccess,true);
  assert.match(usersPage(state),/Revoke access/);
  assert.equal(calls[0][0],'animeplex_admin_set_sources_permission');
  assert.deepEqual(calls[0][1],{p_user_id:'user-1',p_allowed:true});
  await assert.rejects(
    setAdminUserSourcesAccess(db,state,'user-2',true),
    /selected user profile/
  );
  await setAdminUserSourcesAccess(db,state,'user-1',false);
  assert.equal(state.userDetail.sourcesAccess,false);
});
test('non-admin cannot grant Sources access',async()=>{
  const state={member:{role:'release_manager'},userDetail:{user:{id:'user-1'}}};
  await assert.rejects(setAdminUserSourcesAccess({rpc:async()=>({data:true})},state,'user-1',true),/Owner\/admin/);
});
