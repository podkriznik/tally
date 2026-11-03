// Table tab: play hands from a shoe, keep the count, get feedback.
import { info, basic, best, ACT, INS_IDX, Shoe, rampBet } from '../engine.js';
import { S, app, store, STP, record, keyFor, BEGINNER, logDay } from '../state.js';
import { fmt, sign, cardHTML, backHTML, totalTxt, stepper, explain, actionBtns, stat, tone, hintHTML, hintBtn, fresh, toast, feedback, hideToast, resultCard, hintUsed, fbSlot, contLine } from './common.js';

const T = {
  shoe: null, phase: 'idle', dealer: [], hole: true, others: [], hero: [], hi: 0,
  res: null, ask: null, rounds: 0, ins: null, shuffled: false, insTC: 0, hint: false, hinted: false, miss: null,
  unit: 1, lastBet: 1, // bet practice: units bet on the current hand, and the last bet (the next bet's starting value)
  st: store.get('tally_table', { dec: 0, ok: 0, hands: 0, units: 0 }),
};
const vals = h => h.c.map(x => x.v);
const saveT = () => store.set('tally_table', T.st);
// c.n = order the card left the shoe, so the deal animation follows the real dealing order.
let dealt = 0;
function draw() { const c = T.shoe.draw(); c.n = ++dealt; return c; }
function drawS() { const c = draw(); T.shoe.see(c); return c; }
function revealHole() { if (T.hole) { T.hole = false; T.shoe.see(T.dealer[1]); } }

/** Force a fresh shoe next deal (after deck/penetration changes). */
export function resetShoe() { T.shoe = null; }

// Bet practice (S.bets): Deal / Next hand first opens a bet step; the bet is graded against the ramp for
// the true count the next hand is dealt at (0 when the shoe is about to be reshuffled).
const nextShuffle = () => !T.shoe || T.shoe.needShuffle();
const nextTC = () => (nextShuffle() ? 0 : T.shoe.tc());
function beginBet() {
  T.phase = 'bet'; T.res = null; T.ask = null; T.miss = null;
  STP.bet = T.lastBet;
  app.render();
}
function placeBet() {
  const bet = Math.max(1, STP.bet || 1), tc = nextTC(), want = rampBet(tc, S.spread), ok = bet === want;
  T.st.bdec = (T.st.bdec || 0) + 1;
  if (ok) T.st.bok = (T.st.bok || 0) + 1;
  feedback({
    ok, title: ok ? `Right bet: ${bet} unit${bet === 1 ? '' : 's'}` : `You bet ${bet} unit${bet === 1 ? '' : 's'}`,
    html: `True count ${fmt(tc)}${nextShuffle() ? ' (new shoe)' : ''}: the 1–${S.spread} ramp bets ${want} unit${want === 1 ? '' : 's'}.`,
  });
  T.unit = T.lastBet = bet;
  startRound();
}

function startRound() {
  T.shuffled = false;
  if (!T.shoe || T.shoe.needShuffle()) { T.shoe = new Shoe(S); T.shuffled = true; }
  T.res = null; T.ask = null; T.ins = null; T.miss = null; T.dealer = []; T.hole = true;
  T.others = [];
  for (let i = 0; i < S.others; i++) T.others.push({ c: [], bet: 1 });
  T.hero = [{ c: [], bet: 1, fs: false, done: false }];
  T.hi = 0;
  const seats = [...T.others, T.hero[0]];
  for (const s of seats) s.c.push(drawS());
  T.dealer.push(drawS());
  for (const s of seats) s.c.push(drawS());
  T.dealer.push(draw()); // hole card: not counted until revealed
  T.rounds++;
  const h0 = T.hero[0];
  h0.bj = info(vals(h0)).t === 21;
  if (T.dealer[0].v === 11) { T.phase = 'insurance'; T.insTC = T.shoe.tc(); app.render(); return; }
  afterInsurance();
}

