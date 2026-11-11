import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, Check,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  Cloud, Database, DownloadCloud, FileClock, Film, Gauge, HardDrive,
  LayoutDashboard, LifeBuoy, LockKeyhole, LogOut, Menu, MessageSquareText,
  Moon, MoreHorizontal, Package, Plus, RadioTower, Search, Server, Settings,
  Shield, ShieldCheck, Smartphone, Sparkles, UploadCloud, Users, Wifi, X,
  Zap, RefreshCw, Ban, UserCheck, Trash2, ExternalLink, SlidersHorizontal,
  ClipboardList, KeyRound
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createSHA256 } from "hash-wasm";
import { isSupabaseConfigured, supabase } from "./lib/supabase.js";

const NAV = [
  { label:"WORKSPACE", items:[["Overview",LayoutDashboard],["Users",Users],["Devices",Smartphone],["Content",Film],["Announcements",MessageSquareText]] },
  { label:"DISTRIBUTION", items:[["OTA Updates",DownloadCloud],["Release Channels",RadioTower],["App Configuration",Settings]] },
  { label:"INFRASTRUCTURE", items:[["System Health",Activity],["Backups",Database],["Logs & Audit",FileClock]] },
  { label:"ADMINISTRATION", items:[["Admin Access",ShieldCheck],["Settings",SlidersHorizontal]] },
];
const EMPTY = { stats:{users:0,activeAnnouncements:0,backupAccounts:0,admins:0}, releases:[], backups:[], activity:[] };
const ROLES = ["owner","admin","release_manager","moderator","auditor"];
const fmt = value => value ? new Date(value).toLocaleString() : "—";
const shortId = value => value ? value.slice(0,8)+"…" : "—";

function IconButton({children,label,onClick}) { return <button className="icon-button" aria-label={label} title={label} onClick={onClick}>{children}</button>; }

