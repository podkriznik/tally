// Strategy drill: single decisions, weighted toward the user's weak spots.
import { info, best, basic, devMatches, DEV, ACT, handFor } from '../engine.js';
import { reason } from './charts.js';
import { S, app, ST, record, keyFor, resetStats, store, logDay } from '../state.js';
import { pick, mkCard, totalTxt, cardHTML, explain, upName, actionBtns, stat, tone, hintHTML, hintBtn, toast, hideToast, actPill, idxText, hintUsed } from './common.js';

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

function genScenario() {
  let s, tc = 0;
  if (S.dev && Math.random() < 0.35) {
    // Index-play situation, with a count near its index.
    const e = pick(DEV.filter(e => !e.sur || S.sur));
    s = { c: e.k === 'p' ? [10, 10] : handFor(e.t), up: e.u };
    tc = e.i + pick([-2, -1, 0, 0, 1, 2]);
  } else {
    // Sample 30 candidates, weight each by the user's miss rate for that situation.
    const cands = [];
    for (let i = 0; i < 30; i++) {
      const x = genOne();
      const st = ST[keyFor(x.c, x.up, drillOpts(x.c), false)];
      x.w = 1 + (8 * ((st ? st.m : 0) + 0.3)) / ((st ? st.n : 0) + 1);
      cands.push(x);
    }
    let r = Math.random() * cands.reduce((a, x) => a + x.w, 0);
    s = cands.find(x => (r -= x.w) <= 0) || cands[0];
    tc = S.dev ? pick([-3, -2, -1, -1, 0, 0, 0, 1, 1, 2, 3, 4, 5, 6]) : 0;
  }
  return { c: s.c, cards: s.c.map(mkCard), up: s.up, upCard: mkCard(s.up), tc, o: drillOpts(s.c) };
}

/** One Weakest spots entry: the situation and your record, the correct basic play with the Strategy tab's
 *  reason, and the index rule for the spot. Rebuilt from the stats key (keyFor in state.js), e.g. 'H16|10',
 *  'S18*|9' (3+ cards: no double / split / surrender), 'P8|11', '…|i' (an index situation). */
function spotHTML(k, v) {
  const [h, u, idx] = k.split('|'), up = +u, kind = h[0], n = +h.slice(1).replace('*', ''), multi = h.includes('*');
  const cards = kind === 'P' ? [n, n] : kind === 'S' ? (n - 11 >= 2 ? [11, n - 11] : [11, 11]) : handFor(n);
  const o = multi ? { canDouble: false, canSplit: false, canSurrender: false } : { canDouble: true, canSplit: kind === 'P', canSurrender: S.sur };
  const a = basic(cards, up, S, o), m = S.dev ? devMatches(cards, up, S, o) : [];
  const name = (kind === 'P' ? 'Pair of ' + (n === 11 ? 'aces' : n + 's') : (kind === 'S' ? 'Soft ' : 'Hard ') + n) + (multi ? ' (3+ cards)' : '');
  return `<div class="spot">
    <div class="sp-top"><b>${name} vs ${upName(up)}</b><span${tone.pct(v.n - v.m, v.n)}>${v.n - v.m} of ${v.n} right</span></div>
    <div class="sp-play">${actPill(a)} ${reason(kind.toLowerCase(), n, up, a)}</div>
    ${m.length ? `<div class="sp-idx">Index${idx ? ' (this spot depends on the count)' : ''}: ${m.map(idxText).join('; ')}.</div>` : ''}</div>`;
}

function drillAct(a) {
  const s = SD.cur;
  // After a mistake only the correct chip is tappable, and it moves on to the next hand.
  if (SD.fb) { if (!SD.fb.ok && a === SD.fb.right) next(); return; }
  const r = best(s.c, s.up, s.tc, S, s.o, S.dev), ok = a === r.a;
  record(keyFor(s.c, s.up, s.o, !!r.e), ok && !SD.hinted);
  if (!SD.hinted) {
    logDay({ dec: 1, ok: ok ? 1 : 0 });
    SD.sess.n++;
    if (ok) {
      SD.sess.ok++; SD.streak++; SD.grew = true;
      if (SD.streak > SD.best) { SD.best = SD.streak; store.set('tally_streak', SD.best); }
    } else SD.streak = 0;
  }
  SD.hint = false; // the stats strip comes back under the toast
  SD.fb = { ok, right: r.a, wrong: a, title: ok ? 'Correct' : `You chose ${ACT[a]}`, html: explain(r, s.c, s.up, s.tc, s.o), hinted: SD.hinted };
  toast(SD.fb);
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
  let h = SD.hint ? hintHTML(s.c, s.up, o)
    : `<div class="stats">${stat('this session', `${ss.ok}/${ss.n}`)}${stat('correct', ss.n ? Math.round((ss.ok / ss.n) * 100) + '%' : '–', tone.pct(ss.ok, ss.n))}` +
      `${stat('streak', SD.streak, streakAttr)}${stat('best streak', SD.best)}</div>`;
  h += `<div class="felt"><div><div class="lbl">Dealer shows${SD.fb ? '' : hintBtn('drhint', SD.hint)}</div><div class="cards">${cardHTML(s.upCard)}</div></div>
    <div><div class="lbl">Your hand <b>${totalTxt(s.c)}</b></div><div class="cards">${s.cards.map(cardHTML).join('')}</div></div>
    ${S.dev ? `<div class="lbl">True count <b>${s.tc >= 0 ? '+' : ''}${s.tc}</b></div>` : ''}</div>`;
  // feedback text goes to the toast; after a mistake the chips show the right play and wait for it
  const miss = SD.fb && !SD.fb.ok;
  h += `<div class="side">` + actionBtns('dr', o, true, miss ? SD.fb : null); // .side: right column on wide screens
  if (miss) h += `<p class="muted center">Tap <b>${ACT[SD.fb.right]}</b> to continue</p>`;
  h += `</div>`; // end .side: Weakest spots goes below, full width on wide screens
  // Every situation you've missed at least once, worst first. The miss rate is smoothed ((m + .5) / (n + 1)),
  // so one miss in one try doesn't outrank 4 misses in 5; ties go to the one with more misses.
  const rate = v => (v.m + 0.5) / (v.n + 1);
  const weak = Object.entries(ST).filter(([, v]) => v.m > 0)
    .sort((a, b) => rate(b[1]) - rate(a[1]) || b[1].m - a[1].m).slice(0, 8);
  h += `<div class="panel"><h3>Weakest spots</h3>` +
    (weak.length
      ? `<div class="spots">${weak.map(([k, v]) => spotHTML(k, v)).join('')}</div><p class="muted">The drill shows these more often until you get them right.</p>`
      : `<p class="muted">Mistakes from the drill and the table show up here.</p>`) +
    `<div class="btns mid"><button class="b ghost danger" data-a="resetstats" data-confirm="Tap again to confirm">Reset weak spots</button></div>` +
    `<p class="muted small center">Clears this list and your right/wrong record for every situation (drill and table), so the drill stops favoring past mistakes.</p></div>`;
  return h;
}