function afterInsurance() {
  const d = T.dealer;
  if (d[0].v >= 10 && d[0].v + d[1].v === 21) { revealHole(); settle(); return; }
  const up = d[0].v;
  // Other players play simplified basic strategy (no splits/surrender).
  for (const b of T.others) {
    for (;;) {
      const v = vals(b), i = info(v);
      if (i.t >= 21) break;
      const a = basic(v, up, S, { canDouble: b.c.length === 2, canSplit: false, canSurrender: false });
      if (a === 'H') { b.c.push(drawS()); continue; }
      if (a === 'D') { b.c.push(drawS()); b.bet = 2; }
      break;
    }
  }
  if (T.hero[0].bj) { T.hero[0].done = true; dealerAndSettle(); return; }
  T.phase = 'hero';
  app.render();
}

function opts(h) {
  const n = h.c.length === 2, aceSplit = h.fs && h.c[0].v === 11;
  return {
    aceSplit,
    canDouble: n && !aceSplit && (!h.fs || S.das),
    canSplit: n && h.c[0].v === h.c[1].v && T.hero.length < 4 && (!h.fs || h.c[0].v !== 11 || S.ra),
    canSurrender: S.sur && n && !h.fs && T.hero.length === 1,
  };
}

function moveNext() {
  while (T.hi < T.hero.length) {
    const h = T.hero[T.hi];
    if (h.c.length === 1) {
      h.c.push(drawS());
      if (h.c[0].v === 11 && !(h.c[1].v === 11 && S.ra && T.hero.length < 4)) h.done = true;
    }
    if (h.done || info(vals(h)).t >= 21) { h.done = true; T.hi++; continue; }
    T.phase = 'hero';
    app.render();
    return;
  }
  dealerAndSettle();
}

// Like the drill: a wrong decision is scored but not played. The chips mark the right play
// (T.miss = { right, wrong }) and only that chip continues, playing the correct move.
function heroAct(a) {
  if (T.miss) { if (a === T.miss.right) { T.miss = null; play(a); } return; }
  const h = T.hero[T.hi], o = opts(h), v = vals(h), up = T.dealer[0].v, tc = T.shoe.tc();
  const r = best(v, up, tc, S, o, S.dev), ok = a === r.a, hinted = T.hinted;
  T.hint = T.hinted = false;
  if (!hinted) { T.st.dec++; if (ok) T.st.ok++; logDay({ dec: 1, ok: ok ? 1 : 0 }); }
  record(keyFor(v, up, o, !!r.e), ok && !hinted);
  feedback({ ok, title: ok ? 'Correct' : `You chose ${ACT[a]}`, html: explain(r, v, up, tc, o), hinted });
  if (ok) play(a);
  else { T.miss = { right: r.a, wrong: a }; app.render(); }
}

/** Carry out decision a on the active hand. */
function play(a) {
  const h = T.hero[T.hi];
  if (a === 'H') { h.c.push(drawS()); if (info(vals(h)).t >= 21) h.done = true; }
  else if (a === 'S') h.done = true;
  else if (a === 'D') { h.bet = 2; h.c.push(drawS()); h.done = true; }
  else if (a === 'R') { h.sur = true; h.done = true; }
  else if (a === 'P') {
    const nh = { c: [h.c[1]], bet: 1, fs: true, done: false };
    h.c = [h.c[0]]; h.fs = true;
    T.hero.splice(T.hi + 1, 0, nh);
  }
  if (h.done) T.hi++;
  if (h.done || a === 'P') moveNext(); else app.render();
}

function insAct(yes) {
  const tc = T.insTC, correct = S.dev && tc >= INS_IDX, ok = yes === correct;
  T.st.dec++;
  if (ok) T.st.ok++;
  logDay({ dec: 1, ok: ok ? 1 : 0 });
  T.ins = yes;
  feedback({
    ok,
    title: ok ? 'Correct' : `You ${yes ? 'took' : 'declined'} insurance`,
    html: `Insurance: <b>${correct ? 'take it' : 'decline'}</b>` +
      (S.dev ? ` — take at TC ≥ +${INS_IDX} (TC ${fmt(tc)}).` : ' — basic strategy never takes insurance.'),
  });
  afterInsurance();
}