export default function App() {
  const [session,setSession] = useState(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [active,setActive] = useState("Overview");
  const [role,setRole] = useState("");
  const [sidebarOpen,setSidebarOpen] = useState(false);
  const [dark,setDark] = useState(true);
  const [query,setQuery] = useState("");
  const [toast,setToast] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [data,setData] = useState(EMPTY);
  const [moduleData,setModuleData] = useState([]);
  const [modal,setModal] = useState("");
  const [selected,setSelected] = useState(null);

  const notify = useCallback(message => { setToast(message); window.setTimeout(()=>setToast(""),3500); },[]);
  const api = useCallback(async (resource,method="GET",body=null,params="") => {
    if (!session?.access_token) throw new Error("Please sign in again.");
    const response = await fetch("/api/admin/"+resource+params,{
      method,headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
      ...(body ? {body:JSON.stringify(body)} : {})
    });
    const payload = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(payload.error || "Request failed ("+response.status+").");
    return payload;
  },[session]);

  useEffect(()=>{
    if (!isSupabaseConfigured) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthLoading(false);});
    const {data:listener}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
    return ()=>listener.subscription.unsubscribe();
  },[]);

  const refresh = useCallback(async()=>{
    if (!session) return;
    setBusy(true);setError("");
    try {
      const result=await api("dashboard");
      setData(result);
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  },[api,session]);
  useEffect(()=>{refresh();},[refresh]);

  const loadModule = useCallback(async(name)=>{
    setBusy(true);setError("");setModuleData([]);
    try {
      let result={};
      if(name==="Users") result=await api("users", "GET", null, "?page=1&limit=30");
      else if(name==="OTA Updates"||name==="Release Channels") result=await api("releases");
      else if(name==="Announcements") result=await api("announcements");
      else if(name==="App Configuration"||name==="Settings") result=await api("config");
      else if(name==="Backups") result=await api("backups");
      else if(name==="Logs & Audit") result=await api("audit");
      else if(name==="Admin Access") result=await api("admins");
      else if(name==="System Health") result=await api("health");
      setModuleData(result.users||result.releases||result.announcements||result.settings||result.backups||result.events||result.admins||result.services||[]);
      if(name==="Users") setModuleData(result.users||[]);
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  },[api]);
  useEffect(()=>{if(session&&active!=="Overview"&&active!=="Devices"&&active!=="Content")loadModule(active);},[session,active,loadModule]);

  const filteredNav=useMemo(()=>NAV.map(g=>({...g,items:g.items.filter(([n])=>n.toLowerCase().includes(query.toLowerCase()))})).filter(g=>g.items.length),[query]);
  const go=name=>{setActive(name);setSidebarOpen(false);setError("");};

  async function signIn(email,password) {
    setBusy(true);setError("");
    const {error}=await supabase.auth.signInWithPassword({email,password});
    if(error)setError(error.message);
    setBusy(false);
  }
  async function signOut(){await supabase.auth.signOut();setSession(null);setRole("");setData(EMPTY);}

  useEffect(()=>{
    if(!session)return;
    const token=session.access_token;
    fetch("/api/admin/dashboard",{headers:{Authorization:"Bearer "+token}})
      .then(r=>r.json().then(d=>({r,d}))).then(({r,d})=>{if(r.ok)setRole(d.role||"");});
  },[session]);

  if(!isSupabaseConfigured) return <SetupScreen/>;
  if(authLoading) return <div className="auth-screen"><div className="auth-card"><div className="brand-mark"><span>A</span></div><p>Loading secure session…</p></div></div>;
  if(!session) return <LoginScreen onSubmit={signIn} busy={busy} error={error}/>;

  const intro={
    "Overview":"Your AnimePlex ecosystem at a glance.",
    "Users":"Review accounts, access status and sign-in activity.",
    "Devices":"Connected-device inventory will appear after device telemetry is added.",
    "Content":"Manage app content sources and provider configuration.",
    "Announcements":"Publish messages that can be consumed by the mobile app.",
    "OTA Updates":"Upload, stage and distribute Android releases.",
    "Release Channels":"Manage Stable, Beta and Testing release streams.",
    "App Configuration":"Change supported remote settings and feature flags.",
    "System Health":"Check the database and admin service dependencies.",
    "Backups":"Review backup metadata without exposing user backup payloads.",
    "Logs & Audit":"Review administrative actions and security events.",
    "Admin Access":"Grant roles and manage administrator access.",
    "Settings":"Manage your dashboard session and preferences."
  }[active]||"Manage your AnimePlex platform.";
  const stats=[
    {label:"Total users",value:data.stats.users.toLocaleString(),note:"Supabase auth profiles",icon:Users,tone:"violet"},
    {label:"Active announcements",value:data.stats.activeAnnouncements,note:"Currently enabled",icon:MessageSquareText,tone:"green"},
    {label:"Backup accounts",value:data.stats.backupAccounts,note:"Metadata records",icon:Database,tone:"blue"},
    {label:"Active admins",value:data.stats.admins,note:"Privileged accounts",icon:ShieldCheck,tone:"orange"}
  ];

  return <div className={dark?"app-shell dark":"app-shell light"}>
    <aside className={sidebarOpen?"sidebar sidebar-open":"sidebar"}>
      <div className="brand"><div className="brand-mark"><span>A</span><i/></div><div className="brand-copy"><strong>ANIMEPLEX</strong><small>CONTROL CENTER</small></div><button className="mobile-close" onClick={()=>setSidebarOpen(false)}><X size={18}/></button></div>
      <div className="workspace-switch"><div className="workspace-icon">AP</div><div><strong>AnimePlex</strong><small>Production workspace</small></div><ChevronDown size={15} className="muted"/></div>
      <div className="nav-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a page…"/><kbd>⌘ K</kbd></div>
      <nav className="navigation">{filteredNav.map(group=><div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(([name,Icon])=><button key={name} className={active===name?"nav-item active":"nav-item"} onClick={()=>go(name)}><Icon size={17}/><span>{name}</span>{name==="OTA Updates"&&<i className="nav-dot"/>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><LifeBuoy size={17}/></div><strong>Admin guide</strong><p>Setup, roles, OTA publishing and recovery notes.</p><button onClick={()=>window.open("https://github.com/Abhishekred/Animeplex-v1-admin/blob/main/docs/ADMIN_SETUP.md","_blank")}>Open documentation <ExternalLink size={12}/></button></div><div className="profile-row"><div className="avatar">{(session.user.email||"AD").slice(0,2).toUpperCase()}</div><div className="profile-copy"><strong>{session.user.email}</strong><small>{role||"Verified admin session"}</small></div><IconButton label="Sign out" onClick={signOut}><LogOut size={16}/></IconButton></div></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={()=>setSidebarOpen(true)}><Menu size={19}/></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14}/><strong>{active}</strong></div></div><div className="topbar-actions"><div className="environment"><i/> Connected session</div><IconButton label="Refresh data" onClick={()=>active==="Overview"?refresh():loadModule(active)}><RefreshCw size={16}/></IconButton><IconButton label="Toggle theme" onClick={()=>setDark(!dark)}>{dark?<Moon size={17}/>:<Sparkles size={17}/>}</IconButton><span className="top-divider"/><div className="top-avatar">{(session.user.email||"AD").slice(0,2).toUpperCase()}</div></div></header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> CONTROL CENTER</div><h1>{active==="Overview"?"Dashboard overview":active}</h1><p>{intro}</p></div><div className="heading-actions"><button className="button button-quiet" onClick={()=>active==="Overview"?refresh():loadModule(active)}><Activity size={15}/> {busy?"Syncing…":"Refresh"} <span className="live-pulse"/></button>{(active==="Overview"||active==="OTA Updates")&&<button className="button button-primary" onClick={()=>{setSelected(null);setModal(active==="Overview"?"release":"release");}}><Plus size={16}/> New release</button>}{active==="Announcements"&&<button className="button button-primary" onClick={()=>{setSelected(null);setModal("announcement");}}><Plus size={16}/> New announcement</button>}</div></div>
        {error&&<div className="error-banner"><AlertTriangle size={16}/><span>{error}</span><button onClick={()=>setError("")}><X size={14}/></button></div>}
        {active==="Overview"?<Overview stats={stats} data={data} go={go} busy={busy}/>:
          active==="OTA Updates"||active==="Release Channels"?<ReleasesPage releases={moduleData} setModal={setModal} setSelected={setSelected} api={api} refresh={()=>loadModule(active)} notify={notify} channelOnly={active==="Release Channels"}/>:
          active==="Users"?<UsersPage users={moduleData} api={api} refresh={()=>loadModule(active)} notify={notify}/>:
          active==="Announcements"?<AnnouncementsPage items={moduleData} api={api} refresh={()=>loadModule(active)} setSelected={setSelected} setModal={setModal}/>:
          active==="App Configuration"||active==="Settings"?<ConfigPage items={moduleData} api={api} refresh={()=>loadModule(active)} notify={notify}/>:
          active==="Backups"?<BackupsPage items={moduleData}/>:
          active==="Logs & Audit"?<AuditPage items={moduleData}/>:
          active==="Admin Access"?<AdminsPage items={moduleData} api={api} refresh={()=>loadModule(active)} notify={notify}/>:
          active==="System Health"?<HealthPage items={moduleData}/>:
          <InfoPage active={active} go={go}/>}
        <footer className="footer"><span>© 2026 AnimePlex Admin</span><span><i className="footer-status"/> Authenticated API <b>·</b> {session.user.email}</span></footer>
      </div>
    </main>
    {modal==="release"&&<ReleaseModal close={()=>setModal("")} api={api} notify={notify} refresh={()=>loadModule("OTA Updates")}/>}
    {modal==="announcement"&&<AnnouncementModal close={()=>setModal("")} api={api} notify={notify} refresh={()=>loadModule("Announcements")}/>}
    {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}<button onClick={()=>setToast("")}><X size={14}/></button></div>}
  </div>;
}

function LoginScreen({onSubmit,busy,error}) {
 const [email,setEmail]=useState("");const [password,setPassword]=useState("");
 return <div className="auth-screen"><div className="auth-card"><div className="brand-mark auth-mark"><span>A</span></div><div className="eyebrow">ANIMEPLEX ADMIN</div><h1>Welcome back.</h1><p>Sign in with your authorized administrator account.</p><form onSubmit={e=>{e.preventDefault();onSubmit(email,password);}}><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username" placeholder="admin@example.com"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" placeholder="Your password"/></label>{error&&<div className="auth-error">{error}</div>}<button className="button button-primary auth-submit" disabled={busy}>{busy?"Signing in…":"Sign in securely"} <ChevronRight size={16}/></button></form><div className="auth-foot"><LockKeyhole size={13}/> Access is restricted to accounts granted an admin role.</div></div></div>;
}
function SetupScreen(){return <div className="auth-screen"><div className="auth-card"><div className="brand-mark auth-mark"><span>A</span></div><div className="eyebrow">SETUP REQUIRED</div><h1>Connect Supabase.</h1><p>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Vercel project environment, then redeploy.</p><a className="button button-primary" href="https://github.com/Abhishekred/Animeplex-v1-admin/blob/main/docs/ADMIN_SETUP.md">Read setup guide <ExternalLink size={14}/></a></div></div>;}

function Overview({stats,data,go,busy}) {
 const chart=[{day:"Mon",users:0},{day:"Tue",users:0},{day:"Wed",users:0},{day:"Thu",users:0},{day:"Fri",users:0},{day:"Sat",users:0},{day:"Sun",users:0}];
 return <>
  <div className="stats-grid">{stats.map(({label,value,note,icon:Icon,tone})=><div className="stat-card" key={label}><div className="stat-top"><span>{label}</span><div className={"stat-icon "+tone}><Icon size={18}/></div></div><div className="stat-value">{busy?"…":value}</div><div className="stat-foot"><span>{note}</span></div></div>)}</div>
  <div className="overview-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h3>Platform activity</h3><p>Live analytics will be added when app telemetry is enabled</p></div><span className="preview-pill">TELEMETRY PENDING</span></div><div className="chart-placeholder"><div className="chart-placeholder-icon"><Activity size={25}/></div><strong>Connect app analytics</strong><span>Real usage charts will appear here. No sample figures are shown as live data.</span></div></section><section className="panel health-panel"><div className="panel-heading"><div><h3>Release overview</h3><p>Latest records from your release registry</p></div><span className="health-overall"><i/> API connected</span></div><div className="release-summary">{data.releases.length?data.releases.slice(0,4).map(r=><div className="service-row" key={r.id}><div className="service-icon"><Package size={16}/></div><div className="service-copy"><strong>{r.version}</strong><span>{r.channel} channel · {r.status}</span></div><span className="service-status">{r.rollout_percent}%</span></div>):<div className="empty-state compact">No releases have been created yet.</div>}</div><button className="text-link" onClick={()=>go("OTA Updates")}>Open OTA center <ChevronRight size={14}/></button></section></div>
  <div className="bottom-grid"><section className="panel activity-panel"><div className="panel-heading"><div><h3>Recent admin activity</h3><p>Audit events from the secure API</p></div><button className="text-link" onClick={()=>go("Logs & Audit")}>View audit log <ChevronRight size={14}/></button></div><div className="activity-list">{data.activity.length?data.activity.map((a)=><div className="activity-row" key={a.id}><div className="activity-icon purple"><ClipboardList size={16}/></div><div className="activity-copy"><strong>{a.action}</strong><span>{a.actor_email||"Admin"} · {a.target_type||"system"} {a.target_id||""}</span></div><time>{fmt(a.created_at)}</time></div>):<div className="empty-state">No admin actions recorded yet.</div>}</div></section><section className="panel quick-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Common admin tasks</p></div><Zap size={17} className="muted"/></div><div className="quick-actions"><button onClick={()=>go("OTA Updates")}><div className="quick-icon orange"><UploadCloud size={17}/></div><span><strong>Upload OTA release</strong><small>Stage a new Android version</small></span><ChevronRight size={16}/></button><button onClick={()=>go("Announcements")}><div className="quick-icon blue"><MessageSquareText size={17}/></div><span><strong>Publish announcement</strong><small>Notify app users</small></span><ChevronRight size={16}/></button><button onClick={()=>go("Admin Access")}><div className="quick-icon green"><ShieldCheck size={17}/></div><span><strong>Manage admin roles</strong><small>Control privileged access</small></span><ChevronRight size={16}/></button></div></section></div>
 </>;
}

function ReleasesPage({releases,setModal,setSelected,api,refresh,notify,channelOnly}) {
 const [filter,setFilter]=useState("all");
 const shown=releases.filter(x=>filter==="all"||x.channel===filter);
 async function action(id,action){if(!confirm("Confirm "+action+" for this release?"))return;try{await api("releases","POST",{id,action});notify("Release "+action+" action completed.");refresh();}catch(e){notify(e.message);}}
 return <><div className="ota-hero"><div className="ota-hero-copy"><div className="ota-tag"><Zap size={13}/> RELEASE MANAGEMENT</div><h2>Ship updates with confidence.</h2><p>Create release records, upload APK assets and control the rollout channel. Client-side OTA manifest integration is a separate app update.</p><button className="button button-primary" onClick={()=>{setSelected(null);setModal("release");}}><Plus size={16}/> Create new release</button></div><div className="ota-hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="rocket-card"><Package size={36}/><span>APK</span><i><Check size={13}/></i></div><div className="floating-chip chip-a"><CheckCircle2 size={14}/> Release registry</div><div className="floating-chip chip-b"><RadioTower size={14}/> Staged rollout</div></div></div>
 <div className="ota-metrics"><div className="mini-metric"><span>Total releases</span><strong>{releases.length}</strong><small>All channels</small></div><div className="mini-metric"><span>Published</span><strong>{releases.filter(x=>x.status==="published").length}</strong><small>In release registry</small></div><div className="mini-metric"><span>Drafts</span><strong>{releases.filter(x=>x.status==="draft").length}</strong><small>Awaiting publication</small></div><div className="mini-metric"><span>Paused / rolled back</span><strong>{releases.filter(x=>["paused","rolled_back"].includes(x.status)).length}</strong><small>Not actively rolling out</small></div></div>
 <section className="panel releases-panel"><div className="panel-heading"><div><h3>{channelOnly?"Release channels":"Release history"}</h3><p>Real records stored in your Supabase release registry</p></div><select className="select-button" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All channels</option><option value="stable">Stable</option><option value="beta">Beta</option><option value="testing">Testing</option></select></div><div className="table-wrap"><table><thead><tr><th>VERSION</th><th>CHANNEL</th><th>PLATFORM</th><th>ROLLOUT</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{shown.map(r=><tr key={r.id}><td><strong className="version-name">{r.version}</strong><small>Build {r.version_code}</small></td><td><span className={"channel-pill "+r.channel}>{r.channel}</span></td><td>{r.platform}</td><td><div className="rollout-cell"><div className="progress-track"><i style={{width:r.rollout_percent+"%"}}/></div><span>{r.rollout_percent}%</span></div></td><td><span className={"release-status "+r.status}><i/>{r.status}</span></td><td><div className="table-actions">{r.status==="draft"&&<button onClick={()=>action(r.id,"publish")}>Publish</button>}{r.status==="published"&&<button onClick={()=>action(r.id,"pause")}>Pause</button>}{r.status!=="rolled_back"&&<button onClick={()=>action(r.id,"rollback")}>Rollback</button>}</div></td></tr>)}</tbody></table>{!shown.length&&<div className="empty-state">No releases found for this channel. Create your first release to get started.</div>}</div><div className="table-footer"><span>{shown.length} release records</span><span>Version codes must increase within a channel.</span></div></section>
 <div className="ota-bottom"><div className="notice-box"><ShieldCheck size={18}/><div><strong>Protected release publishing</strong><span>API checks admin role and version-code ordering before publishing.</span></div></div><div className="notice-box warning"><AlertTriangle size={18}/><div><strong>OTA app integration pending</strong><span>AnimePlex-V1 still reads upstream GitHub Releases. These records won't reach installed apps until the Flutter updater is migrated.</span></div></div></div>
 </>;
}

function UsersPage({users,api,refresh,notify}) {
 const [search,setSearch]=useState("");
 const shown=users.filter(u=>(u.email||"").toLowerCase().includes(search.toLowerCase())||(u.profile?.display_name||"").toLowerCase().includes(search.toLowerCase()));
 async function act(u,action){if(!confirm(action==="delete"?"Permanently delete this account? This cannot be undone.":action==="ban"?"Suspend this account?":"Restore this account?"))return;try{await api("users","POST",{userId:u.id,action,duration:"720h"});notify("User "+action+" completed.");refresh();}catch(e){notify(e.message);}}
 return <section className="panel data-panel"><div className="panel-heading"><div><h3>User management</h3><p>{users.length} users in this page · Supabase Auth</p></div><div className="table-search"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search email or name"/></div></div><div className="table-wrap"><table><thead><tr><th>USER</th><th>CREATED</th><th>LAST SIGN-IN</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{shown.map(u=><tr key={u.id}><td><strong className="version-name">{u.profile?.display_name||u.email||"Unknown user"}</strong><small>{u.email} · {shortId(u.id)}</small></td><td>{fmt(u.created_at)}</td><td>{fmt(u.last_sign_in_at)}</td><td><span className={"release-status "+(u.banned_until?"paused":"published")}><i/>{u.banned_until?"Suspended":"Active"}</span></td><td><div className="table-actions">{u.banned_until?<button onClick={()=>act(u,"unban")}>Restore</button>:<button onClick={()=>act(u,"ban")}>Suspend</button>}<button className="danger-text" onClick={()=>act(u,"delete")}>Delete</button></div></td></tr>)}</tbody></table>{!shown.length&&<div className="empty-state">No matching users.</div>}</div><div className="table-footer"><span>Showing up to 30 accounts</span><span>Delete is owner-only; suspension is reversible.</span></div></section>;
}

function AnnouncementsPage({items,api,refresh,setSelected,setModal}) {
 async function toggle(item){try{await api("announcements","PATCH",{id:item.id,is_active:!item.is_active});refresh();}catch(e){alert(e.message);}}
 async function remove(item){if(!confirm("Delete this announcement?"))return;try{await api("announcements","DELETE",{id:item.id});refresh();}catch(e){alert(e.message);}}
 return <section className="panel data-panel"><div className="panel-heading"><div><h3>App announcements</h3><p>Messages stored in the admin announcement registry.</p></div><button className="button button-primary" onClick={()=>setModal("announcement")}><Plus size={15}/> New announcement</button></div><div className="announcement-list">{items.map(item=><div className="announcement-row" key={item.id}><div className={"announcement-type "+item.type}>{item.type==="warning"?<AlertTriangle size={17}/>:<Bell size={17}/>}</div><div className="announcement-copy"><strong>{item.title}</strong><p>{item.body}</p><small>{fmt(item.created_at)} · {item.type}</small></div><span className={"release-status "+(item.is_active?"published":"paused")}><i/>{item.is_active?"Active":"Disabled"}</span><div className="table-actions"><button onClick={()=>toggle(item)}>{item.is_active?"Disable":"Enable"}</button><button className="danger-text" onClick={()=>remove(item)}>Delete</button></div></div>)}{!items.length&&<div className="empty-state">No announcements yet. Create one to start preparing user-facing messages.</div>}</div><div className="notice-box warning"><AlertTriangle size={17}/><span>The current AnimePlex-V1 app reads its announcement feed from a GitHub raw JSON URL. This admin registry will require a small Flutter feed-source change before these messages appear in the app.</span></div></section>;
}

function ConfigPage({items,api,refresh,notify}) {
 const [values,setValues]=useState({});
 useEffect(()=>{const next={};items.forEach(x=>next[x.key]=x.value);setValues(next);},[items]);
 const fields=[["maintenance_mode","Maintenance mode","boolean"],["minimum_supported_version","Minimum supported version","text"],["latest_version","Latest version","text"],["support_url","Support URL","text"],["discord_url","Community Discord URL","text"],["home_message","Home message","text"]];
 async function save(key,value){try{await api("config","PUT",{key,value});notify("Saved "+key+".");refresh();}catch(e){notify(e.message);}}
 return <div className="settings-layout"><section className="panel data-panel"><div className="panel-heading"><div><h3>Remote app configuration</h3><p>Values stored centrally for future mobile-app config sync.</p></div><span className="preview-pill">LIVE API</span></div>{fields.map(([key,label,type])=><div className="setting-row" key={key}><div><strong>{label}</strong><small>{key}</small></div>{type==="boolean"?<button className={values[key]?"toggle-switch on":"toggle-switch"} onClick={()=>{const value=!values[key];setValues(v=>({...v,[key]:value}));save(key,value);}}><i/></button>:<div className="setting-control"><input className="text-input" value={values[key]??""} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))} placeholder="Not configured"/><button className="button button-quiet" onClick={()=>save(key,values[key]??"")}>Save</button></div>}</div>)}<div className="notice-box warning"><AlertTriangle size={17}/><span>These settings are stored in Supabase. The Flutter app does not yet fetch this remote config; app-side integration is required before toggles affect user devices.</span></div></section><section className="panel"><h3>Configuration safety</h3><p className="muted-copy">Only allow-listed keys can be updated through the API. Each change is written to the admin audit log.</p><div className="health-score"><div className="health-ring"><ShieldCheck size={22}/></div><div><strong>Server-side permission checks</strong><span>Owner and Admin roles required.</span></div></div></section></div>;
}

