import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { isSupabaseConfigured, supabase } from "./lib/supabase.js";
import { observeAuthSession, requestWithSessionRetry } from "./lib/session.js";
import { createDemoApi, PREVIEW_SESSION } from "./lib/demo.js";
import { AnalyticsPage, AppControlPage, AuditChart, DashboardPreferences, SourcesPage } from "./components/Studio.jsx";
import { CommandPalette, MobileNavigation } from "./components/Navigation.jsx";

const NAV = [
  { label:"WORKSPACE", items:[["Overview",LayoutDashboard],["Analytics",Gauge],["Users",Users],["Devices",Smartphone],["Content",Film],["Announcements",MessageSquareText]] },
  { label:"APP CONTROL", items:[["App control",SlidersHorizontal],["Home & themes",Sparkles],["Sources & repos",Package],["App Configuration",Settings]] },
  { label:"DISTRIBUTION", items:[["OTA Updates",DownloadCloud],["Release Channels",RadioTower]] },
  { label:"INFRASTRUCTURE", items:[["System Health",Activity],["Backups",Database],["Logs & Audit",FileClock]] },
  { label:"ADMINISTRATION", items:[["Admin Access",ShieldCheck],["Settings",SlidersHorizontal]] },
];
const EMPTY = { stats:{users:0,activeAnnouncements:0,backupAccounts:0,admins:0}, releases:[], backups:[], activity:[], settings:{}, auditTrend:{days:[],total:0,truncated:false} };
const ROLES = ["owner","admin","release_manager","moderator","auditor"];
const fmt = value => value ? new Date(value).toLocaleString() : "—";
const shortId = value => value ? value.slice(0,8)+"…" : "—";
const isSuspended = user => Boolean(user.banned_until && Date.parse(user.banned_until) > Date.now());
const readPref = (key, fallback) => { try { return window.localStorage.getItem(key) || fallback; } catch { return fallback; } };
const savePref = (key, value) => { try { window.localStorage.setItem(key, value); } catch { /* private browsing can block storage */ } };

function IconButton({children,label,onClick}) { return <button className="icon-button" aria-label={label} title={label} onClick={onClick}>{children}</button>; }

