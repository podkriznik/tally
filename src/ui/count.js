// Count drills: deck countdown and running→true count conversion.
import { SUITS, RANKS, val, hl } from '../engine.js';
import { app, store, STP, logDay } from '../state.js';
import { fmt, sign, rnd, pick, cardFace, stepper, stat, resultCard } from './common.js';

const CD = Object.assign({ speed: 1, per: 1, len: 52 }, store.get('tally_cd', {}),
  { phase: 'setup', i: 0, deck: [], shown: [], timer: null, flip: 0, ans: 0, t0: 0, t1: 0, res: null });
const CDbest = store.get('tally_cdbest', {});
const TD = { q: null, res: null };

function start() {
  clearTimeout(CD.timer);
  const decks = CD.len > 52 ? 2 : 1, deck = [];
  for (let d = 0; d < decks; d++) for (const s of SUITS) for (const r of RANKS) deck.push({ r, s, v: val(r) });
  for (let i = deck.length - 1; i > 0; i--) { const j = rnd(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  CD.deck = deck.slice(0, CD.len);
  CD.ans = CD.deck.reduce((a, c) => a + hl(c.v), 0);
  CD.i = 0; CD.phase = 'run'; CD.t0 = performance.now(); CD.res = null;
  next();
}

function next() {
  clearTimeout(CD.timer);
  if (CD.i >= CD.deck.length) { CD.t1 = performance.now(); CD.phase = 'ask'; STP.cd = 0; app.render(); return; }
  CD.shown = CD.deck.slice(CD.i, CD.i + CD.per);
  CD.i += CD.per;
  CD.flip ^= 1;
  app.render();
  if (CD.speed > 0) CD.timer = setTimeout(next, CD.speed * 1000);
}

function submit() {
  const secs = (CD.t1 - CD.t0) / 1000, ok = STP.cd === CD.ans, k = `${CD.len}|${CD.per}|${CD.speed}`;
  let rec = false;
  if (ok && (!CDbest[k] || secs < CDbest[k])) { CDbest[k] = secs; store.set('tally_cdbest', CDbest); rec = true; }
  if (ok && secs > 0.05) logDay({ cps: CD.deck.length / secs });
  CD.res = { ok, secs, u: STP.cd, rec };
  CD.phase = 'done';
  app.render();
}

function tdNew() {
  const dl = pick([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6]);
  let rc = rnd(23) - 6;
  if (rc === 0) rc = pick([7, -3, 11]);
  TD.q = { rc, dl }; TD.res = null; STP.td = 0;
}
function tdSubmit() {
  const ex = TD.q.rc / TD.q.dl, u = STP.td;
  const ok = u === Math.trunc(ex) || u === Math.round(ex) || u === Math.floor(ex);
  TD.res = { ok, ex, u };
  app.render();
}

/** Called when leaving the tab: stop the flash timer. */
export function leave() { clearTimeout(CD.timer); if (CD.phase === 'run') CD.phase = 'setup'; }

export function setOption(key, value) {
  CD[key] = value;
  store.set('tally_cd', { speed: CD.speed, per: CD.per, len: CD.len });
}

export function onKey(e) {
  if (app.tab === 'count' && CD.phase === 'run' && CD.speed === 0 && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    next();
  }
}

export const actions = {
  cdopt: (k, v) => { setOption(k, +v); app.render(); },
  cdstart: start,
  cdnext: next,
  cdstop: () => { clearTimeout(CD.timer); CD.phase = 'setup'; app.render(); },
  cdsub: submit,
  tdsub: tdSubmit,
  tdnext: () => { tdNew(); app.render(); },
};

/** Segmented picker for a count-drill option: data-a="cdopt:<key>:<value>". */
const seg = (k, list) => `<div class="seg">${list.map(([v, t]) => `<button data-a="cdopt:${k}:${v}" class="${CD[k] == v ? 'on' : ''}">${t}</button>`).join('')}</div>`;

export function render() {
  let h = '';
  if (CD.phase === 'setup' || CD.phase === 'done') {
    const bk = CDbest[`${CD.len}|${CD.per}|${CD.speed}`];
    if (CD.phase === 'done') {
      const r = CD.res;
      r.title ??= r.ok ? `Correct: ${sign(CD.ans)}` : `You said ${sign(r.u)}, the count was ${sign(CD.ans)}`;
      r.html ??= `${CD.deck.length} cards in ${r.secs.toFixed(1)} s${r.secs > 0.05 ? ` · ${(CD.deck.length / r.secs).toFixed(1)} cards/s` : ''} · ` +
        (r.rec ? '<b>New best time!</b>' : bk ? `best ${bk.toFixed(1)} s` : 'no best time yet (only correct runs count)');
      h += resultCard(r);
    }
    h += `<div class="panel"><h2>Count down the deck</h2><p class="muted">Cards flash one group at a time. Keep the Hi-Lo running count (2–6 = +1, 7–9 = 0, 10–A = −1) and enter it at the end. A full deck always ends at 0, so use a shorter run to test yourself.</p>
    <div class="opt"><span>Speed</span>${seg('speed', [[0, 'Tap'], [2, '2s'], [1.5, '1.5s'], [1, '1s'], [0.7, '.7s'], [0.5, '.5s'], [0.35, '.35s']])}</div>
    <div class="opt"><span>Cards per flash</span>${seg('per', [[1, '1'], [2, '2'], [3, '3']])}</div>
    <div class="opt"><span>Length</span>${seg('len', [[10, '10'], [26, '26'], [39, '39'], [52, 'Deck'], [104, '2 decks']])}</div>
    <div class="stats">${stat('cards', CD.len)}${stat('best time', bk ? bk.toFixed(1) + ' s' : '–')}${stat('pace', CD.speed ? (CD.per / CD.speed).toFixed(1) + '/s' : 'yours')}</div>
    <div class="btns"><button class="b primary" data-a="cdstart">Start</button></div></div>`;
  } else if (CD.phase === 'run') {
    const done = Math.min(CD.i, CD.deck.length), pct = (done / CD.deck.length) * 100;
    h += `<div class="felt big">
      <div class="runbar"><span>${done} / ${CD.deck.length}</span><div class="bar"><i style="width:${pct}%"></i></div></div>
      <div class="cards ${CD.flip ? 'fa' : 'fb2'}">${CD.shown.map(c => cardFace(c)).join('')}</div></div>
    <div class="btns">${CD.speed === 0 ? `<button class="b primary" data-a="cdnext">Next (space)</button>` : ''}<button class="b ghost" data-a="cdstop">Stop</button></div>`;
  } else if (CD.phase === 'ask') {
    h += `<div class="panel"><h3>Your count</h3><p>Done in ${((CD.t1 - CD.t0) / 1000).toFixed(1)} s. What's the running count?</p>${stepper('cd')}<div class="btns"><button class="b primary" data-a="cdsub">Check</button></div></div>`;
  }

  if (!TD.q) tdNew();
  h += `<div class="panel"><h2>True count conversion</h2>
    <div class="tdq"><div><b>${sign(TD.q.rc)}</b><span>running count</span></div><i>÷</i><div><b>${TD.q.dl}</b><span>deck${TD.q.dl === 1 ? '' : 's'} left</span></div><i>=</i><div><b>?</b><span>true count</span></div></div>`;
  if (!TD.res) h += `${stepper('td')}<div class="btns"><button class="b primary" data-a="tdsub">Check</button></div>`;
  else {
    const r = TD.res;
    r.title ??= r.ok ? `Correct: ${sign(r.u)}` : `You said ${sign(r.u)}`;
    r.html ??= `Exact: ${sign(TD.q.rc)} ÷ ${TD.q.dl} = <b>${fmt(r.ex)}</b>. Rounding or flooring to a whole number both count.`;
    h += resultCard(r) + `<div class="btns"><button class="b primary" data-a="tdnext">Next</button></div>`;
  }
  return h + `</div>`;
}
