// Pure blackjack logic: no DOM, no storage. Everything here is unit-tested.
// Card values: 2–10 as numbers, ace = 11. Rules object R:
//   { decks, h17, das, sur, ra, pen, bj }

export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const val = r => (r === 'A' ? 11 : r === '10' || r === 'J' || r === 'Q' || r === 'K' ? 10 : +r);
/** Hi-Lo tag for a card value. */
export const hl = v => (v <= 6 ? 1 : v >= 10 ? -1 : 0);
export const ACT = { H: 'Hit', S: 'Stand', D: 'Double', Ds: 'Double (else stand)', P: 'Split', R: 'Surrender' };
/** Insurance index: take insurance at TC >= this. */
export const INS_IDX = 3;

/** Bet ramps (units by floored true count: ≤+1, +2, +3, +4, +5 or more), keyed by the spread's top bet. */
export const RAMPS = { 4: [1, 2, 3, 4, 4], 8: [1, 2, 4, 6, 8], 12: [1, 2, 4, 8, 12] };
/** Units the ramp bets at true count tc (floored, as counters do) for a 1–spread spread. */
export function rampBet(tc, spread) {
  const i = Math.max(0, Math.min(4, Math.floor(tc) - 1));
  return RAMPS[spread][i];
}

/** Total, softness and pair-ness of a list of card values. */
export function info(c) {
  let t = 0, a = 0;
  for (const x of c) { t += x; if (x === 11) a++; }
  while (t > 21 && a) { t -= 10; a--; }
  return { t, soft: a > 0, pair: c.length === 2 && c[0] === c[1] };
}

/** Two-card hard hand that totals t, avoiding pairs where possible. */
export function handFor(t) {
  for (let a = 10; a >= 2; a--) { const b = t - a; if (b >= 2 && b <= 10 && a !== b) return [a, b]; }
  return [t];
}

/**
 * Basic strategy for multi-deck shoes, adjusted for H17, DAS and late surrender.
 * 1–2 decks only get the 11 v A double.
 * o: { canDouble, canSplit, canSurrender, raw } — raw keeps 'D'/'Ds' unresolved (for charts).
 */
export function basic(c, up, R, o) {
  o = o || { canDouble: true, canSplit: true, canSurrender: false };
  const { t, soft, pair } = info(c);
  const fix = a => (o.raw ? a : a === 'D' ? (o.canDouble ? 'D' : 'H') : a === 'Ds' ? (o.canDouble ? 'D' : 'S') : a);

  if (c.length === 2 && o.canSurrender && !soft && !(pair && c[0] === 8)) {
    if (t === 16 && up >= 9) return 'R';
    if (t === 15 && up === 10) return 'R';
    if (R.h17 && up === 11 && (t === 15 || t === 17)) return 'R';
  }
  if (pair && o.canSplit) {
    const p = c[0];
    if (p === 11 || p === 8) return 'P';
    if (p === 9) return [2, 3, 4, 5, 6, 8, 9].includes(up) ? 'P' : 'S';
    if (p === 7) return up <= 7 ? 'P' : 'H';
    if (p === 6) return up >= (R.das ? 2 : 3) && up <= 6 ? 'P' : 'H';
    if (p === 4) return R.das && (up === 5 || up === 6) ? 'P' : 'H';
    if (p === 3 || p === 2) return up >= (R.das ? 2 : 4) && up <= 7 ? 'P' : 'H';
    // 5,5 and 10,10 fall through to totals
  }
  let a;
  if (soft) {
    if (t <= 14) a = up === 5 || up === 6 ? 'D' : 'H';
    else if (t <= 16) a = up >= 4 && up <= 6 ? 'D' : 'H';
    else if (t === 17) a = up >= 3 && up <= 6 ? 'D' : 'H';
    else if (t === 18) a = up >= 3 && up <= 6 ? 'Ds' : up === 2 ? (R.h17 ? 'Ds' : 'S') : up <= 8 ? 'S' : 'H';
    else if (t === 19) a = R.h17 && up === 6 ? 'Ds' : 'S';
    else a = 'S';
    return fix(a);
  }
  if (t <= 8) a = 'H';
  else if (t === 9) a = up >= 3 && up <= 6 ? 'D' : 'H';
  else if (t === 10) a = up <= 9 ? 'D' : 'H';
  else if (t === 11) a = up <= 10 ? 'D' : R.h17 || R.decks <= 2 ? 'D' : 'H';
  else if (t === 12) a = up >= 4 && up <= 6 ? 'S' : 'H';
  else if (t <= 16) a = up <= 6 ? 'S' : 'H';
  else a = 'S';
  return fix(a);
}

