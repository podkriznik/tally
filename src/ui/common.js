// Small view helpers shared by the tabs.
import { SUITS, ACT, info, basic, devMatches } from '../engine.js';
import { S, STP, store } from '../state.js';

export const $ = id => document.getElementById(id);
export const fmt = x => (x >= 0 ? '+' : '') + (Math.round(x * 10) / 10).toFixed(1);
export const sign = x => (x >= 0 ? '+' : '') + x;
export const upName = u => (u === 11 ? 'A' : String(u));
export const rnd = n => (Math.random() * n) | 0;
export const pick = a => a[rnd(a.length)];

/** Random card object for a value (10 picks a random face). */
export function mkCard(v) {
  const r = v === 11 ? 'A' : v === 10 ? pick(['10', 'J', 'Q', 'K']) : String(v);
  return { r, s: pick(SUITS), v };
}

export function describe(c) {
  const i = info(c);
  if (i.pair) return 'Pair of ' + (c[0] === 11 ? 'aces' : c[0] + 's');
  return (i.soft ? 'Soft ' : 'Hard ') + i.t;
}

export function idxText(e) {
  const n = (e.i >= 0 ? '+' : '') + e.i;
  return e.hi ? `${ACT[e.hi]} at TC ≥ ${n}` : `${ACT[e.lo]} at TC < ${n}`;
}

/** An action name as a small pill in its chip color (H green, S red, ...). */
export const actPill = a => `<b class="pill k${a[0]}">${ACT[a]}</b>`;

/** Feedback text for a decision: r is the result of best(). */
export function explain(r, c, up, tc, o) {
  let s = `${describe(c)} vs ${upName(up)}: ${actPill(r.a)}`;
  if (r.e) s += ` — index play, ${idxText(r.e)} (TC ${fmt(tc)}). Basic strategy says ${ACT[r.b]}.`;
  else if (S.dev) {
    const m = devMatches(c, up, S, o);
    if (m.length) s += `. Index: ${m.map(idxText).join('; ')} (TC ${fmt(tc)}).`;
  }
  return s;
}

const UPS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Round "?" button for the felt's dealer label row; toggles the hint panel. Until you've opened a hint
 *  once (tally_tip), a small "Not sure? Tap ?" bubble sits next to it. */
export const hintBtn = (act, open) =>
  (store.get('tally_tip', 0) ? '' : '<span class="tipbub" aria-hidden="true">Not sure? Tap <b>?</b></span>') +
  `<button class="qbtn${open ? ' on' : ''}" data-a="${act}" aria-label="${open ? 'Hide hint' : 'Hint'}" aria-pressed="${open}" title="Hint">?</button>`;
/** The hint has been used: stop showing the nudge. */
export const hintUsed = () => store.set('tally_tip', 1);

/** Hint: this hand's basic strategy row (with its real options) against every upcard, the current one
 *  highlighted, plus index rules for the current upcard. Never reveals the count-dependent answer. */
export function hintHTML(c, up, o, tc = null) {
  const cell = u => { const a = basic(c, u, S, o); return `<td class="c${a[0]}${u === up ? ' on' : ''}">${a}</td>`; };
  let h = `<div class="panel hintp"><h3>Hint · not scored</h3><div class="tw"><table class="ch hint">` +
    `<tr><th></th>${UPS.map(u => `<th${u === up ? ' class="on"' : ''}>${upName(u)}</th>`).join('')}</tr>` +
    `<tr><th>${describe(c)}</th>${UPS.map(cell).join('')}</tr></table></div>`;
  const m = S.dev ? devMatches(c, up, S, o) : [];
  if (m.length) h += `<p>Index vs ${upName(up)}: <b>${m.map(idxText).join('; ')}</b>. ${tc === null ? 'Apply it with your true count.' : `True count now <b>${fmt(tc)}</b>.`}</p>`;
  return h + `</div>`;
}

// The whole view re-renders on every change, so animations key off object identity:
// fresh(o) is true only the first time o is rendered.
const seen = new WeakSet();
export function fresh(o) {
  if (!o || seen.has(o)) return false;
  seen.add(o);
  return true;
}
/** ' pop' the first time feedback object o is rendered (append to a class list). */
export const pop = o => (fresh(o) ? ' pop' : '');

/** Decision feedback banner under the tab bar (#toast lives in the header, outside #view, so re-renders
 *  don't touch it). Mistakes stay until the next action or ✕ (main.js hides it on every click);
 *  correct answers fade out on their own (with a draining progress line).
 *  fb = { ok, title, html, hinted }: title is the bold first line, html the explanation under it. */
let toastT;
const TICK = '<path d="M5 12.5l4.5 4.5L19 7.5"/>', CROSS = '<path d="M7 7l10 10M17 7L7 17"/>';
const badge = ok => `<span class="ti"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${ok ? TICK : CROSS}</svg></span>`;
/** In-page result (count checks, count drill, true count drill), styled like the toast: badge, title, details.
 *  o = { ok, title, html }; pops in the first time o renders. */
export const resultCard = o =>
  `<div class="result ${o.ok ? 'ok' : 'bad'}${pop(o)}">${badge(o.ok)}<div class="tx"><div class="tt">${o.title}</div><div class="tb">${o.html}</div></div></div>`;
export function toast(fb) {
  const el = $('toast');
  clearTimeout(toastT);
  el.className = 'toast ' + (fb.ok ? 'ok' : 'bad');
  el.innerHTML = badge(fb.ok) +
    `<div class="tx"><div class="tt">${fb.title}${fb.hinted ? '<span class="tag hint">hint · not scored</span>' : ''}</div><div class="tb">${fb.html}</div></div>` +
    `<button data-a="toastx" aria-label="Dismiss">✕</button>`;
  el.hidden = false;
  void el.offsetWidth; // restart the slide-in when one toast replaces another
  el.classList.add('in');
  if (fb.ok) toastT = setTimeout(() => { el.classList.add('out'); toastT = setTimeout(hideToast, 250); }, 2000);
}
export function hideToast() {
  clearTimeout(toastT);
  const el = $('toast');
  if (el) el.hidden = true;
}

