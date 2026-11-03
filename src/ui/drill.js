// Strategy drill: single decisions, weighted toward the user's weak spots.
// Two modes (S.drmode): 0 basic strategy only (no count), 1 index plays only: the Illustrious 18 + Fab 4
// and insurance, at true counts near each index. The "index plays" setting (S.dev) is for the table only.
import { info, best, basic, devMatches, DEV, ACT, INS_IDX, handFor } from '../engine.js';
import { reason } from './charts.js';
import { S, app, ST, record, keyFor, resetStats, store, logDay } from '../state.js';
import { pick, mkCard, totalTxt, cardHTML, explain, upName, actionBtns, stat, tone, hintHTML, hintBtn, toast, feedback, hideToast, actPill, idxRule, idxSpotWhy, hintUsed, fmt, fbSlot, contLine } from './common.js';

// streak: correct answers in a row (hinted answers don't count either way); best is saved (tally_streak).
// grew: the streak just went up, so the next render pops the number.
const SD = { cur: null, fb: null, hint: false, hinted: false, sess: { n: 0, ok: 0 }, t: null, streak: 0, best: store.get('tally_streak', 0), grew: false };
const DIST = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11];

export function resetDrill() { SD.cur = null; SD.fb = null; SD.hint = SD.hinted = false; }
function next() { SD.cur = genScenario(); SD.fb = null; SD.hint = SD.hinted = false; app.render(); }

function drillOpts(c) {
  const n = c.length === 2;
  return { canDouble: n, canSplit: n && c[0] === c[1], canSurrender: S.sur && n };
}

function genOne() {
  for (;;) {
    const c = [pick(DIST), pick(DIST)];
    if (info(c).t === 21) continue;
    if (Math.random() < 0.15 && !info(c).soft && info(c).t <= 12) {
      c.push(pick(DIST));
      if (info(c).t >= 21 || (info(c).soft && info(c).t > 19)) continue;
    }
    return { c, up: pick(DIST) };
  }
}

/** Weighted pick: w(x) from the user's record, so missed situations come up more often. */
function weighted(list, key) {
  const w = x => { const st = ST[key(x)]; return 1 + (8 * ((st ? st.m : 0) + 0.3)) / ((st ? st.n : 0) + 1); };
  const ws = list.map(w);
  let r = Math.random() * ws.reduce((a, x) => a + x, 0);
  return list.find((x, i) => (r -= ws[i]) <= 0) || list[0];
}

const INS_KEY = 'INS|11|i';

/** Index mode: one index spot (entries sharing a hand, like 15 v 10, are one spot with several indexes)
 *  or the insurance question, with a true count within 2 of one of its indexes. */
function genIndex() {
  const spots = new Map();
  for (const e of DEV) {
    if (e.sur && !S.sur) continue;
    const c = e.k === 'p' ? [10, 10] : handFor(e.t), k = keyFor(c, e.u, drillOpts(c), true);
    if (!spots.has(k)) spots.set(k, { k, c, up: e.u, idx: [] });
    spots.get(k).idx.push(e.i);
  }
  spots.set(INS_KEY, { k: INS_KEY, ins: true, up: 11, idx: [INS_IDX] });
  const s = weighted([...spots.values()], x => x.k);
  const tc = pick(s.idx) + pick([-2, -1, -1, 0, 0, 1, 1, 2]);
  if (!s.ins) return { ...s, tc };
  // insurance: the hand doesn't matter, any two cards that aren't a blackjack
  let c;
  do c = [pick(DIST), pick(DIST)]; while (info(c).t === 21);
  return { ...s, c, tc };
}

function genScenario() {
  if (S.drmode) {
    const x = genIndex();
    return { c: x.c, cards: x.c.map(mkCard), up: x.up, upCard: mkCard(x.up), tc: x.tc, o: drillOpts(x.c), ins: !!x.ins };
  }
  // Sample 30 candidates, weight each by the user's miss rate for that situation.
  const s = weighted(Array.from({ length: 30 }, genOne), x => keyFor(x.c, x.up, drillOpts(x.c), false));
  return { c: s.c, cards: s.c.map(mkCard), up: s.up, upCard: mkCard(s.up), tc: 0, o: drillOpts(s.c) };
}

/** One Weakest spots entry: the situation and your record, the correct basic play with the Strategy tab's
 *  reason, and the index rule for the spot. Rebuilt from the stats key (keyFor in state.js), e.g. 'H16|10',
 *  'S18*|9' (3+ cards: no double / split / surrender), 'P8|11', '…|i' (an index situation). */
