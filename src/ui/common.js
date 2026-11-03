// Small view helpers shared by the tabs.
import { SUITS, ACT, info, basic, devMatches } from '../engine.js';
import { S, STP, store } from '../state.js';

export const $ = id => document.getElementById(id);
/** A true count with its sign, to one decimal: '+2.5', '-1', '+0' (whole numbers drop the '.0'). */
export const fmt = x => { const r = Math.round(x * 10) / 10 || 0; return (r >= 0 ? '+' : '') + r; };
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

const tcTxt = i => (i > 0 ? '+' : '') + i;

/** An index rule as HTML, each play as a pill: "[Split] at TC ≥ +5". */
export function idxText(e) {
  const n = tcTxt(e.i);
  if (e.hi && e.lo) return `${actPill(e.hi)} at TC ≥ ${n}, ${actPill(e.lo)} below`;
  return e.hi ? `${actPill(e.hi)} at TC ≥ ${n}` : `${actPill(e.lo)} at TC < ${n}`;
}

/** All index rules for one spot (devMatches, first match wins) as one rule. 15 v 10 with surrender has two
 *  entries, which read as count ranges: "Stand at TC ≥ +4, Surrender from 0 to +3, Hit below 0". */
const ranged = m => m.length === 2 && m[0].hi && m[1].hi && !m[0].lo && m[0].i > m[1].i;
export function idxRule(m) {
  if (ranged(m)) {
    const [a, b] = m;
    return `${actPill(a.hi)} at TC ≥ ${tcTxt(a.i)}, ${actPill(b.hi)} from ${tcTxt(b.i)} to ${tcTxt(a.i - 1)}` + (b.lo ? `, ${actPill(b.lo)} below ${tcTxt(b.i)}` : '');
  }
  return m.map(idxText).join('; ');
}

/** Why the count turns a play into action a (default: entry e's play above its index), in plain words.
 *  Hi-Lo: a high count means more 10s and aces are left, a low one more small cards. It complements the
 *  basic-strategy reason, which is right at a neutral count. */
export function idxWhy(e, a = e.hi || e.lo) {
  const up = e.u === 11 ? 'ace' : e.u, t = e.t;
  if (e.k === 'p') return `With more 10s left, each 10 is likely to draw another one and the dealer's ${up} busts more often, so two hands beat one 20.`;
  if (a === 'D') return 'With more 10s and aces left, one card is more likely to make a strong total, so doubling pays.';
  if (a === 'S') return `With more 10s left, hitting ${t} busts more often, so standing becomes the better choice.`;
  if (a === 'R') return `With more 10s left, hitting ${t} busts more often and the dealer's ${up} more often makes a strong hand, so getting half your bet back is better.`;
  if (e.hi === 'R') return `With more small cards left, hitting ${t} busts less often, so it's worth playing on instead of giving up half your bet.`;
  return `With more small cards left, hitting ${t} rarely busts and the dealer's ${up} busts less often, so hit instead of standing.`;
}

/** The reasons for a whole spot's index rules (see idxRule): each entry's high-count play, plus the
 *  low-count play of a two-sided entry. A middle range that's basic strategy is explained by the basic reason. */
export function idxSpotWhy(m) {
  if (ranged(m)) return idxWhy(m[0]) + (m[1].lo ? ' ' + idxWhy(m[1], m[1].lo) : '');
  return m.map(e => idxWhy(e) + (e.hi && e.lo ? ' ' + idxWhy(e, e.lo) : '')).join(' ');
}

/** An action name as a small pill in its chip color (H green, S red, ...). */
export const actPill = a => `<b class="pill k${a[0]}">${ACT[a]}</b>`;

/** Feedback text for a decision: r is the result of best(). idx: mention the spot's index rules
 *  (at the table: the index plays setting; in the drill: its Index plays mode). */
export function explain(r, c, up, tc, o, idx = S.dev) {
  let s = `${describe(c)} vs ${upName(up)}: ${actPill(r.a)}`;
  const m = r.e || idx ? devMatches(c, up, S, o) : [];
  if (r.e && r.a !== r.b) {
    s += `. At TC ${fmt(tc)} the index play applies: ${idxRule(m)}. ${idxWhy(r.e, r.a)} Basic strategy says ${actPill(r.b)}.`;
  } else if (m.length) {
    s += `. With the count: ${idxRule(m)}. At TC ${fmt(tc)} that's ${actPill(r.a)}, the same as basic strategy.`;
  }
  return s;
}

const UPS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Round "?" button for the felt's dealer label row; toggles the hint panel. Until you've opened a hint
 *  once (tally_tip), a small "Not sure? Tap ?" bubble sits next to it. */
