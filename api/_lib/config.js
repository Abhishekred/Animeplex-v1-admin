import { APP_UI_OPTIONS, DEFAULT_APP_UI, THEMES } from '../../shared/themes.js';

const TEXT_LIMITS = {
  minimum_supported_version: 50,
  latest_version: 50,
  home_message: 1000,
  default_source: 120,
};
const URL_KEYS = new Set(['support_url', 'discord_url', 'logo_url', 'splash_url']);
const BOOLEAN_KEYS = new Set(['maintenance_mode', 'community_popup_enabled']);
const THEME_IDS = new Set(THEMES.map(theme => theme.id));

function safeUrl(value, label) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error(`${label} must be a valid HTTPS URL.`);
  if (value === '') return '';
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} must be a valid HTTPS URL.`); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${label} must be a valid HTTPS URL.`);
  return url.toString();
}

/** Validate the allow-listed app settings without trusting the admin browser. */
export function validateSetting(key, value) {
  if (BOOLEAN_KEYS.has(key)) {
    if (typeof value !== 'boolean') throw new Error(`${key} must be true or false.`);
    return value;
  }
  if (Object.hasOwn(TEXT_LIMITS, key)) {
    if (typeof value !== 'string' || value.length > TEXT_LIMITS[key]) throw new Error(`${key} is too long or is not text.`);
    return value;
  }
  if (URL_KEYS.has(key)) return safeUrl(value, key);
  if (key === 'theme_preset') {
    if (!THEME_IDS.has(value)) throw new Error('Choose a supported theme.');
    return value;
  }
  if (key === 'app_ui') {
    if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).some(name => !Object.hasOwn(DEFAULT_APP_UI, name))) throw new Error('Invalid app appearance settings.');
    const ui = { ...DEFAULT_APP_UI, ...value };
    if (typeof ui.display_name !== 'string' || !ui.display_name.trim() || ui.display_name.length > 50) throw new Error('App name must be between 1 and 50 characters.');
    if (typeof ui.tagline !== 'string' || ui.tagline.length > 120) throw new Error('Tagline must be at most 120 characters.');
    for (const [name, options] of Object.entries(APP_UI_OPTIONS)) if (!options.includes(ui[name])) throw new Error(`Unsupported ${name.replaceAll('_', ' ')}.`);
    ui.display_name = ui.display_name.trim();
    ui.tagline = ui.tagline.trim();
    ui.background_url = safeUrl(ui.background_url, 'Background image');
    return ui;
  }
  if (key === 'accent_color') {
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Accent color must be a six-digit hex color.');
    return value.toLowerCase();
  }
  if (key === 'feature_flags') {
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Feature flags must be an object.');
    const entries = Object.entries(value);
    if (entries.length > 50 || entries.some(([name, enabled]) => !/^[a-z][a-z0-9_]{0,49}$/.test(name) || typeof enabled !== 'boolean')) {
      throw new Error('Feature flags need valid lowercase names and true/false values.');
    }
    return Object.fromEntries(entries);
  }
  if (key === 'source_repositories') {
    if (!Array.isArray(value) || value.length > 30) throw new Error('Add at most 30 source repositories.');
    const ids = new Set();
    const urls = new Set();
    return value.map((repo) => {
      if (!repo || typeof repo !== 'object' || Array.isArray(repo)) throw new Error('Invalid repository.');
      const id = String(repo.id || '');
      const name = String(repo.name || '').trim();
      const url = safeUrl(repo.url, 'Repository URL');
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || !name || name.length > 80 || !url || typeof repo.enabled !== 'boolean') throw new Error('Each repository needs an id, name, HTTPS URL and enabled status.');
      if (ids.has(id) || urls.has(url)) throw new Error('Repository ids and URLs must be unique.');
      ids.add(id); urls.add(url);
      return { id, name, url, enabled: repo.enabled };
    });
  }
  throw new Error('Unknown configuration key.');
}