function spotHTML(k, v) {
  const rec = `<span${tone.pct(v.n - v.m, v.n)}>${v.n - v.m} of ${v.n} right</span>`;
  if (k === INS_KEY) {
    return `<div class="spot"><div class="sp-top"><b>Insurance vs A</b>${rec}</div>
      <div class="sp-play">Basic strategy: <b>decline</b>. Insurance is a side bet that the hole card is a 10, and it loses more often than its 2:1 payout makes up for.</div>
      <div class="sp-idx">With the count: <b>take it at TC ≥ +${INS_IDX}</b>. With that many 10s left, the bet wins often enough to pay.</div></div>`;
  }
  const [h, u] = k.split('|'), up = +u, kind = h[0], n = +h.slice(1).replace('*', ''), multi = h.includes('*');
  const cards = kind === 'P' ? [n, n] : kind === 'S' ? (n - 11 >= 2 ? [11, n - 11] : [11, 11]) : handFor(n);
  const o = multi ? { canDouble: false, canSplit: false, canSurrender: false } : { canDouble: true, canSplit: kind === 'P', canSurrender: S.sur };
  const a = basic(cards, up, S, o), m = devMatches(cards, up, S, o); // index lines are labelled, so always shown
  const name = (kind === 'P' ? 'Pair of ' + (n === 11 ? 'aces' : n + 's') : (kind === 'S' ? 'Soft ' : 'Hard ') + n) + (multi ? ' (3+ cards)' : '');
  return `<div class="spot">
    <div class="sp-top"><b>${name} vs ${upName(up)}</b>${rec}</div>
    <div class="sp-play">${m.length ? 'Basic strategy: ' : ''}${actPill(a)} ${reason(kind.toLowerCase(), n, up, a)}</div>
    ${m.length ? `<div class="sp-idx">With the count: ${idxRule(m)}. ${idxSpotWhy(m)}</div>` : ''}</div>`;
}

function drillAct(a) {
  const s = SD.cur;
  // After a mistake only the correct chip is tappable, and it moves on to the next hand.
  if (SD.fb) { if (!SD.fb.ok && a === SD.fb.right) next(); return; }
  if (s.ins) return;
  const idx = !!S.drmode, r = best(s.c, s.up, s.tc, S, s.o, idx), ok = a === r.a;
  // index mode keys every answer as an index spot (|i), so the spot's weighting doesn't depend on the count
  score(keyFor(s.c, s.up, s.o, !!S.drmode || !!r.e), ok,
    { right: r.a, wrong: a, title: ok ? 'Correct' : `You chose ${ACT[a]}`, html: explain(r, s.c, s.up, s.tc, s.o, idx) });
}

/** Insurance question (index mode). right / wrong are '1' (take) or '0' (decline), like the buttons. */
function insAct(v) {
  const s = SD.cur;
  if (SD.fb) { if (!SD.fb.ok && v === SD.fb.right) next(); return; }
  if (!s.ins) return;
  const take = s.tc >= INS_IDX, ok = (v === '1') === take;
  score(INS_KEY, ok, {
    right: take ? '1' : '0', wrong: v,
    title: ok ? 'Correct' : `You ${v === '1' ? 'took' : 'declined'} insurance`,
    html: `Insurance: <b>${take ? 'take it' : 'decline'}</b> — take at TC ≥ +${INS_IDX} (TC ${fmt(s.tc)}). ` +
      (take ? 'With that many 10s left, the side bet wins often enough to pay.' : 'Below that, it loses more often than its 2:1 payout makes up for.'),
  });
}

/** Score an answer (unless hinted), update the streak, show the toast; a correct answer moves on by itself. */
function score(key, ok, fb) {
  record(key, ok && !SD.hinted);
  if (!SD.hinted) {
    logDay({ dec: 1, ok: ok ? 1 : 0 });
    SD.sess.n++;
    if (ok) {
      SD.sess.ok++; SD.streak++; SD.grew = true;
      if (SD.streak > SD.best) { SD.best = SD.streak; store.set('tally_streak', SD.best); }
    } else SD.streak = 0;
  }
  SD.hint = false; // the stats strip comes back under the toast
  SD.fb = { ...fb, ok, hinted: SD.hinted };
  feedback(SD.fb);
  app.render();
  if (ok) {
    clearTimeout(SD.t);
    // pause on the correct answer before the next hand; shorter with the Fast deal speed
    SD.t = setTimeout(() => { if (app.tab === 'drill' && SD.fb && SD.fb.ok) next(); }, Math.max(450, 900 * S.pace));
  }
}

