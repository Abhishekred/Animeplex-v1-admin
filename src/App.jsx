import { useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, Check,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  Cloud, Command, Cpu, Database, DownloadCloud, ExternalLink, FileArchive,
  FileCheck2, FileClock, Film, Gauge, HardDrive, LayoutDashboard, LifeBuoy,
  LockKeyhole, LogOut, Menu, MessageSquareText, Moon, MoreHorizontal,
  Package, Plus, RadioTower, Search, Server, Settings, Shield, ShieldCheck,
  Smartphone, Sparkles, UploadCloud, Users, Wifi, X, Zap
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";

const navGroups = [
  { label: "WORKSPACE", items: [
    ["Overview", LayoutDashboard], ["Users", Users], ["Devices", Smartphone],
    ["Content", Film], ["Announcements", MessageSquareText]
  ]},
  { label: "DISTRIBUTION", items: [
    ["OTA Updates", DownloadCloud], ["Release Channels", RadioTower], ["App Configuration", Settings]
  ]},
  { label: "INFRASTRUCTURE", items: [
    ["System Health", Activity], ["Backups", Database], ["Logs & Audit", FileClock]
  ]},
  { label: "ADMINISTRATION", items: [
    ["Admin Access", ShieldCheck], ["Settings", Settings]
  ]}
];

const traffic = [
  { day: "Mon", users: 820 }, { day: "Tue", users: 1080 },
  { day: "Wed", users: 970 }, { day: "Thu", users: 1420 },
  { day: "Fri", users: 1260 }, { day: "Sat", users: 1740 },
  { day: "Sun", users: 1980 }
];

const releases = [
  { version: "2.4.0", channel: "Stable", date: "Nov 08, 2026", status: "Published", rollout: 100 },
  { version: "2.5.0-beta.2", channel: "Beta", date: "Nov 06, 2026", status: "Testing", rollout: 15 },
  { version: "2.5.0-beta.1", channel: "Beta", date: "Nov 02, 2026", status: "Paused", rollout: 0 }
];

function IconButton({ children, label, onClick }) {
  return <button className="icon-button" aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

function App() {
  const [active, setActive] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(false);
  const [releaseType, setReleaseType] = useState("Optional update");
  const [rollout, setRollout] = useState(25);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileRef = useRef(null);

  const notify = (message) => {
    setToast(message);
    window.clearTimeout(window.__animeplexToast);
    window.__animeplexToast = window.setTimeout(() => setToast(""), 3200);
  };

  const pageTitle = active === "Overview" ? "Dashboard overview" : active;
  const filteredNav = useMemo(() => navGroups.map(group => ({
    ...group, items: group.items.filter(([name]) => name.toLowerCase().includes(query.toLowerCase()))
  })).filter(group => group.items.length), [query]);

  const pageIntro = {
    "Overview": "Your AnimePlex ecosystem at a glance.",
    "OTA Updates": "Build, stage and distribute app releases safely.",
    "Users": "Manage accounts, access and user activity.",
    "Devices": "Review connected devices and active sessions.",
    "Content": "Manage featured collections and app content.",
    "Announcements": "Communicate updates and service notices.",
    "Release Channels": "Control Stable, Beta and Testing distribution.",
    "App Configuration": "Manage remote app behaviour and feature flags.",
    "System Health": "Monitor connected services and infrastructure.",
    "Backups": "Review backup history and recovery readiness.",
    "Logs & Audit": "Trace admin actions and system events.",
    "Admin Access": "Manage administrator roles and permissions.",
    "Settings": "Configure dashboard preferences and security."
  }[active] || "Manage your AnimePlex platform.";

  const stats = [
    { label: "Total users", value: "12,480", delta: "+12.8%", up: true, icon: Users, tone: "violet", note: "vs. last 30 days" },
    { label: "Active today", value: "2,846", delta: "+8.4%", up: true, icon: Activity, tone: "green", note: "unique active users" },
    { label: "Current version", value: "v2.4.0", delta: "Stable", up: true, icon: Smartphone, tone: "blue", note: "latest production build" },
    { label: "Release health", value: "Healthy", delta: "All clear", up: true, icon: ShieldCheck, tone: "orange", note: "no active incidents" }
  ];

  return (
    <div className={dark ? "app-shell dark" : "app-shell light"}>
      <aside className={sidebarOpen ? "sidebar sidebar-open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark"><span>A</span><i /></div>
          <div className="brand-copy"><strong>ANIMEPLEX</strong><small>CONTROL CENTER</small></div>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)}><X size={18}/></button>
        </div>
        <div className="workspace-switch">
          <div className="workspace-icon">AP</div>
          <div><strong>AnimePlex</strong><small>Production workspace</small></div>
          <ChevronDown size={15} className="muted"/>
        </div>
        <div className="nav-search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a page..." /><kbd>⌘ K</kbd></div>
        <nav className="navigation">
          {filteredNav.map(group => <div className="nav-group" key={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.items.map(([name, Icon]) => <button key={name} className={active === name ? "nav-item active" : "nav-item"} onClick={() => { setActive(name); setSidebarOpen(false); }}>
              <Icon size={17}/><span>{name}</span>{name === "OTA Updates" && <i className="nav-dot"/>}
            </button>)}
          </div>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><LifeBuoy size={17}/></div><strong>Need a hand?</strong><p>Read the admin guide or check setup status.</p><button onClick={() => notify("Documentation module is coming soon.")}>Open documentation <ExternalLink size={12}/></button></div>
          <div className="profile-row"><div className="avatar">AD</div><div className="profile-copy"><strong>Admin</strong><small>Owner access</small></div><MoreHorizontal size={18} className="muted"/></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={19}/></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14}/><strong>{active}</strong></div></div>
          <div className="topbar-actions"><div className="environment"><i/> Production</div><IconButton label="Search" onClick={() => document.querySelector(".nav-search input")?.focus()}><Search size={17}/></IconButton><IconButton label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Moon size={17}/> : <Sparkles size={17}/>}</IconButton><span className="top-divider"/><button className="notification-button" onClick={() => notify("You're all caught up.")}><Bell size={18}/><i/></button><div className="top-avatar">AD</div></div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-line"/> CONTROL CENTER</div><h1>{pageTitle}</h1><p>{pageIntro}</p></div>
            <div className="heading-actions"><button className="button button-quiet" onClick={() => notify("Last synced just now (demo).")}><Activity size={15}/> Live status <span className="live-pulse"/></button><button className="button button-primary" onClick={() => { setActive("OTA Updates"); setModal(true); }}><Plus size={16}/> New release</button></div>
          </div>

          {active === "Overview" ? <Overview stats={stats} notify={notify} setActive={setActive}/> :
           active === "OTA Updates" ? <OtaPage releases={releases} setModal={setModal} notify={notify}/> :
           <ModulePage active={active} notify={notify} setActive={setActive}/>}

          <footer className="footer"><span>© 2026 AnimePlex Admin</span><span><i className="footer-status"/> All systems operational <b>·</b> Dashboard preview v1.0</span></footer>
        </div>
      </main>

      {modal && <div className="modal-backdrop" onMouseDown={e => { if(e.target === e.currentTarget) setModal(false); }}>
        <div className="release-modal">
          <div className="modal-head"><div><div className="eyebrow">DISTRIBUTION</div><h2>Create OTA release</h2><p>Prepare a new app version for distribution.</p></div><IconButton label="Close" onClick={() => setModal(false)}><X size={18}/></IconButton></div>
          <div className="modal-body">
            <label className="field-label">Release file <span>APK / AAB</span></label>
            <button className="upload-zone" onClick={() => fileRef.current?.click()}><div className="upload-icon"><UploadCloud size={23}/></div><strong>{selectedFile ? selectedFile.name : "Drop your release file here"}</strong><span>{selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(1) + " MB selected" : "or browse files · APK up to 2 GB"}</span><input ref={fileRef} type="file" accept=".apk,.aab" hidden onChange={e => setSelectedFile(e.target.files?.[0] || null)}/></button>
            <div className="form-grid"><label><span className="field-label">Version name</span><input className="text-input" placeholder="e.g. 2.5.0"/></label><label><span className="field-label">Version code</span><input className="text-input" type="number" placeholder="e.g. 20500"/></label></div>
            <label><span className="field-label">Release channel</span><select className="text-input"><option>Stable</option><option>Beta</option><option>Testing</option></select></label>
            <label><span className="field-label">Update behaviour</span><select className="text-input" value={releaseType} onChange={e => setReleaseType(e.target.value)}><option>Optional update</option><option>Mandatory update</option></select></label>
            <label><span className="field-label">Rollout percentage <b>{rollout}%</b></span><input className="range-input" type="range" min="5" max="100" step="5" value={rollout} onChange={e => setRollout(Number(e.target.value))}/><div className="range-labels"><span>5% · Canary</span><span>100% · Everyone</span></div></label>
            <label><span className="field-label">Release notes</span><textarea className="text-input textarea" placeholder="What's new in this version?"/></label>
            <div className="notice-box"><ShieldCheck size={17}/><span>Release publishing will require server-side permission checks, checksum validation and a signed release manifest. This form is currently a UI preview.</span></div>
          </div>
          <div className="modal-actions"><button className="button button-quiet" onClick={() => setModal(false)}>Cancel</button><button className="button button-primary" onClick={() => { setModal(false); notify("Preview only — release API is not connected yet."); }}>Save release draft <ChevronRight size={15}/></button></div>
        </div>
      </div>}
      {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}<button onClick={() => setToast("")}><X size={14}/></button></div>}
    </div>
  );
}

