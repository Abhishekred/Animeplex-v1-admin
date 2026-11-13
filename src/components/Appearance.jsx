import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, CirclePlay, Image, LayoutGrid, Palette, PanelBottom, Sparkles, WandSparkles } from 'lucide-react';
import { DEFAULT_APP_UI, THEMES } from '../../shared/themes.js';

export function ThemeGallery({ selected, onSelect, disabled = false, compact = false }) {
  return <div className={`theme-gallery ${compact ? 'compact-gallery' : ''}`}>
    {THEMES.map(theme => <button type="button" key={theme.id} className={`palette-card ${selected === theme.id ? 'selected' : ''}`} aria-pressed={selected === theme.id} disabled={disabled} onClick={() => onSelect(theme.id)}>
      <span className="palette-art" style={{ '--palette-base': theme.color, '--palette-accent': theme.accent, '--palette-secondary': theme.secondary }}>
        <span className="palette-orbit orbit-a"/><span className="palette-orbit orbit-b"/>
        <span className="palette-ui"><i/><i/><i/></span><span className="palette-spark">✦</span>
        {selected === theme.id && <span className="palette-check"><Check size={13}/></span>}
      </span>
      <span className="palette-meta"><span><strong>{theme.label}</strong><small>{theme.description}</small></span><span className="palette-color" style={{ background: theme.accent }}/></span>
    </button>)}
  </div>;
}

function SelectField({ label, value, options, disabled, onChange }) {
  return <label className="studio-label appearance-field">{label}<select className="text-input" value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></label>;
}

function MobileCanvas({ ui, theme }) {
  const accent = theme.accent;
  return <div className="canvas-phone" style={{ '--phone-accent': accent, '--phone-base': theme.color, '--phone-secondary': theme.secondary }} aria-label="Illustrative app appearance preview">
    <div className="phone-status"><span>9:41</span><span>◦ ◦ ▰</span></div>
    <div className="phone-top"><img src="/animeplex-logo.png" alt=""/><span>{ui.display_name || 'AnimePlex'}</span><span className="phone-search">⌕</span></div>
    <div className={`phone-hero ${ui.home_layout}`}><span className="phone-tag">FEATURED · ANIMEPLEX</span><span className="phone-hero-orbit">✦</span><strong>{ui.display_name || 'AnimePlex'}</strong><small>{ui.tagline || 'Your next story starts here.'}</small><span className="phone-play"><CirclePlay size={12}/> Explore now</span></div>
    <div className="phone-section"><div><strong>Made for you</strong><small>See all <ChevronRight size={8}/></small></div><div className={`phone-posters ${ui.poster_style}`}><i/><i/><i/></div></div>
    <div className={`phone-nav ${ui.navigation_style}`}><span>⌂<small>Home</small></span><span>◇<small>Library</small></span><span>⌕<small>Search</small></span><span>○<small>Profile</small></span></div>
  </div>;
}