function dealerAndSettle() {
  revealHole();
  const live = T.hero.some(h => !h.sur && !h.bj && info(vals(h)).t <= 21);
  if (live) for (;;) {
    const i = info(T.dealer.map(c => c.v));
    if (i.t < 17 || (i.t === 17 && i.soft && S.h17)) T.dealer.push(drawS()); else break;
  }
  settle();
}

function settle() {
  revealHole();
  const dv = T.dealer.map(c => c.v), dt = info(dv).t, dbj = dv.length === 2 && dt === 21;
  let net = 0;
  for (const h of T.hero) {
    const t = info(vals(h)).t;
    let r;
    if (h.sur) r = -0.5;
    else if (h.bj) r = dbj ? 0 : S.bj;
    else if (dbj) r = -h.bet;
    else if (t > 21) r = -h.bet;
    else if (dt > 21 || t > dt) r = h.bet;
    else if (t < dt) r = -h.bet;
    else r = 0;
    h.net = r * T.unit; // results above are per unit bet; T.unit is 1 unless bet practice is on
    net += h.net;
  }
  if (T.ins) net += (dbj ? 1 : -0.5) * T.unit;
  T.st.units += net;
  T.st.hands++;
  saveT();
  T.res = { net, dbj };
  T.phase = 'result';
  if (S.ask > 0 && T.rounds % S.ask === 0) { T.ask = { done: false }; STP.rc = 0; }
  app.render();
}

function askSubmit() {
  const a = T.shoe.rc, u = STP.rc;
  T.ask = { done: true, ok: u === a, a, u };
  T.st.cq = (T.st.cq || 0) + 1;
  if (u === a) T.st.cok = (T.st.cok || 0) + 1;
  logDay({ cq: 1, cok: u === a ? 1 : 0 });
  saveT();
  app.render();
}

