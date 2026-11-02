// Settings page (gear button in the header): appearance, help, rules + training options, house edge, your data.
import { app, store } from '../state.js';
import { $, toast } from './common.js';
import * as rules from './rules.js';
import * as edge from './edge.js';

// Export / import: everything Tally keeps in localStorage, as one JSON file.
const KEYS = ['tally_settings', 'tally_stats', 'tally_table', 'tally_cd', 'tally_cdbest', 'tally_streak', 'tally_days', 'tally_tip', 'tally_theme', 'tally_tab'];
function exportData() {
  const data = {};
  for (const k of KEYS) { const v = store.get(k, undefined); if (v !== undefined) data[k] = v; }
  const day = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify({ app: 'tally', version: 1, exported: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tally-stats-${day}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast({ ok: true, title: 'Exported', html: `Saved <b>${a.download}</b>. Import it on another device from Settings.` });
}
/** Called by main.js when a file is picked in the import input. Replaces the stored data, then reloads. */
export async function importFile(file) {
  try {
    const j = JSON.parse(await file.text());
    if (j.app !== 'tally' || !j.data || typeof j.data !== 'object') throw new Error('not a Tally export');
    for (const [k, v] of Object.entries(j.data)) if (KEYS.includes(k)) store.set(k, v);
    sessionStorage.setItem('tally_imported', j.exported || '1'); // main.js confirms after the reload
    location.reload();
  } catch (e) {
    toast({ ok: false, title: 'Couldn\'t import that file', html: 'Pick a file made with Export in Tally\'s settings.' });
  }
}

// Theme: 'auto' follows the OS, 'light'/'dark' force it via <html data-theme>.
const THEMES = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];
let theme = store.get('tally_theme', 'auto');
const darkMq = matchMedia('(prefers-color-scheme: dark)');

export function applyTheme() {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'auto' && darkMq.matches);
  // = --bg; purple while the intro splash covers the page (html.intro, see index.html)
  const intro = document.documentElement.classList.contains('intro');
  document.querySelector('meta[name=theme-color]').content = intro ? '#3f2469' : dark ? '#100e14' : '#f5f4f8';
}
darkMq.addEventListener('change', applyTheme);

export const actions = {
  theme: t => {
    theme = t;
    store.set('tally_theme', theme);
    applyTheme();
    app.render();
  },
  exportdata: exportData,
  importdata: () => $('importfile').click(), // the second tap (data-confirm) is the user gesture the picker needs
};

export function render() {
  return `<div class="panel"><h2>Appearance</h2><div class="seg">` +
    THEMES.map(([k, t]) => `<button data-a="theme:${k}" class="${theme === k ? 'on' : ''}">${t}</button>`).join('') +
    `</div></div>` +
    `<div class="panel"><h2>Help</h2><p class="muted">New to blackjack or card counting? The rules, the terms and how Tally works, on one page.</p><div class="btns"><button class="b ghost" data-a="guide">How to play</button></div></div>` +
    rules.render() + edge.render() +
    `<div class="panel"><h2>Your data</h2><p class="muted">Stats and settings are stored only in this browser. Export them to keep a backup or to move them to another device; importing replaces what's here.</p>
      <div class="btns"><button class="b ghost" data-a="exportdata">Export</button><button class="b ghost" data-a="importdata" data-confirm="Tap again to pick a file">Import</button></div>
      <input type="file" id="importfile" accept="application/json,.json" data-import hidden>
      <div class="btns mid"><button class="b ghost danger" data-a="resetall" data-confirm="Tap again to confirm">Reset table record</button></div>
      <p class="muted small center">Zeroes the Table tab's hands, correct %, units, count checks and bet accuracy. Weak spots, best times and settings stay.</p></div>`;
}