/** Enter / Space continues after a mistake (desktop). */
export function onKey(e) {
  if (app.tab !== 'drill' || !SD.fb || SD.fb.ok || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault();
  hideToast();
  next();
}

export const actions = {
  dr: drillAct,
  drins: insAct,
  drhint: () => { SD.hint = !SD.hint; SD.hinted = true; hintUsed(); app.render(); },
  resetstats: () => { resetStats(); app.render(); toast({ ok: true, title: 'Weak spots reset', html: 'Your right/wrong record for every situation is cleared.' }); },
};

export function render() {
  if (!SD.cur) SD.cur = genScenario();
  const s = SD.cur, o = s.o, ss = SD.sess;
  // An open hint replaces the stats strip, so it's on screen without pushing the chips far down.
  // streak: gold from 5 in a row; pops when it just went up
  const streakAttr = (SD.grew ? ' data-grow' : '') + (SD.streak >= 5 ? ' class="t-warn"' : '');
  SD.grew = false;
  const idx = !!S.drmode;
  let h = SD.hint
    ? (s.ins
      ? `<div class="panel hintp"><h3>Hint · not scored</h3><p>Basic strategy never takes insurance. Counters take it at a true count of <b>+${INS_IDX}</b> or more.</p></div>`
      : hintHTML(s.c, s.up, o, null, idx))
    : `<div class="stats">${stat('this session', `${ss.ok}/${ss.n}`)}${stat('correct', ss.n ? Math.round((ss.ok / ss.n) * 100) + '%' : '–', tone.pct(ss.ok, ss.n))}` +
      `${stat('streak', SD.streak, streakAttr)}${stat('best streak', SD.best)}</div>`;
  // mode picker under the stats strip: the toast is sized to cover the strip, right under the tab bar
  h += `<div class="seg drmode">${[[0, 'Basic strategy'], [1, 'Index plays']].map(([v, t]) =>
    `<button data-a="setopt:drmode:${v}" class="${S.drmode == v ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  h += `<div class="felt"><div><div class="lbl">Dealer shows${hintBtn('drhint', SD.hint, !!SD.fb)}</div><div class="cards">${cardHTML(s.upCard)}</div></div>
    <div><div class="lbl">Your hand <b>${totalTxt(s.c)}</b></div><div class="cards">${s.cards.map(cardHTML).join('')}</div></div>
    ${idx ? `<div class="lbl">True count <b>${s.tc >= 0 ? '+' : ''}${s.tc}</b></div>` : ''}</div>`;
  // feedback text goes to the toast (a mistake: under the chips, see fbSlot); after a mistake the chips show the right play and wait for it
  const miss = SD.fb && !SD.fb.ok;
  h += `<div class="side">`; // .side: right column on wide screens
  if (s.ins) {
    // after a mistake the right answer turns gold (Enter presses it) and the other one is disabled
    const b = (v, t) => `<button class="b${miss && v === SD.fb.right ? ' primary' : ''}" data-a="drins:${v}"${miss && v !== SD.fb.right ? ' aria-disabled="true"' : ''}>${t}</button>`;
    h += `<div class="panel"><h3>Insurance</h3><p>The dealer shows an ace. Take insurance?</p><div class="btns">${b('1', 'Take insurance')}${b('0', 'No insurance')}</div></div>`;
    h += contLine(miss && (SD.fb.right === '1' ? 'Take insurance' : 'No insurance'));
  } else {
    h += actionBtns('dr', o, true, miss ? SD.fb : null, SD.fb?.ok ? SD.fb.wrong : null); // ✓ on a right answer
    h += contLine(miss && ACT[SD.fb.right]);
  }
  h += fbSlot + `</div>`; // mistake card (S.fbin) floats here; end .side: Weakest spots goes below, full width on wide screens
  // Every situation you've missed at least once, worst first (index mode: only index spots and insurance).
  // The miss rate is smoothed ((m + .5) / (n + 1)), so one miss in one try doesn't outrank 4 misses in 5;
  // ties go to the one with more misses.
  const rate = v => (v.m + 0.5) / (v.n + 1);
  const weak = Object.entries(ST).filter(([k, v]) => v.m > 0 && (!idx || k.endsWith('|i')))
    .sort((a, b) => rate(b[1]) - rate(a[1]) || b[1].m - a[1].m).slice(0, 8);
  h += `<div class="panel"><h3>Weakest ${idx ? 'index spots' : 'spots'}</h3>` +
    (weak.length
      ? `<div class="spots">${weak.map(([k, v]) => spotHTML(k, v)).join('')}</div><p class="muted">The drill shows these more often until you get them right.</p>`
      : `<p class="muted">${idx ? 'Index plays you miss show up here.' : 'Mistakes from the drill and the table show up here.'}</p>`) +
    `<div class="btns mid"><button class="b ghost danger" data-a="resetstats" data-confirm="Tap again to confirm">Reset weak spots</button></div>` +
    `<p class="muted small center">Clears this list and your right/wrong record for every situation (drill and table), so the drill stops favoring past mistakes.</p></div>`;
  return h;
}