function Overview({ stats, notify, setActive }) {
  return <>
    <div className="stats-grid">{stats.map(({label,value,delta,up,icon:Icon,tone,note}) => <div className="stat-card" key={label}><div className="stat-top"><span>{label}</span><div className={"stat-icon "+tone}><Icon size={18}/></div></div><div className="stat-value">{value}</div><div className="stat-foot"><span className="stat-delta"><ArrowUpRight size={13}/>{delta}</span><span>{note}</span></div></div>)}</div>
    <div className="overview-grid">
      <section className="panel chart-panel"><div className="panel-heading"><div><h3>Audience activity</h3><p>Daily active users across the platform</p></div><button className="select-button">Last 7 days <ChevronDown size={14}/></button></div><div className="chart-summary"><strong>8,290</strong><span className="positive"><ArrowUpRight size={14}/> 14.6%</span><small>active users this week</small></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={traffic} margin={{top:8,right:8,left:-22,bottom:0}}><defs><linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9b7cff" stopOpacity={0.28}/><stop offset="100%" stopColor="#9b7cff" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="var(--line)" vertical={false} strokeDasharray="3 5"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:"var(--muted)",fontSize:11}} dy={10}/><YAxis axisLine={false} tickLine={false} tick={{fill:"var(--muted)",fontSize:11}}/><Tooltip contentStyle={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,color:"var(--text)"}}/><Area type="monotone" dataKey="users" stroke="#9b7cff" strokeWidth={2.5} fill="url(#userGradient)" activeDot={{r:5,strokeWidth:0}}/></AreaChart></ResponsiveContainer></div></section>
      <section className="panel health-panel"><div className="panel-heading"><div><h3>System health</h3><p>Connected services status</p></div><span className="health-overall"><i/> Healthy</span></div><div className="health-score"><div className="health-ring"><ShieldCheck size={25}/></div><div><strong>All systems normal</strong><span>No incidents detected in this preview</span></div></div><div className="service-list">{[["Supabase","Database & authentication",Database],["Cloudflare","Workers & edge network",Cloud],["Object storage","Release and backup files",HardDrive],["API gateway","Application endpoints",RadioTower]].map(([name,desc,Icon])=><div className="service-row" key={name}><div className="service-icon"><Icon size={16}/></div><div className="service-copy"><strong>{name}</strong><span>{desc}</span></div><span className="service-status"><i/> Operational</span></div>)}</div><button className="text-link" onClick={() => setActive("System Health")}>View system health <ChevronRight size={14}/></button></section>
    </div>
    <div className="bottom-grid">
      <section className="panel activity-panel"><div className="panel-heading"><div><h3>Recent activity</h3><p>Latest events from your workspace</p></div><button className="text-link" onClick={() => setActive("Logs & Audit")}>View audit log <ChevronRight size={14}/></button></div><div className="activity-list">{[{icon:DownloadCloud,title:"Release v2.4.0 published",desc:"Stable channel · Release manager",time:"2h ago",tone:"purple"},{icon:Users,title:"New user registrations",desc:"124 accounts created today",time:"4h ago",tone:"blue"},{icon:Database,title:"Scheduled backup completed",desc:"Database snapshot · 1.8 GB",time:"Yesterday",tone:"green"}].map(({icon:Icon,title,desc,time,tone})=><div className="activity-row" key={title}><div className={"activity-icon "+tone}><Icon size={16}/></div><div className="activity-copy"><strong>{title}</strong><span>{desc}</span></div><time>{time}</time></div>)}</div></section>
      <section className="panel quick-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Common admin tasks</p></div><Command size={17} className="muted"/></div><div className="quick-actions"><button onClick={() => setActive("OTA Updates")}><div className="quick-icon orange"><UploadCloud size={17}/></div><span><strong>Upload OTA release</strong><small>Distribute a new app version</small></span><ChevronRight size={16}/></button><button onClick={() => setActive("Announcements")}><div className="quick-icon blue"><MessageSquareText size={17}/></div><span><strong>Send announcement</strong><small>Notify users about changes</small></span><ChevronRight size={16}/></button><button onClick={() => notify("Backup request queued in preview mode.")}><div className="quick-icon green"><Database size={17}/></div><span><strong>Run a backup</strong><small>Create a recovery point</small></span><ChevronRight size={16}/></button></div></section>
    </div>
  </>;
}