export const hintBtn = (act, open, off = false) =>
  (store.get('tally_tip', 0) ? '' : `<span class="tipbub${off ? ' off' : ''}" aria-hidden="true">Not sure? Tap <b>?</b></span>`) + (off
    // answered: the button (and the nudge) go invisible but keep their space, so the felt doesn't change height
    ? '<button class="qbtn off" disabled tabindex="-1" aria-hidden="true">?</button>'
    : `<button class="qbtn${open ? ' on' : ''}" data-a="${act}" aria-label="${open ? 'Hide hint' : 'Hint'}" aria-pressed="${open}" title="Hint">?</button>`);
/** The hint has been used: stop showing the nudge. */
export const hintUsed = () => store.set('tally_tip', 1);

/** Hint: this hand's basic strategy row (with its real options) against every upcard, the current one
 *  highlighted, plus index rules for the current upcard. Never reveals the count-dependent answer. */
export function hintHTML(c, up, o, tc = null, idx = S.dev) {
  const cell = u => { const a = basic(c, u, S, o); return `<td class="c${a[0]}${u === up ? ' on' : ''}">${a}</td>`; };
  let h = `<div class="panel hintp"><h3>Hint · not scored</h3><div class="tw"><table class="ch hint">` +
    `<tr><th></th>${UPS.map(u => `<th${u === up ? ' class="on"' : ''}>${upName(u)}</th>`).join('')}</tr>` +
    `<tr><th>${describe(c)}</th>${UPS.map(cell).join('')}</tr></table></div>`;
  const m = idx ? devMatches(c, up, S, o) : [];
  if (m.length) h += `<p>Index vs ${upName(up)}: ${idxRule(m)}. ${tc === null ? 'Apply it with your true count.' : `True count now <b>${fmt(tc)}</b>.`}</p>`;
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
/** Feedback for a decision (table, insurance, bet, drill). With S.fbin it doesn't use the banner: it's kept
 *  here and placeFeedback() shows it under the chips after each render. A correct answer fades after 2 s,
 *  a mistake stays until the next action. Other messages ("Weak spots reset", ...) use toast(). */
let inline = null, inlineT;
export function feedback(fb) {
  if (!S.fbin) return toast(fb);
  hideToast();
  inline = fb;
  fb.t0 = Date.now();
  if (fb.ok) inlineT = setTimeout(() => {
    $('view').querySelector('.fbslot .result')?.classList.add('out');
    inlineT = setTimeout(hideToast, 250);
  }, 2000);
}
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
  clearTimeout(inlineT);
  inline = null;
  $('view')?.querySelector('.fbslot .result')?.remove();
  const el = $('toast');
  if (el) el.hidden = true;
}

/** After each render (main.js): put pending feedback into the view's .fbslot, the zero-height spot under
 *  the chips (views add it with fbSlot), so the card floats over what's below and nothing moves. A re-render
 *  rebuilds the card without replaying its entrance, and the drain line of a correct answer keeps its place.
 *  A new mistake scrolls just enough to be seen. A view without a slot gets the banner. */
export const fbSlot = '<div class="fbslot"></div>';
export function placeFeedback() {
  if (!inline) return;
  const slot = $('view').querySelector('.fbslot');
  if (!slot) { const fb = inline; hideToast(); toast(fb); return; }
  const fb = inline, first = fresh(fb);
  slot.innerHTML = `<div class="result ${fb.ok ? 'ok' : 'bad'}${first ? ' pop' : ''}" role="status" style="--el:${fb.t0 - Date.now()}ms">${badge(fb.ok)}` +
    `<div class="tx"><div class="tt">${fb.title}${fb.hinted ? '<span class="tag hint">hint · not scored</span>' : ''}</div><div class="tb">${fb.html}</div></div></div>`;
  if (first && !fb.ok) revealCard(slot.firstChild);
}
/** Scroll a new mistake card into view, but only when a real part of it (40px+) is below the screen: a tiny
 *  scroll would just look like the page jumped. The card floats over the phone's tab bar (it's above the
 *  header's layer), so that space counts as visible. */
function revealCard(el) {
  const hidden = el.getBoundingClientRect().bottom + 8 - innerHeight;
  if (hidden > 40) scrollBy({ top: hidden, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
/** The "Tap <play> to continue" line under the chips after a mistake. It's always rendered (invisible when
 *  there's no mistake), so it never changes the height of the column and the chips stay put. */
export const contLine = play =>
  `<p class="muted center"${play ? '' : ' aria-hidden="true" style="visibility:hidden"'}>${play ? `Tap <b>${play}</b> to continue` : '&nbsp;'}</p>`;

export function actionBtns(act, o, canHit = true, mark = null, good = null) {
  const b = (a, label, ok) => {
    let cls = a === good ? ' good' : '', attr = ok ? '' : ' disabled'; // good: the right answer just tapped (✓)
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
