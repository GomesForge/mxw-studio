/* settings.js -- the gear: language, theme, and a couple of things
   about how the editor behaves while you work.

   Everything is kept in this browser and nowhere else, which is the
   same promise the rest of the editor makes about the files you open.
   Nothing here is sent anywhere, and "Forget these settings" really
   does remove the one key it writes.

   The theme is three-state rather than a switch, because following the
   system is what most people want and a two-way toggle cannot express
   it: once you flip a switch you have opted out of the system for
   good, with no way back. */

const SETTINGS_KEY = 'mxw.settings';

const settings = {
  lang: 'en',
  theme: 'system',          /* system | light | dark */
  warnOnLeave: true,
  noticeMs: 7000
};

function settingsLoad() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); }
  catch (e) { saved = null; }
  if (saved && typeof saved === 'object') {
    for (const k in settings)
      if (saved[k] !== undefined) settings[k] = saved[k];
  } else if (!saved) {
    /* no choice made yet: start in the language the browser asks for */
    const want = (navigator.language || 'en').toLowerCase();
    if (want.indexOf('pt') === 0) settings.lang = 'pt-BR';
  }
  settingsApply();
}

function settingsSave() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
  catch (e) { /* private window, or storage turned off: it still works */ }
}

function settingsApply() {
  if (settings.theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = settings.theme;
  window.mxwNoticeMs = settings.noticeMs;
  if (typeof i18nSetLang === 'function') i18nSetLang(settings.lang);
}

function settingsReset() {
  try { localStorage.removeItem(SETTINGS_KEY); } catch (e) { /* fine */ }
  settings.lang = 'en';
  settings.theme = 'system';
  settings.warnOnLeave = true;
  settings.noticeMs = 7000;
  settingsApply();
  settingsRender();
  notify('settings forgotten');
}

/* ------------------------------ the panel ------------------------ */

function setRow(parent, label, help) {
  const row = document.createElement('div');
  row.className = 'setRow';
  const l = document.createElement('div');
  l.className = 'setLabel';
  l.appendChild(Object.assign(document.createElement('b'), { textContent: label }));
  if (help) {
    const h = document.createElement('span');
    h.textContent = help;
    l.appendChild(h);
  }
  row.appendChild(l);
  const c = document.createElement('div');
  c.className = 'setControl';
  row.appendChild(c);
  parent.appendChild(row);
  return c;
}

/* A row of buttons behaves better than a dropdown for two or three
   choices: every option is visible, and the one in use is obvious. */
function setChoice(parent, options, value, onPick) {
  const wrap = document.createElement('div');
  wrap.className = 'setChoice';
  const btns = options.map(([v, label]) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = v === value ? 'on' : '';
    b.onclick = () => {
      btns.forEach((x, i) => x.classList.toggle('on', options[i][0] === v));
      onPick(v);
    };
    wrap.appendChild(b);
    return b;
  });
  parent.appendChild(wrap);
  return wrap;
}

function settingsRender() {
  const body = document.getElementById('setBody');
  if (!body) return;
  body.innerHTML = '';

  let c = setRow(body, 'Language', 'The interface. File formats are not affected.');
  setChoice(c, I18N_LANGS, settings.lang, v => {
    settings.lang = v;
    settingsSave();
    settingsApply();
    if (typeof creatorRender === 'function' && !document.getElementById('cr').hidden)
      creatorRender();
  });

  c = setRow(body, 'Theme', 'Following the system changes with it.');
  setChoice(c, [['system', 'Follow the system'], ['light', 'Light'],
                ['dark', 'Dark']], settings.theme, v => {
    settings.theme = v;
    settingsSave();
    settingsApply();
  });

  body.appendChild(Object.assign(document.createElement('h4'),
    { textContent: 'While you work' }));

  c = setRow(body, 'Warn before leaving with a file open',
             'The browser asks before closing the tab.');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = settings.warnOnLeave;
  cb.onchange = () => { settings.warnOnLeave = cb.checked; settingsSave(); };
  c.appendChild(cb);

  c = setRow(body, 'How long a notice stays',
             'The messages that appear at the bottom.');
  setChoice(c, [[3000, 'short'], [7000, 'normal'], [15000, 'long']],
            settings.noticeMs, v => {
    settings.noticeMs = v;
    settingsSave();
    settingsApply();
  });

  const foot = document.createElement('p');
  foot.className = 'setFoot';
  foot.textContent = 'Everything here is kept in this browser only.';
  body.appendChild(foot);

  const acts = document.createElement('div');
  acts.className = 'setActs';
  const reset = document.createElement('button');
  reset.textContent = 'Forget these settings';
  reset.onclick = settingsReset;
  acts.appendChild(reset);
  body.appendChild(acts);

  if (typeof i18nApply === 'function') i18nApply(body);
}

function settingsOpen() {
  const p = document.getElementById('set');
  if (!p) return;
  p.hidden = false;
  settingsRender();
}

function settingsClose() {
  const p = document.getElementById('set');
  if (p) p.hidden = true;
}

function settingsWire() {
  settingsLoad();
  const b = document.getElementById('bSet');
  if (b) b.onclick = () => settingsOpen();
  const x = document.getElementById('setX');
  if (x) x.onclick = settingsClose;
  const panel = document.getElementById('set');
  if (panel) panel.addEventListener('click', e => {
    if (e.target === panel) settingsClose();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel && !panel.hidden) settingsClose();
  });
  window.addEventListener('beforeunload', e => {
    if (!settings.warnOnLeave) return;
    const open = (typeof loaded !== 'undefined' && loaded.length) ||
                 (typeof sprite !== 'undefined' && sprite && sprite.entry);
    if (!open) return;
    e.preventDefault();
    e.returnValue = '';
  });
  if (typeof i18nWatch === 'function') i18nWatch();
}
