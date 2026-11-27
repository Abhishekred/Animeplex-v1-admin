const storageKey = 'animeplex-admin-theme';
const themes = [
  { id: 'aurora', name: 'Aurora', detail: 'Northern lights · soft crystal' },
  { id: 'porcelain', name: 'Porcelain', detail: 'Daylight · frosted ivory' },
  { id: 'terminal', name: 'Terminal', detail: 'Phosphor grid · sharp edges' },
  { id: 'marquee', name: 'Marquee', detail: 'Art deco · amber and velvet' },
];

export function installThemePicker(icon) {
  const root = document.documentElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'theme-dialog';
  dialog.id = 'theme-picker';
  dialog.setAttribute('aria-labelledby', 'theme-title');
  dialog.innerHTML = `<div class="theme-header"><h2 id="theme-title">Appearance</h2>
    <form method="dialog"><button class="btn" autofocus>Done</button></form></div>
    <fieldset class="theme-options"><legend>Workspace theme</legend>
      ${themes.map(({ id, name, detail }) => `<label class="theme-option" data-sample="${id}">
        <input type="radio" name="workspace-theme" value="${id}">
        <span class="theme-sample" aria-hidden="true"><i></i><b>Aa</b></span>
        <strong>${name}</strong><small>${detail}</small></label>`).join('')}
    </fieldset>`;
  document.body.append(dialog);

  function apply(value) {
    const id = themes.some(theme => theme.id === value) ? value : themes[0].id;
    root.dataset.theme = id;
    dialog.querySelector(`input[value="${id}"]`).checked = true;
    document.querySelector('meta[name="theme-color"]').content =
      getComputedStyle(root).getPropertyValue('--base').trim();
  }

  let saved;
  try { saved = localStorage.getItem(storageKey); } catch { /* Storage may be disabled. */ }
  apply(saved);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-open-theme]') && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('input:checked').focus();
    }
  });
  dialog.addEventListener('change', event => {
    const value = event.target.value;
    apply(value);
    try { localStorage.setItem(storageKey, value); } catch { /* Keep the session choice. */ }
  });
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) apply(event.newValue);
  });
  return `<button type="button" class="btn theme-trigger" data-open-theme
    aria-haspopup="dialog" aria-controls="theme-picker">${icon('palette', 16)} Theme</button>`;
}