function OtaPage({ releases, setModal, notify }) {
  return <>
    <div className="ota-hero"><div className="ota-hero-copy"><div className="ota-tag"><Zap size={13}/> RELEASE MANAGEMENT</div><h2>Ship updates with confidence.</h2><p>Manage app builds, control rollout speed and keep every device on a supported version.</p><button className="button button-primary" onClick={() => setModal(true)}><Plus size={16}/> Create new release</button></div><div className="ota-hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="rocket-card"><Package size={36}/><span>APK</span><i><Check size={13}/></i></div><div className="floating-chip chip-a"><CheckCircle2 size={14}/> Verified</div><div className="floating-chip chip-b"><RadioTower size={14}/> Rollout ready</div></div></div>
    <div className="ota-metrics"><div className="mini-metric"><span>Latest stable</span><strong>v2.4.0</strong><small><i className="status-dot"/> Published to 100%</small></div><div className="mini-metric"><span>Active releases</span><strong>2</strong><small>Across 2 channels</small></div><div className="mini-metric"><span>Update adoption</span><strong>87.4%</strong><small className="positive">+6.2% this week</small></div><div className="mini-metric"><span>Pending updates</span><strong>1,582</strong><small>Devices eligible</small></div></div>
    <section className="panel releases-panel"><div className="panel-heading"><div><h3>Release history</h3><p>Review and manage your app distributions</p></div><button className="button button-quiet" onClick={() => notify("Release filters are part of the next UI pass.")}>All channels <ChevronDown size={14}/></button></div><div className="table-wrap"><table><thead><tr><th>VERSION</th><th>CHANNEL</th><th>RELEASE DATE</th><th>ROLLOUT</th><th>STATUS</th><th/></tr></thead><tbody>{releases.map(r=><tr key={r.version}><td><strong className="version-name">{r.version}</strong><small>Android release</small></td><td><span className={"channel-pill "+r.channel.toLowerCase()}>{r.channel}</span></td><td>{r.date}</td><td><div className="rollout-cell"><div className="progress-track"><i style={{width:r.rollout+"%"}}/></div><span>{r.rollout}%</span></div></td><td><span className={"release-status "+r.status.toLowerCase()}><i/>{r.status}</span></td><td><button className="row-more" onClick={() => notify("Release actions will connect to the OTA API later.")}><MoreHorizontal size={18}/></button></td></tr>)}</tbody></table></div><div className="table-footer"><span>Showing 3 sample releases</span><button className="text-link" onClick={() => notify("Full release history will be API-backed.")}>View all releases <ChevronRight size={14}/></button></div></section>
    <div className="ota-bottom"><div className="notice-box"><ShieldCheck size={18}/><div><strong>Secure release pipeline</strong><span>Production publishing will validate SHA-256 checksums, verify signed manifests and enforce role permissions.</span></div></div><div className="notice-box"><AlertTriangle size={18}/><div><strong>Rollback protection</strong><span>Keep the previous stable release available so you can quickly stop a bad rollout.</span></div></div></div>
  </>;
}