/** Enter / Space plays the marked right move after a mistake (desktop). */
export function onKey(e) {
  if (app.tab !== 'table' || !T.miss || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault();
  hideToast();
  heroAct(T.miss.right);
}

export const actions = {
  deal: () => { if (S.bets) beginBet(); else { T.unit = 1; startRound(); } },
  betdeal: placeBet,
  act: heroAct,
  ins: v => insAct(v === '1'),
  hint: () => { T.hint = !T.hint; T.hinted = true; hintUsed(); app.render(); },
  asksub: askSubmit,
  askskip: () => { T.ask = null; app.render(); },
  resetall: () => {
    T.st = { dec: 0, ok: 0, hands: 0, units: 0 }; saveT(); app.render();
    toast({ ok: true, title: 'Table record reset', html: 'Hands, correct %, units, count checks and bet accuracy are back to zero.' });
  },
};

// Welcome screen before the first deal: the logo, one line on what Tally does, and three starting points.
// "Play a shoe" is the gold primary, so Enter / Space deals.
const ICON = {
  learn: '<path d="M2 5.5C4.5 4 8.5 4 12 6c3.5-2 7.5-2 10-.5V19c-2.5-1.5-6.5-1.5-10 .5-3.5-2-7.5-2-10-.5z"/><path d="M12 6v13.5"/>',
  drill: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  play: '<rect x="4" y="3" width="12" height="16" rx="2"/><path d="M9 21h9a2 2 0 0 0 2-2V8"/>',
};
function welcome() {
  const opt = (a, icon, title, sub, cls = '') =>
    `<button class="start${cls}" data-a="${a}"><span class="si"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[icon]}</svg></span><span><b>${title}</b><small>${sub}</small></span></button>`;
  return `<div class="felt welcome">
    <svg class="wmk" viewBox="0 0 24 24" aria-hidden="true"><g stroke-linecap="round" fill="none"><path d="M7.5 6.5v11M10.5 6.5v11M13.5 6.5v11M16.5 6.5v11" stroke="#fff" stroke-width="1.7"/><path d="M5.5 16L18.5 8" stroke="var(--accent)" stroke-width="1.9"/></g></svg>
    <p class="tag-line">Learn blackjack basic strategy and Hi-Lo card counting, one hand at a time.</p>
  </div>
  <div class="side starts">
    ${opt('guide', 'learn', 'Learn the basics', 'Rules, terms and how counting works')}
    ${opt('tab:drill', 'drill', 'Drill strategy', 'Quick decisions, focused on your weak spots')}
    ${opt('deal', 'play', 'Play a shoe', `${S.decks} decks, ${S.others} other player${S.others === 1 ? '' : 's'}. Keep the count as you play.`, ' primary')}
    ${Object.entries(BEGINNER).every(([k, v]) => S[k] === v) ? ''
      : '<button class="b ghost newbie" data-a="beginner">New to blackjack? Set me up for beginners</button>'}
  </div>`;
}

/** Bet step: the felt explains what to bet on; the bet is set with a stepper in units. */
function betHTML() {
  const shuffle = nextShuffle();
  return `<div class="felt betting"><div class="lbl">Place your bet</div>
    <p>${shuffle ? 'A new shoe is about to be shuffled, so the count starts at 0: bet the minimum.'
      : `True count = running count ÷ decks left (${T.shoe.decksLeft()}). The higher it is, the more you bet.`}</p>
    ${S.showCount && !shuffle ? `<div class="lbl">True count <b>${fmt(T.shoe.tc())}</b></div>` : ''}</div>
  <div class="side"><div class="panel"><h3>Your bet, in units</h3>${stepper('bet', true)}
    <div class="btns"><button class="b primary" data-a="betdeal">Deal</button></div></div></div>`;
}

/** Bet chips beside a hand's cards (one per unit bet). At the result a win adds payout chips that fly
 *  in from the dealer, a loss sends the bet to the dealer (only when the result is new), a push leaves it.
 *  .fly chips are animated by payouts() in main.js. */
function stackHTML(x, newRes) {
  // one chip per unit, capped so big bets stay a reasonable stack
  const chips = (from, n, cls = '') => Array.from({ length: Math.max(0, Math.min(n, 10 - from)) }, (_, j) => `<i class="mini${cls}" style="--i:${from + j}"></i>`).join('');
  const bet = x.bet * T.unit;
  let s = chips(0, bet);
  if (T.phase === 'result') {
    if (x.net < 0) s = newRes ? chips(0, bet, ' lose fly') : '';
    else if (x.net > 0) s += chips(Math.min(bet, 9), Math.max(1, Math.round(x.net)), newRes ? ' fly' : '');
  }
  return s ? `<span class="stack">${s}</span>` : '';
}

export function render() {
  const sh = T.shoe, st = T.st;
  const acc = st.dec ? Math.round((st.ok / st.dec) * 100) + '%' : '–';
  let h = `<div class="stats">${stat('hands', st.hands)}${stat('correct', acc, tone.pct(st.ok, st.dec))}${stat('units', sign(st.units), ` data-tween="units" data-v="${st.units}"${tone.sign(st.units)}`)}`;
  if (st.cq) h += stat('count checks', `${st.cok || 0}/${st.cq}`, tone.pct(st.cok || 0, st.cq));
  if (st.bdec) h += stat('bets', `${st.bok || 0}/${st.bdec}`, tone.pct(st.bok || 0, st.bdec));
  if (sh) h += stat('decks left', sh.decksLeft());
  if (sh && S.showCount) h += stat('running', sign(sh.rc)) + stat('true', fmt(sh.tc()));
  h += `</div>`;

  if (T.phase === 'idle') return h + welcome();
  if (T.phase === 'bet') return h + betHTML();

  const d = T.dealer, dv = T.hole ? [d[0].v] : d.map(c => c.v);
  const newRes = T.phase === 'result' && fresh(T.res);
  // An open hint replaces the stats strip, so it's on screen without pushing the chips far down.
  if (T.phase === 'hero' && T.hint) { const x = T.hero[T.hi]; h = hintHTML(vals(x), d[0].v, opts(x), S.showCount ? sh.tc() : null); }
  h += `<div class="felt">`;
  if (T.shuffled) h += `<p class="muted">New shoe shuffled. Count starts at 0.</p>`;
  h += `<div><div class="lbl">Dealer <b>${T.hole ? '' : totalTxt(dv)}</b>${T.phase === 'hero' ? hintBtn('hint', T.hint, !!T.miss) : ''}</div><div class="cards">${cardHTML(d[0])}${T.hole ? backHTML(d[1]) : d.slice(1).map(cardHTML).join('')}</div></div>`;
  if (T.others.length) {
    h += `<div class="seats sm">` + T.others.map((o, i) =>
      `<div class="seat"><div class="lbl">Player ${i + 1} <b>${totalTxt(vals(o))}</b></div><div class="cards">${o.c.map(cardHTML).join('')}</div></div>`).join('') + `</div>`;
  }
  h += `<div class="hands">` + T.hero.map((x, i) => {
    const active = T.phase === 'hero' && i === T.hi;
    let tag = '';
    if (T.phase === 'result') {
      const n = x.net;
      tag = ` <span class="tag ${n > 0 ? 'win' : n < 0 ? 'lose' : 'push'}${newRes ? ' pop' : ''}">${x.sur ? 'surrendered ' : ''}${x.bj && n > 0 ? 'blackjack ' : ''}${n > 0 ? '+' : ''}${n}</span>`;
    }
    return `<div class="hand${active ? ' act' : ''}"><div class="lbl">You${T.hero.length > 1 ? ' ' + (i + 1) : ''} <b>${totalTxt(vals(x))}</b>${x.bet > 1 ? ' <span class="tag">doubled</span>' : ''}${tag}</div><div class="cards">${x.c.map(cardHTML).join('')}${stackHTML(x, newRes)}</div></div>`;
  }).join('') + `</div></div>`;

  // Everything after the felt goes in .side: the right column on wide screens, invisible to layout on phones.
  h += `<div class="side">`;
  if (T.phase === 'insurance') {
    h += `<div class="panel"><h3>Insurance</h3><p>The dealer shows an ace. Take insurance?</p><div class="btns"><button class="b" data-a="ins:1">Take insurance</button><button class="b" data-a="ins:0">No insurance</button></div></div>`;
  } else if (T.phase === 'hero') {
    const x = T.hero[T.hi], o = opts(x);
    h += actionBtns('act', o, !o.aceSplit, T.miss);
    h += contLine(T.miss && ACT[T.miss.right]);
  } else if (T.phase === 'result') {
    const n = T.res.net;
    h += `<div class="fb info${newRes ? ' pop' : ''}">${T.res.dbj ? 'Dealer blackjack. ' : ''}Round ${n > 0 ? 'won' : n < 0 ? 'lost' : 'pushed'}: <b>${sign(n)}</b> unit${Math.abs(n) === 1 ? '' : 's'}${T.ins ? ' (incl. insurance)' : ''}.</div>`;
    if (T.ask) {
      if (!T.ask.done) {
        h += `<div class="panel"><h3>Count check</h3><p>What is the running count now?</p>${stepper('rc')}<div class="btns"><button class="b primary" data-a="asksub">Check</button><button class="b ghost" data-a="askskip">Skip</button></div></div>`;
      } else {
        const k = T.ask;
        k.title ??= k.ok ? `Count correct: ${sign(k.a)}` : `You said ${sign(k.u)}, the count is ${sign(k.a)}`;
        k.html ??= `True count <b>${fmt(T.shoe.tc())}</b> with ${T.shoe.decksLeft()} decks left.`;
        h += resultCard(k);
      }
    }
    h += `<div class="btns"><button class="b primary" data-a="deal" ${T.ask && !T.ask.done ? 'disabled' : ''}>Next hand</button></div>`;
  }
  // decision feedback (S.fbin) floats here, under the chips or the round's result, over what's below
  return h + fbSlot + `</div>`;
}
