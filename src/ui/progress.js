// Progress page (not a tab; app.tab === 'progress', opened from the chart button in the header).
// Reads the daily log (DAYS in state.js): headline numbers, then one single-series column chart per
// measure over the last 14 days. Each chart: hairline grid, a label on the latest value only, a
// tooltip per day on hover / focus (data-tip, shown by main.js), and a table view.
import { DAYS, dayKey, store } from '../state.js';
import { stat, tone } from './common.js';

const SPAN = 14;
const fmtDay = k => new Date(k + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const lastDays = () => Array.from({ length: SPAN }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (SPAN - 1 - i)); return dayKey(d); });

/** Column chart. rows: [{ k: date, v: value or null, tip: second tooltip line }]; max: top of the axis;
 *  ticks: values for the hairline grid; fmt: value -> text. */
function columns(title, rows, max, ticks, fmt) {
  const last = rows.map(r => r.v != null).lastIndexOf(true);
  const grid = ticks.map(t => `<div class="gl" style="bottom:${(t / max) * 100}%"><span>${fmt(t)}</span></div>`).join('');
  const cols = rows.map((r, i) => {
    const label = `${fmtDay(r.k)}: ${r.v == null ? 'no practice' : fmt(r.v)}`;
    if (r.v == null) return `<div class="col empty" aria-label="${label}"></div>`;
    return `<button class="col" data-tip="${fmtDay(r.k)}&#10;${fmt(r.v)} · ${r.tip}" aria-label="${label}, ${r.tip}">` +
      `<i style="height:${Math.max(2, (r.v / max) * 100)}%">${i === last ? `<b>${fmt(r.v)}</b>` : ''}</i></button>`;
  }).join('');
  const days = rows.map((r, i) => `<span>${i === rows.length - 1 ? 'Today' : i % 2 ? '' : new Date(r.k + 'T12:00').getDate()}</span>`).join('');
  const table = rows.filter(r => r.v != null).map(r => `<tr><td>${fmtDay(r.k)}</td><td>${fmt(r.v)}</td><td>${r.tip}</td></tr>`).join('');
  return `<div class="panel"><h3>${title}</h3>
    <div class="cchart"><div class="plot">${grid}<div class="cols">${cols}</div></div><div class="xl">${days}</div></div>
    <details class="tv"><summary>Show as table</summary><table class="list">${table}</table></details></div>`;
}

export function render() {
  const all = Object.entries(DAYS), keys = lastDays();
  const sum = f => all.reduce((a, [, d]) => a + (d[f] || 0), 0);
  const dec = sum('dec'), ok = sum('ok'), cq = sum('cq'), cok = sum('cok');
  const bestCps = Math.max(0, ...all.map(([, d]) => d.cps || 0));
  let h = `<div class="btns"><button class="b ghost" data-a="back">← Back</button></div>
    <div class="panel"><h2>Progress</h2><p class="muted">Your practice day by day: decisions from the drill and the table, count checks, and count drill speed.</p></div>
    <div class="stats">${stat('days practiced', all.filter(([, d]) => d.dec || d.cq || d.cps).length)}${stat('decisions', dec.toLocaleString())}` +
    `${stat('accuracy', dec ? Math.round((ok / dec) * 100) + '%' : '–', tone.pct(ok, dec))}${stat('best streak', store.get('tally_streak', 0))}` +
    `${stat('best speed', bestCps ? bestCps.toFixed(1) + '/s' : '–')}</div>`;
  if (!all.length) return h + `<div class="panel"><p class="muted">Play a few hands or drill a little: your progress shows up here, day by day.</p></div>`;

  const acc = keys.map(k => { const d = DAYS[k]; return { k, v: d?.dec ? (d.ok / d.dec) * 100 : null, tip: d?.dec ? `${d.dec} decisions` : '' }; });
  h += columns('Decision accuracy, last 14 days', acc, 100, [0, 50, 75, 100], v => Math.round(v) + '%');
  if (cq) {
    const cc = keys.map(k => { const d = DAYS[k]; return { k, v: d?.cq ? (d.cok / d.cq) * 100 : null, tip: d?.cq ? `${d.cok} of ${d.cq} count checks` : '' }; });
    h += columns('Count checks right, last 14 days', cc, 100, [0, 50, 100], v => Math.round(v) + '%');
  }
  const sp = keys.map(k => ({ k, v: DAYS[k]?.cps || null, tip: 'best correct run' }));
  if (sp.some(r => r.v)) {
    const top = Math.max(2, Math.ceil(Math.max(...sp.map(r => r.v || 0)) / 2) * 2);
    h += columns('Count drill speed (cards per second), last 14 days', sp, top, [0, top / 2, top], v => v.toFixed(1));
  }
  return h + `<p class="muted small center">Overall: ${dec ? `${ok} of ${dec} decisions right` : 'no decisions yet'}${cq ? `, ${cok} of ${cq} count checks` : ''}.</p>`;
}