function ModulePage({ active, notify, setActive }) {
  const data = {
    "Users": ["12,480 total accounts","2,846 active today","124 new this week"],
    "Devices": ["3,912 registered devices","2,108 active sessions","86 Android TV devices"],
    "Content": ["Featured collections","Home screen sections","Category visibility"],
    "Announcements": ["Draft announcements","Scheduled notifications","Published messages"],
    "Release Channels": ["Stable production channel","Beta testing channel","Internal testing channel"],
    "App Configuration": ["Remote configuration","Feature flags","Maintenance mode"],
    "System Health": ["Supabase connectivity","Cloudflare Workers","Storage and API health"],
    "Backups": ["Latest database snapshot","Scheduled backup policy","Restore verification"],
    "Logs & Audit": ["Admin activity","API event stream","Security events"],
    "Admin Access": ["Owner role","Administrator role","Read-only auditor"],
    "Settings": ["Dashboard preferences","Security settings","Environment configuration"]
  }[active] || ["Overview","Configuration","Activity"];
  const icons = [Users, Gauge, ShieldCheck];
  return <div className="module-layout"><div className="module-banner"><div className="module-banner-icon"><Settings size={25}/></div><div><h2>{active} workspace</h2><p>This module's dashboard shell is ready. Connect the secure service API to enable live management.</p></div><span className="preview-pill">UI PREVIEW</span></div><div className="module-cards">{data.map((item,i)=>{const Icon=icons[i%icons.length];return <div className="panel module-card" key={item}><div className="stat-icon violet"><Icon size={18}/></div><strong>{item}</strong><span>Configuration and management view</span><button className="text-link" onClick={() => notify("This control will be enabled after backend integration.")}>Open module <ChevronRight size={14}/></button></div>})}</div><section className="panel integration-panel"><div className="integration-icon"><LockKeyhole size={21}/></div><div><h3>Backend connection pending</h3><p>All controls are intentionally in preview mode. We will wire each action to authenticated APIs with audit logging before enabling production changes.</p><button className="button button-quiet" onClick={() => setActive("Overview")}>Back to overview</button></div></section></div>;
}

export default App;