function BackupsPage({items}){return <section className="panel data-panel"><div className="panel-heading"><div><h3>User backup records</h3><p>Metadata only. Backup payloads are never sent to this browser.</p></div><span className="preview-pill">READ ONLY</span></div><div className="table-wrap"><table><thead><tr><th>USER KEY</th><th>LAST UPDATED</th><th>PAYLOAD</th></tr></thead><tbody>{items.map(x=><tr key={x.user_key}><td>{shortId(x.user_key)}</td><td>{fmt(x.updated_at)}</td><td><span className="release-status published"><i/>Protected</span></td></tr>)}</tbody></table>{!items.length&&<div className="empty-state">No user backup metadata found.</div>}</div><div className="notice-box warning"><LockKeyhole size={17}/><span>Restore is intentionally not exposed yet. A safe restore flow needs an explicit target user, backup validation, pre-restore snapshot and owner confirmation.</span></div></section>;}
function AuditPage({items}){return <section className="panel data-panel"><div className="panel-heading"><div><h3>Admin audit trail</h3><p>Latest privileged actions and changes.</p></div><span className="preview-pill">IMMUTABLE LOG VIEW</span></div><div className="table-wrap"><table><thead><tr><th>TIME</th><th>ACTOR</th><th>ACTION</th><th>TARGET</th><th>DETAILS</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td>{fmt(x.created_at)}</td><td>{x.actor_email||shortId(x.actor_id)}</td><td><strong className="version-name">{x.action}</strong></td><td>{x.target_type} · {shortId(x.target_id)}</td><td><code>{JSON.stringify(x.details||{})}</code></td></tr>)}</tbody></table>{!items.length&&<div className="empty-state">No audit events yet.</div>}</div></section>;}
function AdminsPage({items,api,refresh,notify}){const [email,setEmail]=useState("");const [role,setRole]=useState("admin");async function grant(e){e.preventDefault();try{await api("admins","POST",{email,role});setEmail("");notify("Admin role granted.");refresh();}catch(err){notify(err.message);}}async function toggle(x){try{await api("admins","PATCH",{user_id:x.user_id,is_active:!x.is_active});refresh();}catch(e){notify(e.message);}}return <div className="settings-layout"><section className="panel data-panel"><div className="panel-heading"><div><h3>Administrator accounts</h3><p>Only existing Supabase Auth users can be granted access.</p></div><span className="preview-pill">OWNER CONTROL</span></div><form className="grant-form" onSubmit={grant}><input className="text-input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Existing user email"/><select className="text-input" value={role} onChange={e=>setRole(e.target.value)}>{ROLES.map(r=><option key={r}>{r}</option>)}</select><button className="button button-primary"><Plus size={14}/> Grant access</button></form><div className="table-wrap"><table><thead><tr><th>USER ID</th><th>ROLE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{items.map(x=><tr key={x.user_id}><td>{x.user_id}</td><td>{x.role}</td><td>{x.is_active?"Active":"Disabled"}</td><td><button className="table-action" disabled={x.role==="owner"} onClick={()=>toggle(x)}>{x.is_active?"Disable":"Enable"}</button></td></tr>)}</tbody></table>{!items.length&&<div className="empty-state">No admin accounts loaded.</div>}</div></section><section className="panel"><h3>Role permissions</h3><div className="role-list">{ROLES.map(r=><div key={r}><strong>{r}</strong><span>{({owner:"All access, role management and account deletion",admin:"User and app operations",release_manager:"OTA publishing and rollout controls",moderator:"Announcements",auditor:"Read-only audit and operational views"})[r]}</span></div>)}</div></section></div>;}
function HealthPage({items}){return <section className="panel data-panel"><div className="panel-heading"><div><h3>Infrastructure health</h3><p>Server-side connectivity probes.</p></div><span className="health-overall"><i/> Live checks</span></div><div className="health-service-grid">{items.map(x=><div className="health-service" key={x.name}><div className="service-icon"><Server size={18}/></div><strong>{x.name}</strong><span className={"release-status "+(x.status==="operational"?"published":"paused")}><i/>{x.status}</span><small>{x.detail}</small></div>)}</div></section>;}
function InfoPage({active,go}){return <div className="module-layout"><div className="module-banner"><div className="module-banner-icon"><Settings size={25}/></div><div><h2>{active}</h2><p>{active==="Devices"?"The current app repository does not yet publish a central device inventory endpoint.":"Central content catalogue management needs a dedicated content schema and app-side sync contract."}</p></div><span className="preview-pill">INTEGRATION PENDING</span></div><section className="panel integration-panel"><div className="integration-icon"><LockKeyhole size={21}/></div><div><h3>Waiting for app-side telemetry/API</h3><p>We will not display invented device counts or pretend a local setting controls the installed app. This module becomes live when AnimePlex-V1 exposes the corresponding secure API.</p><button className="button button-quiet" onClick={()=>go("Overview")}>Back to overview</button></div></section></div>;}