export function AppearanceStudio({ items, api, refresh, notify, canEdit }) {
  const values = useMemo(() => Object.fromEntries(items.map(item => [item.key, item.value])), [items]);
  const storedUi = values.app_ui && typeof values.app_ui === 'object' && !Array.isArray(values.app_ui) ? values.app_ui : {};
  const uiSignature = JSON.stringify(storedUi);
  const [ui, setUi] = useState(() => ({ ...DEFAULT_APP_UI, ...storedUi }));
  const [saving, setSaving] = useState('');
  useEffect(() => setUi({ ...DEFAULT_APP_UI, ...JSON.parse(uiSignature) }), [uiSignature]);
  const selectedTheme = THEMES.find(theme => theme.id === values.theme_preset) || THEMES[0];
  const update = (key, value) => setUi(current => ({ ...current, [key]: value }));
  const saveTheme = async id => {
    setSaving('theme');
    try { await api('config', 'PUT', { key: 'theme_preset', value: id }); notify('App theme saved to the registry.'); await refresh(); }
    catch (error) { notify(error.message); } finally { setSaving(''); }
  };
  const saveUi = async event => {
    event.preventDefault(); setSaving('ui');
    try { await api('config', 'PUT', { key: 'app_ui', value: ui }); notify('App appearance saved to the registry.'); await refresh(); }
    catch (error) { notify(error.message); } finally { setSaving(''); }
  };
  return <div className="studio-stack appearance-studio">
    <div className="integration-strip"><Sparkles size={17}/><span>Design settings are saved here. The installed app will use them after the separate app integration.</span></div>
    <section className="appearance-banner"><div><div className="studio-kicker">APPEARANCE STUDIO <span>·</span> 08 THEMES</div><h2>Make it unmistakably <em>yours.</em></h2><p>Choose a mood, shape the experience, and preview your AnimePlex identity in one place.</p><div className="appearance-banner-tags"><span><Palette size={13}/> 8 curated palettes</span><span><WandSparkles size={13}/> Live visual preview</span></div></div><div className="appearance-emblem"><img src="/animeplex-logo.png" alt="AnimePlex"/></div></section>
    <section className="panel palette-panel"><div className="panel-heading"><div><div className="section-index">01 / COLOR SYSTEM</div><h3>Choose your app theme</h3><p>Eight distinct palettes for your mobile app. Selected: {selectedTheme.label}.</p></div><div className="section-icon"><Palette size={19}/></div></div><ThemeGallery selected={selectedTheme.id} onSelect={saveTheme} disabled={!canEdit || Boolean(saving)}/></section>
    <div className="appearance-layout"><form className="panel appearance-editor" onSubmit={saveUi}><div className="panel-heading"><div><div className="section-index">02 / EXPERIENCE</div><h3>Design your app</h3><p>Personalize the home screen and navigation.</p></div><div className="section-icon"><LayoutGrid size={19}/></div></div>
      <div className="editor-fields"><label className="studio-label appearance-field">App display name<input className="text-input" maxLength={50} required disabled={!canEdit} value={ui.display_name} onChange={event => update('display_name', event.target.value)}/></label><label className="studio-label appearance-field">Home screen tagline<input className="text-input" maxLength={120} disabled={!canEdit} value={ui.tagline} onChange={event => update('tagline', event.target.value)}/></label>
      <SelectField label="Home layout" value={ui.home_layout} disabled={!canEdit} onChange={value => update('home_layout', value)} options={[["cinematic","Cinematic"],["classic","Classic"],["compact","Compact"]]}/>
      <SelectField label="Opening screen" value={ui.opening_screen} disabled={!canEdit} onChange={value => update('opening_screen', value)} options={[["home","Home"],["sources","Sources"],["library","Library"],["profile","Profile"]]}/>
      <SelectField label="Navigation style" value={ui.navigation_style} disabled={!canEdit} onChange={value => update('navigation_style', value)} options={[["floating","Floating"],["classic","Classic"]]}/>
      <SelectField label="Animation level" value={ui.animation_level} disabled={!canEdit} onChange={value => update('animation_level', value)} options={[["full","Full motion"],["reduced","Reduced"],["off","Off"]]}/>
      <SelectField label="Poster style" value={ui.poster_style} disabled={!canEdit} onChange={value => update('poster_style', value)} options={[["portrait","Portrait"],["landscape","Landscape"]]}/>
      <label className="studio-label appearance-field background-field">Background image URL <span>(optional HTTPS)</span><input className="text-input" type="url" maxLength={2048} disabled={!canEdit} value={ui.background_url} onChange={event => update('background_url', event.target.value)} placeholder="https://…"/></label></div>
      <div className="editor-footer"><span><Image size={14}/> Changes are saved in app settings.</span><button className="button button-primary" disabled={!canEdit || Boolean(saving)}>{saving === 'ui' ? 'Saving…' : 'Save app appearance'} <ChevronRight size={15}/></button></div>
    </form><section className="panel device-preview-panel"><div className="panel-heading"><div><div className="section-index">03 / PREVIEW</div><h3>Your app, imagined</h3><p>Illustrative preview · not a connected device</p></div><div className="section-icon"><PanelBottom size={19}/></div></div><MobileCanvas ui={ui} theme={selectedTheme}/><div className="device-preview-footer"><span className="preview-live-dot"/> VISUAL PREVIEW <span>·</span> {selectedTheme.label.toUpperCase()}</div></section></div>
  </div>;
}