/**
 * Illustrious 18 + Fab 4 (Hi-Lo). First matching entry wins.
 * k: 'h' hard total, 'p' pair of t. hi: play at TC >= i. lo: play at TC < i. sur: needs surrender.
 */
export const DEV = [
  { k: 'h', t: 16, u: 10, i: 0, hi: 'S' },
  { k: 'h', t: 15, u: 10, i: 4, hi: 'S' },
  { k: 'h', t: 15, u: 10, i: 0, hi: 'R', lo: 'H', sur: 1 },
  { k: 'p', t: 10, u: 5, i: 5, hi: 'P' },
  { k: 'p', t: 10, u: 6, i: 4, hi: 'P' },
  { k: 'h', t: 10, u: 10, i: 4, hi: 'D' },
  { k: 'h', t: 12, u: 3, i: 2, hi: 'S' },
  { k: 'h', t: 12, u: 2, i: 3, hi: 'S' },
  { k: 'h', t: 11, u: 11, i: 1, hi: 'D' },
  { k: 'h', t: 9, u: 2, i: 1, hi: 'D' },
  { k: 'h', t: 10, u: 11, i: 4, hi: 'D' },
  { k: 'h', t: 9, u: 7, i: 3, hi: 'D' },
  { k: 'h', t: 16, u: 9, i: 5, hi: 'S' },
  { k: 'h', t: 13, u: 2, i: -1, lo: 'H' },
  { k: 'h', t: 12, u: 4, i: 0, lo: 'H' },
  { k: 'h', t: 12, u: 5, i: -2, lo: 'H' },
  { k: 'h', t: 12, u: 6, i: -1, lo: 'H' },
  { k: 'h', t: 13, u: 3, i: -2, lo: 'H' },
  { k: 'h', t: 14, u: 10, i: 3, hi: 'R', sur: 1 },
  { k: 'h', t: 15, u: 9, i: 2, hi: 'R', sur: 1 },
  { k: 'h', t: 15, u: 11, i: 1, hi: 'R', sur: 1 },
];

/** Index entries that apply to this hand (regardless of count). */
export function devMatches(c, up, R, o) {
  const { t, soft, pair } = info(c);
  return DEV.filter(e => {
    if (e.u !== up) return false;
    if (e.sur && !o.canSurrender) return false;
    if (e.k === 'p') return pair && c[0] === e.t && o.canSplit;
    if (soft || t !== e.t) return false;
    if (basic(c, up, R, o) === 'P') return false;
    return true;
  });
}

/** Index play triggered at true count tc, or null. */
export function dev(c, up, tc, R, o) {
  for (const e of devMatches(c, up, R, o)) {
    let r = null;
    if (e.hi && tc >= e.i) r = e.hi;
    else if (e.lo && tc < e.i) r = e.lo;
    if (!r) continue;
    if (r === 'D' && !o.canDouble) continue;
    return { a: r, e };
  }
  return null;
}

/** Correct play: { a: action, b: basic-strategy action, e: index entry used or null }. */
export function best(c, up, tc, R, o, useDev) {
  const b = basic(c, up, R, o);
  if (useDev) { const d = dev(c, up, tc, R, o); if (d) return { a: d.a, b, e: d.e }; }
  return { a: b, b, e: null };
}