function ReleaseModal({close,api,notify,refresh}) {
 const [file,setFile]=useState(null);const [form,setForm]=useState({version:"",version_code:"",platform:"android",channel:"stable",mandatory:false,rollout_percent:10,release_notes:""});const [busy,setBusy]=useState(false);
 async function submit(e){e.preventDefault();if(!file)return notify("Select an APK or AAB first.");setBusy(true);try{
  const hasher=await createSHA256();hasher.init();const reader=file.stream().getReader();while(true){const part=await reader.read();if(part.done)break;hasher.update(new Uint8Array(part.value));}const sha256=hasher.digest("hex");
  const ticket=await api("releases","POST",{action:"create-upload",fileName:file.name});
  const {error:uploadError}=await supabase.storage.from("animeplex-releases").uploadToSignedUrl(ticket.path,ticket.token,file,{contentType:"application/vnd.android.package-archive",upsert:false});
  if(uploadError)throw uploadError;
  await api("releases","POST",{action:"create",...form,version_code:Number(form.version_code),rollout_percent:Number(form.rollout_percent),storage_path:ticket.path,file_size:file.size,sha256});
  notify("Release saved as draft.");close();refresh();
 }catch(err){notify(err.message||"Upload failed.");}finally{setBusy(false);}}
 return <Modal title="Create OTA release" subtitle="Upload an Android package and prepare a release draft." close={close}><form onSubmit={submit} className="modal-form"><label className="field-label">Release package <span>APK only</span></label><label className="upload-zone"><UploadCloud size={24}/><strong>{file?file.name:"Choose APK file"}</strong><span>{file?(file.size/1024/1024).toFixed(1)+" MB":"Package uploads directly to Supabase Storage"}</span><input hidden type="file" accept=".apk" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><div className="form-grid"><label><span className="field-label">Version name</span><input className="text-input" required value={form.version} onChange={e=>setForm({...form,version:e.target.value})} placeholder="2.5.0"/></label><label><span className="field-label">Version code</span><input className="text-input" required type="number" min="1" value={form.version_code} onChange={e=>setForm({...form,version_code:e.target.value})} placeholder="20500"/></label></div><div className="form-grid"><label><span className="field-label">Platform</span><select className="text-input" value={form.platform} onChange={e=>setForm({...form,platform:e.target.value})}><option value="android">Android</option><option value="android_tv">Android TV</option></select></label><label><span className="field-label">Channel</span><select className="text-input" value={form.channel} onChange={e=>setForm({...form,channel:e.target.value})}><option value="stable">Stable</option><option value="beta">Beta</option><option value="testing">Testing</option></select></label></div><label><span className="field-label">Rollout percentage <b>{form.rollout_percent}%</b></span><input className="range-input" type="range" min="1" max="100" step="1" value={form.rollout_percent} onChange={e=>setForm({...form,rollout_percent:e.target.value})}/></label><label className="checkbox-line"><input type="checkbox" checked={form.mandatory} onChange={e=>setForm({...form,mandatory:e.target.checked})}/> Mark as mandatory update</label><label><span className="field-label">Release notes</span><textarea className="text-input textarea" value={form.release_notes} onChange={e=>setForm({...form,release_notes:e.target.value})} placeholder="What's new?"/></label><div className="notice-box warning"><AlertTriangle size={16}/><span>This creates a draft in the admin registry. The existing Flutter app must be updated to read this release manifest before users receive it.</span></div><div className="modal-actions"><button type="button" className="button button-quiet" onClick={close}>Cancel</button><button className="button button-primary" disabled={busy}>{busy?"Uploading…":"Upload and save draft"}</button></div></form></Modal>;
}
function AnnouncementModal({close,api,notify,refresh}){const [form,setForm]=useState({title:"",body:"",type:"info",is_active:true,action_url:""});const [busy,setBusy]=useState(false);async function submit(e){e.preventDefault();setBusy(true);try{await api("announcements","POST",form);notify("Announcement created.");close();refresh();}catch(err){notify(err.message);}finally{setBusy(false);}}return <Modal title="New announcement" subtitle="Prepare a message for the AnimePlex app." close={close}><form onSubmit={submit} className="modal-form"><label><span className="field-label">Title</span><input className="text-input" maxLength="120" required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label><span className="field-label">Message</span><textarea className="text-input textarea" value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/></label><div className="form-grid"><label><span className="field-label">Type</span><select className="text-input" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="info">Info</option><option value="warning">Warning</option><option value="update">Update</option></select></label><label><span className="field-label">Action URL (optional)</span><input className="text-input" type="url" value={form.action_url} onChange={e=>setForm({...form,action_url:e.target.value})} placeholder="https://…"/></label></div><label className="checkbox-line"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Enable announcement</label><div className="modal-actions"><button type="button" className="button button-quiet" onClick={close}>Cancel</button><button className="button button-primary" disabled={busy}>{busy?"Saving…":"Create announcement"}</button></div></form></Modal>;}
function Modal({title,subtitle,close,children}){return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><div className="release-modal"><div className="modal-head"><div><div className="eyebrow">ADMIN ACTION</div><h2>{title}</h2><p>{subtitle}</p></div><IconButton label="Close" onClick={close}><X size={18}/></IconButton></div>{children}</div></div>;}
