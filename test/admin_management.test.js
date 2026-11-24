import test from 'node:test';
import assert from 'node:assert/strict';
import { validateManagedProvider, canManageUsers, usersPage, providersPage,
  setAdminUserSourcesAccess, validateUserEdit, updateAdminUser, deleteAdminUser,
  setAdminUserProvider, setAdminUserBan }
  from '../src/admin_management.js';

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

test('user edit validates display names and emails',()=>{
  assert.deepEqual(validateUserEdit({display_name:' Test Person ',email:'TEST@example.com'}).data,
    {display_name:'Test Person',email:'test@example.com'});
  assert.match(validateUserEdit({display_name:'',email:'test@example.com'}).error,/Display name/);
  assert.match(validateUserEdit({display_name:'Okay',email:'not-an-email'}).error,/email/);
});

test('users list and details offer edit/delete while keeping sources control',()=>{
  const row={id:'u1',display_name:'Test',email:'test@example.com'};
  const base={member:{role:'owner'},userRows:[row],userCount:1,userOffset:0};
  const list=usersPage(base);
  assert.match(list,/data-action="edit-user"/);
  assert.match(list,/data-action="delete-user"/);
  const details=usersPage({...base,userDetail:{user:row,sourcesAccess:false}});
  assert.match(details,/id="admin-user-edit"/);
  assert.match(details,/data-action="toggle-sources-access"/);
  assert.match(details,/typing the exact email/i);
});

test('edit saves only selected account through protected edge function',async()=>{
  const row={id:'u1',display_name:'Old',email:'old@example.com'};
  const state={member:{role:'admin'},userDetail:{user:row,sourcesAccess:false},
    userRows:[row]};
  const calls=[];
  const db={functions:{invoke:async(slug,payload)=>{
    calls.push([slug,payload]);
    return {data:{ok:true,user:{id:'u1',display_name:'New',email:'new@example.com'}},error:null};
  }}};
  await updateAdminUser(db,state,'u1',{display_name:'New',email:'NEW@example.com'});
  assert.equal(calls[0][0],'admin-users');
  assert.deepEqual(calls[0][1].body,{action:'update',userId:'u1',
    displayName:'New',email:'new@example.com'});
  assert.equal(state.userDetail.user.display_name,'New');
  assert.equal(state.userRows[0].email,'new@example.com');
  await assert.rejects(updateAdminUser(db,state,'other',{display_name:'X',
    email:'x@example.com'}),/selected user profile/);
});

test('delete requires matching email and refreshes account list',async()=>{
  const row={id:'u1',email:'test@example.com'};
  const state={member:{role:'owner'},userDetail:{user:row},userRows:[row],
    userSearch:'',userOffset:0,userCount:1};
  const calls=[];
  const db={
    functions:{invoke:async(slug,request)=>{
      calls.push([slug,request.body]);
      return {data:{ok:true,deletedId:'u1'},error:null};
    }},
    rpc:async()=>({data:{users:[],total:0,offset:0},error:null}),
  };
  await assert.rejects(deleteAdminUser(db,state,'u1','wrong@example.com'),/does not match/);
  assert.equal(calls.length,0);
  await deleteAdminUser(db,state,'u1','test@example.com');
  assert.equal(calls[0][1].action,'delete');
  assert.equal(calls[0][1].confirmEmail,'test@example.com');
  assert.equal(state.userDetail,null);
  assert.equal(state.userCount,0);
});

test('non-admin cannot edit or delete users',async()=>{
  const state={member:{role:'release_manager'},userDetail:{user:{id:'u1',email:'a@b.com'}}};
  const db={functions:{invoke:()=>{throw Error('should not invoke');}}};
  await assert.rejects(updateAdminUser(db,state,'u1',{display_name:'X',email:'a@b.com'}),/Owner\/admin/);
  await assert.rejects(deleteAdminUser(db,state,'u1','a@b.com'),/Owner\/admin/);
});

test('account detail displays reported provider and ban controls safely',()=>{
  const state={member:{role:'owner'},userDetail:{
    user:{id:'u1',email:'test@example.com'},
    runtimeControls:{current_provider_id:'cs:movie',provider_locked:true,
      forced_provider_id:'cs:movie',is_banned:false,ban_reason:null,
      available_providers:[{id:'cs:movie',name:'MovieBox <svg>'}]}
  }};
  const page=usersPage(state);
  assert.match(page,/Current source/);
  assert.match(page,/id="admin-user-provider"/);
  assert.match(page,/id="admin-user-ban"/);
  assert.match(page,/cs:movie/);
  assert.match(page,/&lt;svg&gt;/);
  assert.doesNotMatch(page,/<svg>/);
});
test('admin provider control rejects sources not reported installed',async()=>{
  const state={member:{role:'owner'},userDetail:{user:{id:'u1'},
    runtimeControls:{available_providers:[{id:'cs:movie',name:'MovieBox'}]}}};
  const calls=[];
  const db={functions:{invoke:async(_name,{body})=>{
    calls.push(body);return {data:{ok:true,controls:{provider_locked:body.locked}},error:null};
  }}};
  await assert.rejects(setAdminUserProvider(db,state,'u1',{sourceId:'ani:missing',locked:true}),/reported/);
  await setAdminUserProvider(db,state,'u1',{sourceId:'cs:movie',locked:true});
  assert.deepEqual(calls[0],{action:'provider',userId:'u1',sourceId:'cs:movie',locked:true});
  assert.equal(state.userDetail.runtimeControls.provider_locked,true);
});
test('ban requires a reason and unban resets the user state',async()=>{
  const state={member:{role:'admin'},userDetail:{user:{id:'u1'},runtimeControls:{is_banned:false}}};
  const calls=[];
  const db={functions:{invoke:async(_name,{body})=>{
    calls.push(body);
    return {data:{ok:true,controls:{is_banned:body.action==='ban',
      ban_reason:body.reason||null}},error:null};
  }}};
  await assert.rejects(setAdminUserBan(db,state,'u1',true,'x'),/reason/);
  assert.equal(calls.length,0);
  await setAdminUserBan(db,state,'u1',true,'Testing account abuse');
  assert.equal(state.userDetail.runtimeControls.is_banned,true);
  assert.match(usersPage(state),/Testing account abuse/);
  await setAdminUserBan(db,state,'u1',false);
  assert.equal(state.userDetail.runtimeControls.is_banned,false);
  assert.equal(calls[1].action,'unban');
  await assert.rejects(setAdminUserBan(db,{...state,member:{role:'release_manager'}},'u1',true,'reason'),/Owner\/admin/);
});