// Spoken labels for screen readers ("7 of hearts"); the visible rank/suit glyphs are hidden from them.
const RANK_NAME = { A: 'ace', K: 'king', Q: 'queen', J: 'jack' };
const SUIT_NAME = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
const cardLabel = c => `${RANK_NAME[c.r] || c.r} of ${SUIT_NAME[c.s]}`;

/** Card without animation (count drill, which flashes cards on its own). */
export function cardFace(c, cls = '', attr = '') {
  return `<div class="pc${c.s === '♥' || c.s === '♦' ? ' red' : ''}${cls}" role="img" aria-label="${cardLabel(c)}"${attr}><b aria-hidden="true">${c.r}</b><i aria-hidden="true">${c.s}</i></div>`;
}
// Dealing: a card rendered for the first time gets .deal (flies in from the shoe), or .flip if it was
// on the table face down (the dealer's hole card). c.n, when set, is the order the card left the shoe;
// dealCards() in main.js sorts by it to time each card and to aim it from the shoe.
const faceDown = new WeakSet();
const dealAttr = c => (c.n ? ` data-n="${c.n}"` : '');
/** Card that's dealt in (or flipped over) the first time it's rendered. */
export function cardHTML(c) {
  if (!fresh(c)) return cardFace(c);
  return cardFace(c, faceDown.has(c) ? ' flip' : ' deal', dealAttr(c));
}
/** Face-down card c: dealt in like any card; cardHTML(c) later flips it over. */
export function backHTML(c) {
  if (faceDown.has(c)) return '<div class="pc back" role="img" aria-label="face-down card"></div>';
  faceDown.add(c);
  return `<div class="pc back deal" role="img" aria-label="face-down card"${dealAttr(c)}></div>`;
}

export function totalTxt(c) {
  const i = info(c);
  return i.t > 21 ? `${i.t} bust` : (i.soft ? 'soft ' : '') + i.t;
}

/** Count value as shown in a stepper: +3, 0, −2. */
export const stpTxt = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);

/** Number input for counts: big readout, round −/+ buttons, ±5 at the ends. The readout can also be
 *  dragged sideways or changed with the arrow keys (handled in main.js). Value lives in STP[id].
 *  units: a bet instead of a count, shown without a sign and never below 1 (data-u). */
export function stepper(id, units = false) {
  if (!(id in STP)) STP[id] = units ? 1 : 0;
  return `<div class="stepper" data-stp="${id}"${units ? ' data-u' : ''}><button class="s5" data-a="stp:${id}:-5" aria-label="minus 5">−5</button>` +
    `<button class="s1" data-a="stp:${id}:-1" aria-label="minus 1">−</button>` +
    `<output id="o_${id}" tabindex="0" title="Drag sideways or use the arrow keys">${units ? STP[id] : stpTxt(STP[id])}</output>` +
    `<button class="s1" data-a="stp:${id}:1" aria-label="plus 1">+</button><button class="s5" data-a="stp:${id}:5" aria-label="plus 5">+5</button></div>`;
}

/** Fixed 3 + 2 grid of decision chips (data-a="<act>:H" ...). Unavailable actions stay in place, disabled,
 *  so positions never move. Surrender is left out entirely when the rules don't offer it.
 *  mark = { right, wrong } after a mistake: the right chip pulses and stays tappable, the others get
 *  aria-disabled (main.js ignores those clicks) and the wrong one a ✗ badge. */
export function actionBtns(act, o, canHit = true, mark = null) {
  const b = (a, label, ok) => {
    let cls = '', attr = ok ? '' : ' disabled';
    if (mark && a === mark.right) cls = ' right';
    else if (mark && ok) { cls = a === mark.wrong ? ' wrong' : ' dim'; attr = ' aria-disabled="true"'; }
    return `<button class="chip k${a}${cls}" data-a="${act}:${a}"${attr} title="${label} (${a})"><i>${a}</i>${label}</button>`;
  };
  return `<div class="chips${S.sur ? '' : ' nosur'}${mark ? ' mark' : ''}">${b('H', 'Hit', canHit)}${b('S', 'Stand', true)}${b('D', 'Double', o.canDouble)}` +
    `${b('P', 'Split', o.canSplit)}${S.sur ? b('R', 'Surrender', o.canSurrender) : ''}</div>`;
}

/** One cell of the stats strip: big value over a small label. Wrap cells in <div class="stats">. */
export const stat = (label, value, attr = '') => `<div><b${attr}>${value}</b><span>${label}</span></div>`;
/** Color class for a stat: an accuracy (90%+ green, 75%+ gold, below red) or a signed amount (+ green, − red). */
export const tone = {
  pct: (ok, n) => (n ? ` class="${ok / n >= 0.9 ? 't-good' : ok / n >= 0.75 ? 't-warn' : 't-bad'}"` : ''),
  sign: v => (v > 0 ? ' class="t-good"' : v < 0 ? ' class="t-bad"' : ''),
};

export function ruleSummary() {
  return `${S.decks} deck${S.decks > 1 ? 's' : ''}, ${S.h17 ? 'H17' : 'S17'}, ${S.das ? 'DAS' : 'no DAS'}, ${S.sur ? 'late surrender' : 'no surrender'}, ${S.bj === 1.5 ? '3:2' : '6:5'}${S.ra ? ', RSA' : ''}`;
}
