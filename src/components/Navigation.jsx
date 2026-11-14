import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CornerDownLeft, Gauge, LayoutDashboard, Menu, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';

export function CommandPalette({ groups, onClose, onNavigate }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef(null);
  const items = useMemo(() => groups.flatMap(group => group.items.map(([name, icon]) => ({ name, icon, group: group.label }))), [groups]);
  const matches = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search ? items.filter(item => `${item.name} ${item.group}`.toLowerCase().includes(search)) : items;
  }, [items, query]);
  useEffect(() => {
    const trigger = document.activeElement;
    input.current?.focus();
    const onKey = event => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (trigger?.isConnected) trigger.focus(); };
  }, [onClose]);
  useEffect(() => { document.getElementById(`command-option-${index}`)?.scrollIntoView({ block: 'nearest' }); }, [index, query]);
  const choose = item => { if (item) { onNavigate(item.name); onClose(); } };
  const keyDown = event => {
    if (event.key === 'ArrowDown' && matches.length) { event.preventDefault(); setIndex(current => (current + 1) % matches.length); }
    if (event.key === 'ArrowUp' && matches.length) { event.preventDefault(); setIndex(current => (current - 1 + matches.length) % matches.length); }
    if (event.key === 'Enter') { event.preventDefault(); choose(matches[Math.min(index, matches.length - 1)]); }
  };
  return <div className="command-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="command-dialog" role="dialog" aria-modal="true" aria-label="Find a dashboard page">
      <div className="command-search-row"><Search size={20}/><input ref={input} value={query} aria-label="Search dashboard pages" aria-controls="command-results" aria-activedescendant={matches.length ? `command-option-${Math.min(index, matches.length - 1)}` : undefined} aria-expanded="true" role="combobox" placeholder="Where would you like to go?" onChange={event => { setQuery(event.target.value); setIndex(0); }} onKeyDown={keyDown}/><button type="button" aria-label="Close search" onClick={onClose}><X size={17}/></button></div>
      <div className="command-results-heading">{query ? 'SEARCH RESULTS' : 'EXPLORE YOUR WORKSPACE'} <span>{matches.length} pages</span></div>
      <div className="command-results" id="command-results" role="listbox" aria-label="Dashboard pages">{matches.map((item, itemIndex) => { const Icon = item.icon; return <button type="button" id={`command-option-${itemIndex}`} role="option" aria-selected={index === itemIndex} className={`command-result ${index === itemIndex ? 'selected' : ''}`} key={item.name} onMouseEnter={() => setIndex(itemIndex)} onClick={() => choose(item)}><span className="command-result-icon"><Icon size={17}/></span><span><strong>{item.name}</strong><small>{item.group.toLowerCase()}</small></span><CornerDownLeft size={14}/></button>; })}{!matches.length && <div className="command-empty">No pages found. Try another search.</div>}</div>
      <div className="command-hints"><span><ArrowUp size={11}/><ArrowDown size={11}/> navigate</span><span><CornerDownLeft size={11}/> open</span><span>esc close</span></div>
    </div>
  </div>;
}

export function MobileNavigation({ active, go, openMenu }) {
  const items = [
    { name: 'Overview', label: 'Home', icon: LayoutDashboard },
    { name: 'Analytics', label: 'Analytics', icon: Gauge },
    { name: 'App control', label: 'Controls', icon: SlidersHorizontal },
    { name: 'Home & themes', label: 'Themes', icon: Sparkles },
  ];
  return <nav className="mobile-dock" aria-label="Quick navigation">{items.map(({name,label,icon:Icon}) => <button key={name} type="button" aria-current={active === name ? 'page' : undefined} className={active === name ? 'active' : ''} onClick={() => go(name)}><Icon size={19}/><span>{label}</span></button>)}<button type="button" onClick={openMenu}><Menu size={19}/><span>More</span></button></nav>;
}