/** Shoe of card objects {r, s, v} with a Hi-Lo running count of seen cards. */
export class Shoe {
  constructor(R, rng = Math.random) {
    this.R = R;
    this.cards = [];
    for (let d = 0; d < R.decks; d++) for (const s of SUITS) for (const r of RANKS) this.cards.push({ r, s, v: val(r) });
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    this.pos = 0;
    this.rc = 0;
    this.cut = Math.floor(this.cards.length * R.pen);
  }
  draw() { return this.cards[this.pos++]; }
  see(c) { this.rc += hl(c.v); }
  /** Decks remaining, rounded to the nearest half deck (min 0.5). */
  decksLeft() { return Math.max(0.5, Math.round((this.cards.length - this.pos) / 26) / 2); }
  tc() { return this.rc / this.decksLeft(); }
  needShuffle() { return this.pos >= this.cut; }
}

/* ---------- Fast simulation (numbers only) ---------- */

export function simShoe(R, rng = Math.random) {
  const base = [];
  for (let d = 0; d < R.decks; d++) for (let s = 0; s < 4; s++) for (const r of RANKS) base.push(val(r));
  const S = {
    cards: base, pos: 0, cut: Math.floor(base.length * R.pen),
    shuf() {
      const a = this.cards;
      for (let i = a.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; }
      this.pos = 0;
    },
  };
  S.shuf();
  return S;
}

/** One round, flat 1-unit bet, basic strategy. Returns net units. */
export function simRound(S, R) {
  if (S.pos >= S.cut) S.shuf();
  const d = () => S.cards[S.pos++];
  const p1 = d(), u = d(), p2 = d(), hole = d();
  const dbj = u + hole === 21, pbj = p1 + p2 === 21;
  if (dbj) return pbj ? 0 : -1;
  if (pbj) return R.bj;
  const hands = [{ c: [p1, p2], bet: 1, fs: false, sa: false, sur: false }];
  for (let i = 0; i < hands.length; i++) {
    const h = hands[i];
    for (;;) {
      const t = info(h.c).t;
      if (t >= 21) break;
      const aa = h.c.length === 2 && h.c[0] === 11 && h.c[1] === 11;
      if (h.sa && !(aa && R.ra && hands.length < 4)) break;
      const o = {
        canDouble: h.c.length === 2 && !h.sa && (!h.fs || R.das),
        canSplit: h.c.length === 2 && h.c[0] === h.c[1] && hands.length < 4 && (h.c[0] !== 11 || !h.fs || R.ra),
        canSurrender: R.sur && !h.fs && h.c.length === 2 && hands.length === 1,
      };
      const a = basic(h.c, u, R, o);
      if (a === 'H') { h.c.push(d()); continue; }
      if (a === 'D') { h.c.push(d()); h.bet = 2; break; }
      if (a === 'R') { h.sur = true; break; }
      if (a === 'P') {
        const sa = h.c[0] === 11;
        hands.push({ c: [h.c[1], d()], bet: 1, fs: true, sa, sur: false });
        h.c = [h.c[0], d()]; h.fs = true; h.sa = sa;
        continue;
      }
      break;
    }
  }
  const live = hands.some(h => !h.sur && info(h.c).t <= 21);
  const dc = [u, hole];
  if (live) for (;;) { const i = info(dc); if (i.t < 17 || (i.t === 17 && i.soft && R.h17)) dc.push(d()); else break; }
  const dt = info(dc).t;
  let net = 0;
  for (const h of hands) {
    const t = info(h.c).t;
    if (h.sur) net -= 0.5;
    else if (t > 21) net -= h.bet;
    else if (dt > 21 || t > dt) net += h.bet;
    else if (t < dt) net -= h.bet;
  }
  return net;
}

/** House edge in percent (positive = casino advantage) over n simulated rounds. */
export function houseEdge(R, n, rng = Math.random) {
  const s = simShoe(R, rng);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += simRound(s, R);
  return (-sum / n) * 100;
}