export default function App() {
  const [session,setSession] = useState(null);
  const [preview,setPreview] = useState(false);
  const previewApi = useRef(null);
  const sessionObserver = useRef(null);
  const navSearch = useRef(null);
  const dashboardRequest = useRef(0);
  const moduleRequest = useRef(0);
  const currentSession = preview ? PREVIEW_SESSION : session;
  const [authLoading,setAuthLoading] = useState(true);
  const [authIssue,setAuthIssue] = useState("");
  const [commandOpen,setCommandOpen] = useState(false);
  const [active,setActive] = useState("Overview");
  const [role,setRole] = useState("");
  const [sidebarOpen,setSidebarOpen] = useState(false);
  const [dark,setDark] = useState(()=>readPref('animeplex-admin-mode','dark')!=='light');
  const [accent,setAccent] = useState(()=>readPref('animeplex-admin-accent','midnight-gold'));
  const [autoRefresh,setAutoRefresh] = useState(()=>readPref('animeplex-admin-refresh','on')!=='off');
  const [lastSync,setLastSync] = useState(null);
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
    if (preview) return previewApi.current(resource,method,body,params);
    if (!session?.access_token) throw new Error("Please sign in again.");
    const response = await requestWithSessionRetry(supabase.auth, session.access_token, token => fetch("/api/admin/"+resource+params,{
      method,headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
      ...(body ? {body:JSON.stringify(body)} : {})
    }));
    const payload = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(payload.error || "Request failed ("+response.status+").");
    return payload;
  },[preview,session]);

  useEffect(()=>{
    if (!isSupabaseConfigured) { setAuthLoading(false); return; }
    let recovering = false;
    const observer = observeAuthSession(supabase.auth, {
      onSession(next,event) {
        recovering = false; setAuthIssue(""); setSession(next); setAuthLoading(false);
        if (event === 'SIGNED_OUT') { setRole(""); setData(EMPTY); setModuleData([]); setSelected(null); setModal(""); setLastSync(null); }
      },
      onUnavailable() { recovering = true; setAuthIssue("We couldn't restore your session. Check your connection and try again."); setAuthLoading(false); },
    });
    sessionObserver.current = observer;
    observer.restore();
    const onOnline = () => { if (recovering) observer.restore(); };
    window.addEventListener('online', onOnline);
    return ()=>{window.removeEventListener('online', onOnline); observer.close(); if(sessionObserver.current===observer)sessionObserver.current=null;};
  },[]);

  const refresh = useCallback(async()=>{
    if (!currentSession) return;
    const request = ++dashboardRequest.current;
    setBusy(true);setError("");
    try {
      const result=await api("dashboard");
      if(request===dashboardRequest.current){setData({...EMPTY,...result,stats:{...EMPTY.stats,...result.stats}});setRole(result.role||"");setLastSync(new Date());}
    } catch(e) { if(request===dashboardRequest.current)setError(e.message); }
    finally { if(request===dashboardRequest.current)setBusy(false); }
  },[api,currentSession]);
  useEffect(()=>()=>{dashboardRequest.current++;moduleRequest.current++;},[currentSession]);
  useEffect(()=>{refresh();},[refresh]);
  useEffect(()=>{
    if (!currentSession || !autoRefresh || !["Overview","Analytics"].includes(active)) return;
    const timer = window.setInterval(()=>{ if (document.visibilityState === 'visible') refresh(); },30000);
    return ()=>window.clearInterval(timer);
  },[currentSession,autoRefresh,active,refresh]);
  useEffect(()=>savePref('animeplex-admin-mode',dark?'dark':'light'),[dark]);
  useEffect(()=>savePref('animeplex-admin-accent',accent),[accent]);
  useEffect(()=>savePref('animeplex-admin-refresh',autoRefresh?'on':'off'),[autoRefresh]);
  useEffect(()=>{
    const onKeyDown = event => {
      if (currentSession && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();setCommandOpen(true);
      }
    };
    window.addEventListener('keydown',onKeyDown);
    return ()=>window.removeEventListener('keydown',onKeyDown);
  },[currentSession]);

  const loadModule = useCallback(async(name)=>{
    const request=++moduleRequest.current;
    setBusy(true);setError("");
    try {
      let result={};
      if(name==="Users") result=await api("users", "GET", null, "?page=1&limit=30");
      else if(name==="Devices") result=await api("devices");
      else if(name==="OTA Updates"||name==="Release Channels") result=await api("releases");
      else if(name==="Announcements") result=await api("announcements");
      else if(name==="Content") result=await api("content");
      else if(["App Configuration","App control","Home & themes","Sources & repos"].includes(name)) result=await api("config");
      else if(name==="Backups") result=await api("backups");
      else if(name==="Logs & Audit") result=await api("audit");
      else if(name==="Admin Access") result=await api("admins");
      else if(name==="System Health") result=await api("health");
      if(request===moduleRequest.current)setModuleData(result.users||result.pairings||result.content||result.releases||result.announcements||result.settings||result.backups||result.events||result.admins||result.services||[]);
    } catch(e) { if(request===moduleRequest.current)setError(e.message); }
    finally { if(request===moduleRequest.current)setBusy(false); }
  },[api]);
  useEffect(()=>{if(currentSession&&!['Overview','Analytics','Settings'].includes(active))loadModule(active);return()=>{moduleRequest.current++;};},[currentSession,active,loadModule]);

  const filteredNav=useMemo(()=>NAV.map(g=>({...g,items:g.items.filter(([n])=>n.toLowerCase().includes(query.toLowerCase()))})).filter(g=>g.items.length),[query]);
  const closeCommand=useCallback(()=>setCommandOpen(false),[]);
  const go=name=>{moduleRequest.current++;setBusy(false);if(name!==active){setModuleData([]);setActive(name);}else if(!['Overview','Analytics','Settings'].includes(name)){loadModule(name);}setSidebarOpen(false);setError("");};

  async function signIn(email,password) {
    setBusy(true);setError("");
    try {
      const {error}=await supabase.auth.signInWithPassword({email,password});
      if(error)setError(error.message);
    } catch(error) { setError(error.message || "Could not sign in. Try again."); }
    finally { setBusy(false); }
  }
  function enterPreview(){previewApi.current=createDemoApi();setData(EMPTY);setRole("");setError("");setActive("Overview");setPreview(true);}
  async function signOut(){
    if(preview){setPreview(false);previewApi.current=null;}
    else {
      if(!window.confirm('Sign out of AnimePlex Admin on this browser?'))return;
      try {
        const {error}=await supabase.auth.signOut({scope:'local'});
        if(error){const {data}=await supabase.auth.getSession();if(data?.session){setError('Could not sign out. Please try again.');return;}}
        setSession(null);
      }catch(error){setError(error.message || 'Could not sign out. Please try again.');return;}
    }
    setRole("");setData(EMPTY);setModuleData([]);setSelected(null);setModal("");setLastSync(null);setCommandOpen(false);
  }

  if(!isSupabaseConfigured && !preview) return <SetupScreen onPreview={enterPreview}/>;
  if(authLoading && !preview) return <div className="auth-screen"><div className="auth-card"><div className="brand-mark"><img src="/animeplex-logo.png" alt="AnimePlex"/></div><p>Loading secure session…</p></div></div>;
  if(!currentSession && authIssue) return <SessionRecovery message={authIssue} retry={()=>{setAuthLoading(true);sessionObserver.current?.restore();}} signIn={()=>setAuthIssue("")}/>;
  if(!currentSession) return <LoginScreen onSubmit={signIn} onPreview={enterPreview} busy={busy} error={error}/>;

  const intro={
    "Overview":"Your AnimePlex ecosystem at a glance.",
    "Analytics":"Real operational insights, refreshed every 30 seconds.",
    "Users":"Review accounts, access status and sign-in activity.",
    "Devices":"Review TV pairing requests and expire stale pending codes.",
    "Content":"Manage featured titles, artwork and in-app destinations.",
    "Announcements":"Publish messages that can be consumed by the mobile app.",
    "OTA Updates":"Upload, stage and distribute Android releases.",
    "Release Channels":"Manage Stable, Beta and Testing release streams.",
    "App Configuration":"Change supported remote settings and feature flags.",
    "App control":"Manage your app switches and feature flags.",
    "Home & themes":"Create a distinctive AnimePlex look.",
    "Sources & repos":"Control the providers and repositories in your registry.",
    "System Health":"Check the database and admin service dependencies.",
    "Backups":"Review backup metadata without exposing user backup payloads.",
    "Logs & Audit":"Review administrative actions and security events.",
    "Admin Access":"Grant roles and manage administrator access.",
    "Settings":"Manage your dashboard session and preferences."
  }[active]||"Manage your AnimePlex platform.";
  const stats=[
    {label:"User profiles",value:data.stats.users.toLocaleString(),note:"Supabase profile records",icon:Users,tone:"violet"},
    {label:"Active announcements",value:data.stats.activeAnnouncements,note:"Currently enabled",icon:MessageSquareText,tone:"green"},
    {label:"Backup accounts",value:data.stats.backupAccounts,note:"Metadata records",icon:Database,tone:"blue"},
    {label:"Active admins",value:data.stats.admins,note:"Privileged accounts",icon:ShieldCheck,tone:"orange"}
  ];

  const canEdit = ["owner","admin"].includes(role);
  const canAnnounce = ["owner","admin","moderator"].includes(role);
  const canRelease = ["owner","admin","release_manager"].includes(role);
  const displayName = preview ? 'Abhishek' : (currentSession.user.user_metadata?.full_name || currentSession.user.email?.split('@')[0] || 'Admin');
  const greeting = new Date().getHours()<12?'morning':new Date().getHours()<17?'afternoon':'evening';
  const refreshCurrent = () => ['Overview','Analytics','Settings'].includes(active) ? refresh() : loadModule(active);

  return <div className={dark?"app-shell dark":"app-shell light"} data-accent={accent}>
    {sidebarOpen&&<button className="sidebar-backdrop" aria-label="Close menu" onClick={()=>setSidebarOpen(false)}/>}
    <aside className={sidebarOpen?"sidebar sidebar-open":"sidebar"}>
      <div className="brand"><div className="brand-mark"><img src="/animeplex-logo.png" alt="AnimePlex"/></div><div className="brand-copy"><strong>Anime<span>Plex</span></strong><small>ADMIN STUDIO</small></div><button className="mobile-close" aria-label="Close menu" onClick={()=>setSidebarOpen(false)}><X size={18}/></button></div>
      <div className="workspace-switch"><div className="workspace-icon"><Sparkles size={16}/></div><div><strong>AnimePlex</strong><small>{preview?'Preview workspace':'Admin workspace'}</small></div></div>
      <div className="nav-search"><Search size={15}/><input ref={navSearch} aria-label="Find a page" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a page…"/><kbd>⌘ K</kbd></div>
      <nav className="navigation">{filteredNav.map(group=><div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(([name,Icon])=><button key={name} className={active===name?"nav-item active":"nav-item"} onClick={()=>go(name)}><Icon size={17}/><span>{name}</span>{name==="OTA Updates"&&<i className="nav-dot"/>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><LifeBuoy size={17}/></div><strong>Admin guide</strong><p>Setup, roles, updates and recovery notes.</p><a href="https://github.com/Abhishekred/Animeplex-v1-admin/blob/Abhishekred/ONLINE-DASHBOARD/docs/ADMIN_SETUP.md" target="_blank" rel="noreferrer">Open documentation <ExternalLink size={12}/></a></div><div className="profile-row"><div className="avatar">{(currentSession.user.email||"AD").slice(0,2).toUpperCase()}</div><div className="profile-copy"><strong>{preview?'Preview workspace':currentSession.user.email}</strong><small>{preview?'Sample data · local only':role||'Checking access…'}</small></div><IconButton label={preview?'Exit preview':'Sign out'} onClick={signOut}><LogOut size={16}/></IconButton></div></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu" aria-label="Open menu" onClick={()=>setSidebarOpen(true)}><Menu size={19}/></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14}/><strong>{active}</strong></div></div><div className="topbar-actions"><button className="global-search" aria-label="Search dashboard pages" onClick={()=>setCommandOpen(true)}><Search size={16}/><span>Search workspace</span><kbd>⌘ K</kbd></button><div className={preview?'environment preview-environment':'environment'}><i/> {preview?'Preview · sample data':error?'Connection issue':lastSync?(autoRefresh?'Live · 30s':'Refresh paused'):'Connecting…'}</div><IconButton label="Refresh data" onClick={refreshCurrent}><RefreshCw size={16}/></IconButton><IconButton label="Toggle theme" onClick={()=>setDark(!dark)}>{dark?<Moon size={17}/>:<Sparkles size={17}/>}</IconButton><span className="top-divider"/><div className="top-avatar">{preview?'A':(currentSession.user.email||"AD").slice(0,2).toUpperCase()}</div></div></header>
      <div className="page-content">
        {preview&&<div className="preview-banner"><Sparkles size={16}/><span><strong>Preview mode.</strong> Sample data resets when you reload or exit; no app or database is connected.</span><button onClick={signOut}>Exit preview</button></div>}
        <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> {active==='Overview'?'YOUR CONTROL CENTER':'ANIMEPLEX STUDIO'}</div><h1>{active==="Overview"?`Good ${greeting}, ${displayName}`:active}{active==='Overview'&&<span className="heading-spark"> ✦</span>}</h1><p>{intro}</p></div><div className="heading-actions"><button className="button button-quiet" onClick={refreshCurrent} disabled={busy}><RefreshCw size={15}/> {busy?"Syncing…":"Refresh"}</button>{canRelease&&(active==="Overview"||active==="OTA Updates")&&<button className="button button-primary" onClick={()=>{setSelected(null);setModal("release");}}><Plus size={16}/> New release</button>}{canAnnounce&&active==="Announcements"&&<button className="button button-primary" onClick={()=>{setSelected(null);setModal("announcement");}}><Plus size={16}/> New announcement</button>}{canEdit&&active==="Content"&&<button className="button button-primary" onClick={()=>{setSelected(null);setModal("content");}}><Plus size={16}/> Add featured title</button>}</div></div>
        {error&&<div className="error-banner"><AlertTriangle size={16}/><span>{error}</span><button onClick={()=>setError("")}><X size={14}/></button></div>}
        {active==="Overview"?<Overview stats={stats} data={data} go={go} busy={busy} preview={preview} api={api} refresh={refresh} notify={notify} canEdit={canEdit} lastSync={lastSync} autoRefresh={autoRefresh}/>:
          active==="Analytics"?<AnalyticsPage data={data} go={go} preview={preview}/>:
          active==="App control"||active==="Home & themes"?<AppControlPage items={moduleData} api={api} refresh={()=>loadModule(active)} notify={notify} canEdit={canEdit} appearanceOnly={active==="Home & themes"}/>:
          active==="Sources & repos"?<SourcesPage items={moduleData} api={api} refresh={()=>loadModule(active)} notify={notify} canEdit={canEdit}/>:
          active==="Devices"?<DevicesPage items={moduleData} api={api} refresh={()=>loadModule("Devices")} notify={notify} canEdit={canEdit}/>:
          active==="OTA Updates"||active==="Release Channels"?<ReleasesPage releases={moduleData} setModal={setModal} setSelected={setSelected} api={api} refresh={()=>loadModule(active)} notify={notify} channelOnly={active==="Release Channels"} canRelease={canRelease}/>:
          active==="Users"?<UsersPage users={moduleData} api={api} refresh={()=>loadModule(active)} notify={notify} role={role}/>:
          active==="Announcements"?<AnnouncementsPage items={moduleData} api={api} refresh={()=>loadModule(active)} setSelected={setSelected} setModal={setModal} canEdit={canAnnounce}/>:
          active==="Content"?<ContentPage items={moduleData} api={api} refresh={()=>loadModule("Content")} notify={notify} setSelected={setSelected} setModal={setModal} canEdit={canEdit}/>:
          active==="App Configuration"?<ConfigPage items={moduleData} api={api} refresh={()=>loadModule(active)} notify={notify} canEdit={canEdit}/>:
          active==="Settings"?<DashboardPreferences dark={dark} setDark={setDark} accent={accent} setAccent={setAccent} autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} preview={preview} email={currentSession.user.email} onSignOut={signOut}/>:
          active==="Backups"?<BackupsPage items={moduleData}/>:
          active==="Logs & Audit"?<AuditPage items={moduleData}/>:
          active==="Admin Access"?<AdminsPage items={moduleData} api={api} refresh={()=>loadModule(active)} notify={notify} isOwner={role==='owner'}/>:
          active==="System Health"?<HealthPage items={moduleData}/>:
          <InfoPage active={active} go={go}/>}
        <footer className="footer"><span>© 2026 AnimePlex Admin</span><span><i className="footer-status"/> {preview?'Preview only':lastSync?'Authenticated API':'Waiting for connection'} <b>·</b> {preview?'Sample data':currentSession.user.email}</span></footer>
      </div>
    </main>
    <MobileNavigation active={active} go={go} openMenu={()=>setSidebarOpen(true)}/>
    {commandOpen&&<CommandPalette groups={NAV} onClose={closeCommand} onNavigate={go}/>}
    {modal==="release"&&<ReleaseModal close={()=>setModal("")} api={api} notify={notify} refresh={()=>active==='OTA Updates'?loadModule('OTA Updates'):refresh()} preview={preview}/>}
    {modal==="announcement"&&<AnnouncementModal selected={selected} close={()=>setModal("")} api={api} notify={notify} refresh={()=>loadModule("Announcements")}/>}{modal==="content"&&<ContentModal selected={selected} close={()=>setModal("")} api={api} notify={notify} refresh={()=>loadModule("Content")}/>}
    {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}<button onClick={()=>setToast("")}><X size={14}/></button></div>}
  </div>;
}

function LoginScreen({onSubmit,onPreview,busy,error}) {
 const [email,setEmail]=useState("");const [password,setPassword]=useState("");
 return <div className="auth-screen"><div className="auth-layout"><AuthShowcase/><div className="auth-card"><div className="auth-label">WELCOME BACK</div><h1>Sign in to your studio.</h1><p>Your AnimePlex controls, all in one place.</p><form onSubmit={e=>{e.preventDefault();onSubmit(email,password);}}><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username" placeholder="admin@example.com"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" placeholder="Your password"/></label>{error&&<div className="auth-error">{error}</div>}<button className="button button-primary auth-submit" disabled={busy}>{busy?"Signing in…":"Sign in securely"} <ChevronRight size={16}/></button></form><div className="stay-signed"><ShieldCheck size={15}/><span>Stay signed in on this browser. Your session refreshes automatically.</span></div><button className="auth-preview-link" type="button" onClick={onPreview}>Explore a sample dashboard <ChevronRight size={14}/></button><div className="auth-foot"><LockKeyhole size={13}/> Access is restricted to authorized administrators.</div></div></div></div>;
}
function AuthShowcase(){return <div className="auth-showcase"><div className="auth-brand"><img src="/animeplex-logo.png" alt="AnimePlex logo"/><span>Anime<strong>Plex</strong><small>ADMIN STUDIO</small></span></div><div className="showcase-copy"><div className="eyebrow">YOUR WORLD, IN CONTROL</div><h2>A beautiful home for everything AnimePlex.</h2><p>Manage your app, your content, and your community from one thoughtful workspace.</p></div><div className="showcase-foot"><span>✦</span> Built for the stories you love.</div></div>;}
function SetupScreen({onPreview}){return <div className="auth-screen"><div className="auth-layout"><AuthShowcase/><div className="auth-card"><div className="auth-label">YOUR WORKSPACE IS READY</div><h1>Explore your studio.</h1><p>Take a look around with sample data. Connect your services when you are ready.</p><button className="button button-primary auth-submit" type="button" onClick={onPreview}>Open dashboard preview <ChevronRight size={16}/></button><div className="setup-details"><strong>Connect later</strong><span>Configure your Supabase and Vercel settings to enable secure live operations.</span><a href="https://github.com/Abhishekred/Animeplex-v1-admin/blob/Abhishekred/ONLINE-DASHBOARD/docs/ADMIN_SETUP.md" target="_blank" rel="noreferrer">Read the setup guide <ExternalLink size={13}/></a></div><div className="auth-foot"><LockKeyhole size={13}/> Preview data is temporary and does not connect your app.</div></div></div></div>;}

function SessionRecovery({message,retry,signIn}){return <div className="auth-screen"><div className="auth-layout"><AuthShowcase/><div className="auth-card"><div className="auth-label">YOUR SESSION</div><h1>Let's reconnect.</h1><p>{message}</p><div className="recovery-card"><Wifi size={18}/><span>Your saved session can be restored when the connection is available.</span></div><button className="button button-primary auth-submit" type="button" onClick={retry}><RefreshCw size={16}/> Retry connection</button><button className="auth-preview-link" type="button" onClick={signIn}>Sign in again <ChevronRight size={14}/></button></div></div></div>;}

function Overview({stats,data,go,busy,preview,api,refresh,notify,canEdit,lastSync,autoRefresh}) {
 const [saving,setSaving]=useState('');
 async function setQuick(key,value){if(key==='maintenance_mode'&&value&&!window.confirm('Enable maintenance mode in the settings registry?'))return;setSaving(key);try{await api('config','PUT',{key,value});notify('Setting saved to the registry.');await refresh();}catch(error){notify(error.message);}finally{setSaving('');}}
 const quick=[['maintenance_mode','Maintenance mode','Pause access on supported app versions'],['community_popup_enabled','Community prompt','Show the community message']];
 return <>
  <section className="command-hero"><div className="command-copy"><div className="command-kicker"><span/> ANIMEPLEX COMMAND CENTER</div><h2>Your universe.<br/><em>Your rules.</em></h2><p>Everything you need to shape, manage and grow the AnimePlex experience.</p><div className="command-actions"><button className="button command-primary" onClick={()=>go('App control')}>Explore app controls <ChevronRight size={15}/></button><button className="command-link" onClick={()=>go('Home & themes')}><Sparkles size={15}/> Customize appearance</button></div><div className="command-meta"><span><i/> {preview?'PREVIEW WORKSPACE':'ADMIN WORKSPACE'}</span><span>•</span><span>DESIGNED FOR ANIMEPLEX</span></div></div><div className="command-art" aria-hidden="true"><div className="command-ring ring-one"/><div className="command-ring ring-two"/><div className="command-ring ring-three"/><span className="command-star star-one">✦</span><span className="command-star star-two">✧</span><img src="/animeplex-logo.png" alt=""/><span className="command-art-label">THE WORLD OF <b>ANIMEPLEX</b></span></div></section>
  <div className="workspace-heading"><div><span className="section-index">YOUR WORKSPACE</span><h3>Everything at a glance</h3></div><span className="workspace-updated">{lastSync ? `Updated ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for sync'}</span></div>
  <div className="stats-grid">{stats.map(({label,value,note,icon:Icon,tone})=><div className="stat-card" key={label}><div className="stat-top"><span>{label}</span><div className={"stat-icon "+tone}><Icon size={18}/></div></div><div className="stat-value">{busy&&!lastSync?"…":value}</div><div className="stat-foot"><span>{note}</span></div></div>)}</div>
  <div className="shortcut-grid">{[["App controls",'App control',SlidersHorizontal],["Appearance studio",'Home & themes',Sparkles],["Sources & repos",'Sources & repos',Package],["Announcements",'Announcements',MessageSquareText]].map(([label,target,Icon])=><button className="shortcut-card" key={target} onClick={()=>go(target)}><span className="shortcut-icon"><Icon size={17}/></span><span><strong>{label}</strong><small>Open workspace</small></span><ChevronRight size={15}/></button>)}</div>
  <div className="overview-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h3>Admin activity</h3><p>Actions per day · last seven days, UTC</p></div><span className="preview-pill">{preview?'SAMPLE DATA':'AUDIT LOG'}</span></div><AuditChart trend={data.auditTrend}/><div className="chart-caption">{data.auditTrend?.truncated?'Latest 1,000 events in this period.':lastSync?`${data.auditTrend?.total||0} actions · ${autoRefresh?'refreshes every 30 sec':'auto-refresh paused'}`:'Waiting for the first sync.'}</div></section><section className="panel health-panel"><div className="panel-heading"><div><h3>Release overview</h3><p>Latest release registry records</p></div><span className="preview-pill">{preview?'SAMPLE':'REGISTRY'}</span></div><div className="release-summary">{data.releases.length?data.releases.slice(0,4).map(r=><div className="service-row" key={r.id}><div className="service-icon"><Package size={16}/></div><div className="service-copy"><strong>{r.version}</strong><span>{r.channel} channel · {r.status}</span></div><span className="service-status">{r.rollout_percent}%</span></div>):<div className="empty-state compact">No releases have been created yet.</div>}</div><button className="text-link" onClick={()=>go("OTA Updates")}>Open release center <ChevronRight size={14}/></button></section></div>
  <div className="bottom-grid"><section className="panel quick-panel"><div className="panel-heading"><div><h3>Quick controls</h3><p>Saved in the app settings registry</p></div><button className="text-link" onClick={()=>go('App control')}>Manage <ChevronRight size={14}/></button></div>{quick.map(([key,label,description])=><div className="control-row" key={key}><div><strong>{label}</strong><small>{description}</small></div><button type="button" role="switch" aria-label={label} aria-checked={data.settings?.[key]===true} disabled={!canEdit||Boolean(saving)} className={data.settings?.[key]===true?'toggle-switch on':'toggle-switch'} onClick={()=>setQuick(key,data.settings?.[key]!==true)}><i/></button></div>)}<div className="control-row"><div><strong>Default source</strong><small>{data.settings?.default_source||'Not configured'}</small></div><button className="text-link" onClick={()=>go('Sources & repos')}>Manage <ChevronRight size={14}/></button></div><div className="inline-integration">App-side connection pending</div></section><section className="panel activity-panel"><div className="panel-heading"><div><h3>Recent activity</h3><p>Latest administrative actions</p></div><button className="text-link" onClick={()=>go("Logs & Audit")}>View all <ChevronRight size={14}/></button></div><div className="activity-list">{data.activity.length?data.activity.slice(0,4).map((a)=><div className="activity-row" key={a.id}><div className="activity-icon purple"><ClipboardList size={16}/></div><div className="activity-copy"><strong>{a.action.replaceAll('.',' ')}</strong><span>{a.actor_email||"Admin"} · {a.target_type||"system"}</span></div><time>{fmt(a.created_at)}</time></div>):<div className="empty-state">No admin actions recorded yet.</div>}</div></section></div>
  <div className="telemetry-banner"><div className="telemetry-banner-icon"><Activity size={19}/></div><div><strong>Ready for live app insights</strong><span>Active viewers, playback and crash metrics will appear after app telemetry is connected.</span></div><button className="text-link" onClick={()=>go('Analytics')}>Explore analytics <ChevronRight size={14}/></button></div>
 </>;
}

function ReleasesPage({releases,setModal,setSelected,api,refresh,notify,channelOnly,canRelease}) {
 const [filter,setFilter]=useState("all");
 const shown=releases.filter(x=>filter==="all"||x.channel===filter);
 async function action(id,action){if(!confirm("Confirm "+action+" for this release?"))return;try{await api("releases","POST",{id,action});notify("Release "+action+" action completed.");refresh();}catch(e){notify(e.message);}}
 return <><div className="ota-hero"><div className="ota-hero-copy"><div className="ota-tag"><Zap size={13}/> RELEASE MANAGEMENT</div><h2>Ship updates with confidence.</h2><p>Create release records, upload APK assets and control the rollout channel. Client-side OTA manifest integration is a separate app update.</p>{canRelease&&<button className="button button-primary" onClick={()=>{setSelected(null);setModal("release");}}><Plus size={16}/> Create new release</button>}</div><div className="ota-hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="rocket-card"><Package size={36}/><span>APK</span><i><Check size={13}/></i></div><div className="floating-chip chip-a"><CheckCircle2 size={14}/> Release registry</div><div className="floating-chip chip-b"><RadioTower size={14}/> Staged rollout</div></div></div>
 <div className="ota-metrics"><div className="mini-metric"><span>Total releases</span><strong>{releases.length}</strong><small>All channels</small></div><div className="mini-metric"><span>Published</span><strong>{releases.filter(x=>x.status==="published").length}</strong><small>In release registry</small></div><div className="mini-metric"><span>Drafts</span><strong>{releases.filter(x=>x.status==="draft").length}</strong><small>Awaiting publication</small></div><div className="mini-metric"><span>Paused / rolled back</span><strong>{releases.filter(x=>["paused","rolled_back"].includes(x.status)).length}</strong><small>Not actively rolling out</small></div></div>
 <section className="panel releases-panel"><div className="panel-heading"><div><h3>{channelOnly?"Release channels":"Release history"}</h3><p>Real records stored in your Supabase release registry</p></div><select className="select-button" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All channels</option><option value="stable">Stable</option><option value="beta">Beta</option><option value="testing">Testing</option></select></div><div className="table-wrap"><table><thead><tr><th>VERSION</th><th>CHANNEL</th><th>PLATFORM</th><th>ROLLOUT</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{shown.map(r=><tr key={r.id}><td><strong className="version-name">{r.version}</strong><small>Build {r.version_code}</small></td><td><span className={"channel-pill "+r.channel}>{r.channel}</span></td><td>{r.platform}</td><td><div className="rollout-cell"><div className="progress-track"><i style={{width:r.rollout_percent+"%"}}/></div><span>{r.rollout_percent}%</span></div></td><td><span className={"release-status "+r.status}><i/>{r.status}</span></td><td><div className="table-actions">{canRelease&&r.status==="draft"&&<button onClick={()=>action(r.id,"publish")}>Publish</button>}{canRelease&&r.status==="published"&&<button onClick={()=>action(r.id,"pause")}>Pause</button>}{canRelease&&r.status==="published"&&<button onClick={()=>action(r.id,"rollback")}>Rollback</button>}</div></td></tr>)}</tbody></table>{!shown.length&&<div className="empty-state">No releases found for this channel. Create your first release to get started.</div>}</div><div className="table-footer"><span>{shown.length} release records</span><span>Version codes must increase within a channel.</span></div></section>
 <div className="ota-bottom"><div className="notice-box"><ShieldCheck size={18}/><div><strong>Protected release publishing</strong><span>API checks admin role and version-code ordering before publishing.</span></div></div><div className="notice-box warning"><AlertTriangle size={18}/><div><strong>OTA app integration pending</strong><span>AnimePlex-V1 still reads upstream GitHub Releases. These records won't reach installed apps until the Flutter updater is migrated.</span></div></div></div>
 </>;
}

function UsersPage({users,api,refresh,notify,role}) {
 const [search,setSearch]=useState("");const [page,setPage]=useState(1);const [rows,setRows]=useState(users);const [loading,setLoading]=useState(false);
 useEffect(()=>{setRows(users);setPage(1);},[users]);
 const shown=rows.filter(u=>(u.email||"").toLowerCase().includes(search.toLowerCase())||(u.profile?.display_name||"").toLowerCase().includes(search.toLowerCase()));
 async function goPage(next){setLoading(true);try{const result=await api("users","GET",null,"?page="+next+"&limit=30");setRows(result.users||[]);setPage(next);}catch(e){notify(e.message);}finally{setLoading(false);}}
 async function act(u,action){if(!confirm(action==="delete"?"Permanently delete this account and its AnimePlex data? This cannot be undone.":action==="ban"?"Suspend this account?":"Restore this account?"))return;try{await api("users","POST",{userId:u.id,action,duration:"720h"});notify("User "+action+" completed.");refresh();}catch(e){notify(e.message);}}
 return <section className="panel data-panel"><div className="panel-heading"><div><h3>User management</h3><p>{rows.length} accounts on page {page} · Supabase Auth</p></div><div className="table-search"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search email or name"/></div></div><div className="table-wrap"><table><thead><tr><th>USER</th><th>CREATED</th><th>LAST SIGN-IN</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{shown.map(u=><tr key={u.id}><td><strong className="version-name">{u.profile?.display_name||u.email||"Unknown user"}</strong><small>{u.email} · {shortId(u.id)}</small></td><td>{fmt(u.created_at)}</td><td>{fmt(u.last_sign_in_at)}</td><td><span className={"release-status "+(isSuspended(u)?"paused":"published")}><i/>{isSuspended(u)?"Suspended":"Active"}</span></td><td><div className="table-actions">{["owner","admin"].includes(role)&&(isSuspended(u)?<button onClick={()=>act(u,"unban")}>Restore</button>:<button onClick={()=>act(u,"ban")}>Suspend</button>)}{role==="owner"&&<button className="danger-text" onClick={()=>act(u,"delete")}>Delete</button>}{!["owner","admin"].includes(role)&&<span>Read only</span>}</div></td></tr>)}</tbody></table>{!shown.length&&<div className="empty-state">No matching users.</div>}</div><div className="table-footer"><span>Showing up to 30 accounts</span><div className="pagination"><button disabled={page<=1||loading} onClick={()=>goPage(page-1)}><ChevronLeft size={13}/> Previous</button><span>Page {page}</span><button disabled={rows.length<30||loading} onClick={()=>goPage(page+1)}>Next <ChevronRight size={13}/></button></div></div></section>;
}
function ContentPage({items,api,refresh,notify,setSelected,setModal,canEdit}) {
 async function toggle(item){try{await api("content","PATCH",{id:item.id,is_active:!item.is_active});refresh();}catch(e){notify(e.message);}}
 async function remove(item){if(!confirm("Delete this featured content entry?"))return;try{await api("content","DELETE",{id:item.id});notify("Featured content deleted.");refresh();}catch(e){notify(e.message);}}
 return <section className="panel data-panel"><div className="panel-heading"><div><h3>Featured content</h3><p>Manage curated titles, artwork links, categories and destination URLs.</p></div><span className="preview-pill">CONTENT REGISTRY</span></div><div className="featured-grid">{items.map(item=><article className="featured-card" key={item.id}>{item.image_url?<img src={item.image_url} alt="" loading="lazy"/>:<div className="featured-placeholder"><Film size={25}/></div>}<div className="featured-copy"><span>{item.category} · #{item.position}</span><strong>{item.title}</strong><p>{item.description||"No description"}</p><div className="featured-actions"><span className={"release-status "+(item.is_active?"published":"paused")}><i/>{item.is_active?"Active":"Hidden"}</span>{canEdit&&<><button onClick={()=>{setSelected(item);setModal("content");}}>Edit</button><button onClick={()=>toggle(item)}>{item.is_active?"Hide":"Show"}</button><button className="danger-text" onClick={()=>remove(item)}>Delete</button></>}</div></div></article>)}{!items.length&&<div className="empty-state">No featured titles yet. Add a title with artwork and a destination URL.</div>}</div><div className="notice-box warning"><AlertTriangle size={17}/><span>Featured content is stored in the admin registry. AnimePlex-V1 needs a small app-side feed integration before these entries appear on the home screen.</span></div></section>;
}

function ContentModal({selected,close,api,notify,refresh}) {
 const [form,setForm]=useState({title:selected?.title||"",description:selected?.description||"",category:selected?.category||"featured",image_url:selected?.image_url||"",target_url:selected?.target_url||"",position:selected?.position||0,is_active:selected?.is_active??true});const [busy,setBusy]=useState(false);
 async function submit(e){e.preventDefault();setBusy(true);try{await api("content",selected?"PATCH":"POST",selected?{id:selected.id,...form}:form);notify("Featured content saved.");close();refresh();}catch(err){notify(err.message);}finally{setBusy(false);}}
 return <Modal title={selected?"Edit featured content":"Add featured content"} subtitle="Manage a curated card for the AnimePlex home feed." close={close}><form className="modal-form" onSubmit={submit}><label><span className="field-label">Title</span><input className="text-input" required maxLength="160" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label><span className="field-label">Description</span><textarea className="text-input textarea" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><div className="form-grid"><label><span className="field-label">Category</span><input className="text-input" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label><label><span className="field-label">Display position</span><input className="text-input" type="number" min="0" value={form.position} onChange={e=>setForm({...form,position:e.target.value})}/></label></div><label><span className="field-label">Artwork image URL</span><input className="text-input" type="url" value={form.image_url} onChange={e=>setForm({...form,image_url:e.target.value})} placeholder="https://…"/></label><label><span className="field-label">Destination URL</span><input className="text-input" type="url" value={form.target_url} onChange={e=>setForm({...form,target_url:e.target.value})} placeholder="https://…"/></label><label className="checkbox-line"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Publish in feed when app integration is ready</label><div className="modal-actions"><button type="button" className="button button-quiet" onClick={close}>Cancel</button><button className="button button-primary" disabled={busy}>{busy?"Saving…":"Save featured title"}</button></div></form></Modal>;
}

function AnnouncementsPage({items,api,refresh,setSelected,setModal,canEdit}) {
 async function toggle(item){try{await api("announcements","PATCH",{id:item.id,is_active:!item.is_active});refresh();}catch(e){alert(e.message);}}
 async function remove(item){if(!confirm("Delete this announcement?"))return;try{await api("announcements","DELETE",{id:item.id});refresh();}catch(e){alert(e.message);}}
 return <section className="panel data-panel"><div className="panel-heading"><div><h3>App announcements</h3><p>Messages stored in the admin announcement registry.</p></div>{canEdit&&<button className="button button-primary" onClick={()=>{setSelected(null);setModal("announcement");}}><Plus size={15}/> New announcement</button>}</div><div className="announcement-list">{items.map(item=><div className="announcement-row" key={item.id}><div className={"announcement-type "+item.type}>{item.type==="warning"?<AlertTriangle size={17}/>:<Bell size={17}/>}</div><div className="announcement-copy"><strong>{item.title}</strong><p>{item.body}</p><small>{fmt(item.created_at)} · {item.type}</small></div><span className={"release-status "+(item.is_active?"published":"paused")}><i/>{item.is_active?"Active":"Disabled"}</span><div className="table-actions">{canEdit&&<><button onClick={()=>{setSelected(item);setModal("announcement");}}>Edit</button><button onClick={()=>toggle(item)}>{item.is_active?"Disable":"Enable"}</button><button className="danger-text" onClick={()=>remove(item)}>Delete</button></>}</div></div>)}{!items.length&&<div className="empty-state">No announcements yet. Create one to start preparing user-facing messages.</div>}</div><div className="notice-box warning"><AlertTriangle size={17}/><span>The current AnimePlex-V1 app reads its announcement feed from a GitHub raw JSON URL. This admin registry will require a small Flutter feed-source change before these messages appear in the app.</span></div></section>;
}

function ConfigPage({items,api,refresh,notify,canEdit}) {
 const [values,setValues]=useState({});
 useEffect(()=>{const next={};items.forEach(x=>next[x.key]=x.value);setValues(next);},[items]);
 const fields=[["maintenance_mode","Maintenance mode","boolean"],["minimum_supported_version","Minimum supported version","text"],["latest_version","Latest version","text"],["support_url","Support URL","text"],["discord_url","Community Discord URL","text"],["home_message","Home message","text"]];
 async function save(key,value){try{await api("config","PUT",{key,value});notify("Saved "+key+".");await refresh();}catch(e){notify(e.message);}}
 return <div className="settings-layout"><section className="panel data-panel"><div className="panel-heading"><div><h3>Remote app configuration</h3><p>Values stored centrally for future mobile-app config sync.</p></div><span className="preview-pill">LIVE API</span></div>{fields.map(([key,label,type])=><div className="setting-row" key={key}><div><strong>{label}</strong><small>{key}</small></div>{type==="boolean"?<button type="button" role="switch" aria-label={label} aria-checked={Boolean(values[key])} disabled={!canEdit} className={values[key]?"toggle-switch on":"toggle-switch"} onClick={()=>save(key,!values[key])}><i/></button>:<div className="setting-control"><input className="text-input" value={values[key]??""} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))} placeholder="Not configured" disabled={!canEdit}/><button className="button button-quiet" disabled={!canEdit} onClick={()=>save(key,values[key]??"")}>Save</button></div>}</div>)}<div className="notice-box warning"><AlertTriangle size={17}/><span>These settings are stored in Supabase. The Flutter app does not yet fetch this remote config; app-side integration is required before toggles affect user devices.</span></div></section><section className="panel"><h3>Configuration safety</h3><p className="muted-copy">Only allow-listed keys can be updated through the API. Each change is written to the admin audit log.</p><div className="health-score"><div className="health-ring"><ShieldCheck size={22}/></div><div><strong>Server-side permission checks</strong><span>Owner and Admin roles required.</span></div></div></section></div>;
}

function DevicesPage({items,api,refresh,notify,canEdit}) {
 async function expire(item){if(!confirm("Expire this pending TV pairing code?"))return;try{await api("devices","POST",{id:item.id,action:"expire"});notify("Pairing request expired.");refresh();}catch(e){notify(e.message);}}
 return <section className="panel data-panel"><div className="panel-heading"><div><h3>TV pairing requests</h3><p>Safe metadata from the existing TV pairing service. Secrets and tracker tokens are never exposed.</p></div><span className="preview-pill">SENSITIVE FIELDS REDACTED</span></div><div className="table-wrap"><table><thead><tr><th>DEVICE</th><th>PAIR CODE</th><th>STATUS</th><th>EXPIRES</th><th>CREATED</th><th>ACTION</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td><strong className="version-name">{x.device_name||"Android TV"}</strong><small>{shortId(x.app_user_id)}</small></td><td>{x.code}</td><td><span className={"release-status "+(x.status==="pending"?"paused":"published")}><i/>{x.status}</span></td><td>{fmt(x.expires_at?Number(x.expires_at):null)}</td><td>{fmt(x.created_at)}</td><td>{x.status==="pending"&&canEdit?<button className="table-action" onClick={()=>expire(x)}>Expire code</button>:"—"}</td></tr>)}</tbody></table>{!items.length&&<div className="empty-state">No TV pairing requests found.</div>}</div><div className="notice-box warning"><LockKeyhole size={17}/><span>Pairing secrets, app login tokens and tracker blobs are deliberately excluded from this view.</span></div></section>;
}

function BackupsPage({items}){return <section className="panel data-panel"><div className="panel-heading"><div><h3>User backup records</h3><p>Metadata only. Backup payloads are never sent to this browser.</p></div><span className="preview-pill">READ ONLY</span></div><div className="table-wrap"><table><thead><tr><th>USER KEY</th><th>LAST UPDATED</th><th>PAYLOAD</th></tr></thead><tbody>{items.map(x=><tr key={x.user_key}><td>{shortId(x.user_key)}</td><td>{fmt(x.updated_at)}</td><td><span className="release-status published"><i/>Protected</span></td></tr>)}</tbody></table>{!items.length&&<div className="empty-state">No user backup metadata found.</div>}</div><div className="notice-box warning"><LockKeyhole size={17}/><span>Restore is intentionally not exposed yet. A safe restore flow needs an explicit target user, backup validation, pre-restore snapshot and owner confirmation.</span></div></section>;}
function AuditPage({items}){return <section className="panel data-panel"><div className="panel-heading"><div><h3>Admin audit trail</h3><p>Latest privileged actions and changes.</p></div><span className="preview-pill">IMMUTABLE LOG VIEW</span></div><div className="table-wrap"><table><thead><tr><th>TIME</th><th>ACTOR</th><th>ACTION</th><th>TARGET</th><th>DETAILS</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td>{fmt(x.created_at)}</td><td>{x.actor_email||shortId(x.actor_id)}</td><td><strong className="version-name">{x.action}</strong></td><td>{x.target_type} · {shortId(x.target_id)}</td><td><code>{JSON.stringify(x.details||{})}</code></td></tr>)}</tbody></table>{!items.length&&<div className="empty-state">No audit events yet.</div>}</div></section>;}
function AdminsPage({items,api,refresh,notify,isOwner}){const [email,setEmail]=useState("");const [role,setRole]=useState("admin");async function grant(e){e.preventDefault();try{await api("admins","POST",{email,role});setEmail("");notify("Admin role granted.");refresh();}catch(err){notify(err.message);}}async function toggle(x){try{await api("admins","PATCH",{user_id:x.user_id,is_active:!x.is_active});refresh();}catch(e){notify(e.message);}}return <div className="settings-layout"><section className="panel data-panel"><div className="panel-heading"><div><h3>Administrator accounts</h3><p>Only existing Supabase Auth users can be granted access.</p></div><span className="preview-pill">OWNER CONTROL</span></div>{isOwner&&<form className="grant-form" onSubmit={grant}><input className="text-input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Existing user email"/><select className="text-input" value={role} onChange={e=>setRole(e.target.value)}>{ROLES.map(r=><option key={r}>{r}</option>)}</select><button className="button button-primary"><Plus size={14}/> Grant access</button></form>}<div className="table-wrap"><table><thead><tr><th>USER ID</th><th>ROLE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{items.map(x=><tr key={x.user_id}><td>{x.user_id}</td><td>{x.role}</td><td>{x.is_active?"Active":"Disabled"}</td><td><button className="table-action" disabled={!isOwner||x.role==="owner"} onClick={()=>toggle(x)}>{x.is_active?"Disable":"Enable"}</button></td></tr>)}</tbody></table>{!items.length&&<div className="empty-state">No admin accounts loaded.</div>}</div></section><section className="panel"><h3>Role permissions</h3><div className="role-list">{ROLES.map(r=><div key={r}><strong>{r}</strong><span>{({owner:"All access, role management and account deletion",admin:"User and app operations",release_manager:"OTA publishing and rollout controls",moderator:"Announcements",auditor:"Read-only audit and operational views"})[r]}</span></div>)}</div></section></div>;}
function HealthPage({items}){return <section className="panel data-panel"><div className="panel-heading"><div><h3>Infrastructure health</h3><p>Server-side connectivity probes.</p></div><span className="health-overall"><i/> Live checks</span></div><div className="health-service-grid">{items.map(x=><div className="health-service" key={x.name}><div className="service-icon"><Server size={18}/></div><strong>{x.name}</strong><span className={"release-status "+(x.status==="operational"?"published":"paused")}><i/>{x.status}</span><small>{x.detail}</small></div>)}</div></section>;}
function InfoPage({active,go}){return <div className="module-layout"><div className="module-banner"><div className="module-banner-icon"><Settings size={25}/></div><div><h2>{active}</h2><p>{active==="Devices"?"This view shows secure TV pairing requests from the existing pairing table; it is not a complete inventory of every signed-in device.":"Central content catalogue management needs a dedicated content schema and app-side sync contract."}</p></div><span className="preview-pill">INTEGRATION PENDING</span></div><section className="panel integration-panel"><div className="integration-icon"><LockKeyhole size={21}/></div><div><h3>Waiting for app-side telemetry/API</h3><p>We will not display invented device counts or pretend a local setting controls the installed app. This module becomes live when AnimePlex-V1 exposes the corresponding secure API.</p><button className="button button-quiet" onClick={()=>go("Overview")}>Back to overview</button></div></section></div>;}

function ReleaseModal({close,api,notify,refresh,preview}) {
 const [file,setFile]=useState(null);const [form,setForm]=useState({version:"",version_code:"",platform:"android",channel:"stable",mandatory:false,rollout_percent:10,release_notes:""});const [busy,setBusy]=useState(false);
 async function submit(e){e.preventDefault();if(!file)return notify("Select an APK first.");setBusy(true);try{
  const {createSHA256}=await import('hash-wasm');const hasher=await createSHA256();hasher.init();const reader=file.stream().getReader();while(true){const part=await reader.read();if(part.done)break;hasher.update(new Uint8Array(part.value));}const sha256=hasher.digest("hex");
  const ticket=await api("releases","POST",{action:"create-upload",fileName:file.name});
  if(!preview){const {error:uploadError}=await supabase.storage.from("animeplex-releases").uploadToSignedUrl(ticket.path,ticket.token,file,{contentType:"application/vnd.android.package-archive",upsert:false});if(uploadError)throw uploadError;}
  await api("releases","POST",{action:"create",...form,version_code:Number(form.version_code),rollout_percent:Number(form.rollout_percent),storage_path:ticket.path,file_size:file.size,sha256});
  notify("Release saved as draft.");close();refresh();
 }catch(err){notify(err.message||"Upload failed.");}finally{setBusy(false);}}
 return <Modal title="Create OTA release" subtitle="Upload an Android package and prepare a release draft." close={close}><form onSubmit={submit} className="modal-form"><label className="field-label">Release package <span>APK only</span></label><label className="upload-zone"><UploadCloud size={24}/><strong>{file?file.name:"Choose APK file"}</strong><span>{file?(file.size/1024/1024).toFixed(1)+" MB":"Package uploads to storage when connected"}</span><input hidden type="file" accept=".apk" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><div className="form-grid"><label><span className="field-label">Version name</span><input className="text-input" required value={form.version} onChange={e=>setForm({...form,version:e.target.value})} placeholder="2.5.0"/></label><label><span className="field-label">Version code</span><input className="text-input" required type="number" min="1" value={form.version_code} onChange={e=>setForm({...form,version_code:e.target.value})} placeholder="20500"/></label></div><div className="form-grid"><label><span className="field-label">Platform</span><select className="text-input" value={form.platform} onChange={e=>setForm({...form,platform:e.target.value})}><option value="android">Android</option><option value="android_tv">Android TV</option></select></label><label><span className="field-label">Channel</span><select className="text-input" value={form.channel} onChange={e=>setForm({...form,channel:e.target.value})}><option value="stable">Stable</option><option value="beta">Beta</option><option value="testing">Testing</option></select></label></div><label><span className="field-label">Rollout percentage <b>{form.rollout_percent}%</b></span><input className="range-input" type="range" min="1" max="100" step="1" value={form.rollout_percent} onChange={e=>setForm({...form,rollout_percent:e.target.value})}/></label><label className="checkbox-line"><input type="checkbox" checked={form.mandatory} onChange={e=>setForm({...form,mandatory:e.target.checked})}/> Mark as mandatory update</label><label><span className="field-label">Release notes</span><textarea className="text-input textarea" value={form.release_notes} onChange={e=>setForm({...form,release_notes:e.target.value})} placeholder="What's new?"/></label><div className="notice-box warning"><AlertTriangle size={16}/><span>This creates a draft in the admin registry. The existing Flutter app must be updated to read this release manifest before users receive it.</span></div><div className="modal-actions"><button type="button" className="button button-quiet" onClick={close}>Cancel</button><button className="button button-primary" disabled={busy}>{busy?"Uploading…":"Upload and save draft"}</button></div></form></Modal>;
}
function AnnouncementModal({selected,close,api,notify,refresh}){const [form,setForm]=useState({title:selected?.title||"",body:selected?.body||"",type:selected?.type||"info",is_active:selected?.is_active??true,action_url:selected?.action_url||""});const [busy,setBusy]=useState(false);async function submit(e){e.preventDefault();setBusy(true);try{await api("announcements",selected?"PATCH":"POST",selected?{id:selected.id,...form}:form);notify(selected?"Announcement updated.":"Announcement created.");close();refresh();}catch(err){notify(err.message);}finally{setBusy(false);}}return <Modal title={selected?"Edit announcement":"New announcement"} subtitle="Prepare a message for the AnimePlex app." close={close}><form onSubmit={submit} className="modal-form"><label><span className="field-label">Title</span><input className="text-input" maxLength="120" required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label><span className="field-label">Message</span><textarea className="text-input textarea" value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/></label><div className="form-grid"><label><span className="field-label">Type</span><select className="text-input" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="info">Info</option><option value="warning">Warning</option><option value="update">Update</option></select></label><label><span className="field-label">Action URL (optional)</span><input className="text-input" type="url" value={form.action_url} onChange={e=>setForm({...form,action_url:e.target.value})} placeholder="https://…"/></label></div><label className="checkbox-line"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Enable announcement</label><div className="modal-actions"><button type="button" className="button button-quiet" onClick={close}>Cancel</button><button className="button button-primary" disabled={busy}>{busy?"Saving…":selected?"Save changes":"Create announcement"}</button></div></form></Modal>;}
function Modal({title,subtitle,close,children}){useEffect(()=>{const onKeyDown=event=>{if(event.key==='Escape')close();};window.addEventListener('keydown',onKeyDown);return()=>window.removeEventListener('keydown',onKeyDown);},[close]);return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><div className="release-modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div><div className="eyebrow">ADMIN ACTION</div><h2>{title}</h2><p>{subtitle}</p></div><IconButton label="Close" onClick={close}><X size={18}/></IconButton></div>{children}</div></div>;}
