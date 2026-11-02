import { describe, it, expect } from 'vitest';
import { basic, dev, best, info, handFor, houseEdge, Shoe, hl, val, RANKS, rampBet } from '../src/engine.js';

const R6 = { decks: 6, h17: false, das: true, sur: true, ra: false, pen: 0.75, bj: 1.5 };
const ALL = { canDouble: true, canSplit: true, canSurrender: true };
const UPS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Full chart as text rows, e.g. "H12: HHSSSHHHHH". */
function chart(R) {
  const o = { canDouble: true, canSplit: true, canSurrender: R.sur, raw: true };
  const rows = [];
  for (let t = 5; t <= 17; t++) rows.push(`H${t}: ` + UPS.map(u => basic(handFor(t), u, R, o).padEnd(2)).join(' '));
  for (let k = 2; k <= 9; k++) rows.push(`A${k}: ` + UPS.map(u => basic([11, k], u, R, o).padEnd(2)).join(' '));
  for (const p of [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) rows.push(`P${p}: ` + UPS.map(u => basic([p, p], u, R, o).padEnd(2)).join(' '));
  return rows.join('\n');
}

describe('hand evaluation', () => {
  it('handles soft totals and multiple aces', () => {
    expect(info([11, 6])).toEqual({ t: 17, soft: true, pair: false });
    expect(info([11, 11, 9])).toEqual({ t: 21, soft: true, pair: false });
    expect(info([11, 6, 10])).toEqual({ t: 17, soft: false, pair: false });
    expect(info([8, 8]).pair).toBe(true);
  });
  it('Hi-Lo tags sum to 0 over a deck', () => {
    expect(RANKS.map(val).map(hl).reduce((a, b) => a + b) * 4).toBe(0);
  });
});

describe('bet ramp', () => {
  it('floors the true count and caps at the top bet', () => {
    expect([-3, 0, 1.9, 2, 2.9, 3, 4, 5, 9].map(tc => rampBet(tc, 8))).toEqual([1, 1, 1, 2, 2, 4, 6, 8, 8]);
    expect(rampBet(-0.5, 8)).toBe(1); // floor(-0.5) = -1
    expect(rampBet(4.2, 4)).toBe(4);
    expect(rampBet(5, 12)).toBe(12);
  });
});

describe('basic strategy', () => {
  it('matches the pinned charts (update snapshot only on purpose)', () => {
    expect(chart(R6)).toMatchSnapshot('6D S17 DAS LS');
    expect(chart({ ...R6, h17: true })).toMatchSnapshot('6D H17 DAS LS');
    expect(chart({ ...R6, das: false, sur: false })).toMatchSnapshot('6D S17 noDAS noLS');
  });
  it('key rule-dependent plays', () => {
    expect(basic([6, 5], 11, R6, ALL)).toBe('H');
    expect(basic([6, 5], 11, { ...R6, h17: true }, ALL)).toBe('D');
    expect(basic([6, 5], 11, { ...R6, decks: 2 }, ALL)).toBe('D');
    expect(basic([11, 7], 2, R6, ALL)).toBe('S');
    expect(basic([11, 7], 2, { ...R6, h17: true }, ALL)).toBe('D');
    expect(basic([10, 6], 10, R6, ALL)).toBe('R');
    expect(basic([8, 8], 10, R6, ALL)).toBe('P');
    expect(basic([10, 7], 11, { ...R6, h17: true }, ALL)).toBe('R');
  });
  it('falls back when an action is unavailable', () => {
    const noDbl = { canDouble: false, canSplit: false, canSurrender: false };
    expect(basic([6, 5], 6, R6, noDbl)).toBe('H');
    expect(basic([11, 7], 4, R6, noDbl)).toBe('S');
    expect(basic([10, 6], 10, R6, noDbl)).toBe('H');
  });
});

describe('index plays', () => {
  it('16 v 10: surrender at negative count, stand at TC >= 0 without surrender', () => {
    expect(best([10, 6], 10, -1, R6, ALL, true).a).toBe('R');
    expect(best([10, 6], 10, 0, R6, { ...ALL, canSurrender: false }, true).a).toBe('S');
  });
  it('15 v 10 thresholds', () => {
    expect(dev([10, 5], 10, -1, R6, ALL).a).toBe('H');
    expect(dev([10, 5], 10, 2, R6, ALL).a).toBe('R');
    expect(dev([10, 5], 10, 5, R6, ALL).a).toBe('S');
  });
  it('12 v 4 hits below 0', () => {
    expect(dev([10, 2], 4, -1, R6, ALL).a).toBe('H');
    expect(dev([10, 2], 4, 0, R6, ALL)).toBeNull();
  });
  it('splits tens v 5 at +5', () => {
    expect(best([10, 10], 5, 5, R6, ALL, true).a).toBe('P');
    expect(best([10, 10], 5, 4, R6, ALL, true).a).toBe('S');
  });
  it('ignores indexes when deviations are off', () => {
    expect(best([10, 2], 3, 5, R6, ALL, false).a).toBe('H');
  });
});

describe('shoe', () => {
  it('has the right size, cut card and count', () => {
    const s = new Shoe(R6);
    expect(s.cards.length).toBe(312);
    expect(s.cut).toBe(234);
    let rc = 0;
    while (s.pos < s.cards.length) { const c = s.draw(); s.see(c); rc += hl(c.v); }
    expect(s.rc).toBe(0);
    expect(rc).toBe(0);
  });
});

describe('house edge simulation', () => {
  // Published: 6D S17 DAS LS ≈ 0.36%. 2M hands → 95% CI ≈ ±0.16%.
  it('6D S17 DAS LS 3:2 is close to 0.36%', () => {
    const e = houseEdge(R6, 2e6);
    expect(e).toBeGreaterThan(0.36 - 0.25);
    expect(e).toBeLessThan(0.36 + 0.25);
  });
});
