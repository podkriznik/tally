// Shared app state: settings, per-situation stats, localStorage wrapper.
import { info } from './engine.js';

export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};

export const DEFAULTS = { decks: 6, h17: false, das: true, sur: true, ra: false, pen: 0.75, bj: 1.5, others: 2, ask: 5, dev: true, showCount: false, bets: false, spread: 8, pace: 1, drmode: 0, fbin: 1 };

/** What "I'm new" on the welcome screen switches to: basic strategy only, the count shown, a quiet table. */
export const BEGINNER = { dev: false, showCount: true, bets: false, others: 1, pace: 1.6 };

/** Current settings (rules + training options). Mutate in place, then saveSettings(). */
export const S = Object.assign({}, DEFAULTS, store.get('tally_settings', {}));
export const saveSettings = () => store.set('tally_settings', S);

/** app.render is set by main.js; modules call it after changing state. */
export const app = { tab: store.get('tally_tab', 'table'), render: () => {} };

/** Values of the +/- stepper inputs, keyed by stepper id. */
export const STP = {};

/** Per-situation accuracy: { key: { n: attempts, m: mistakes } } */
export const ST = store.get('tally_stats', {});

export function keyFor(c, up, o, idx) {
  const i = info(c);
  const k = i.pair && o.canSplit ? 'P' + c[0] : (i.soft ? 'S' : 'H') + i.t;
  return `${k}${c.length > 2 ? '*' : ''}|${up}${idx ? '|i' : ''}`;
}
export function record(key, ok) {
  const s = ST[key] || (ST[key] = { n: 0, m: 0 });
  s.n++;
  if (!ok) s.m++;
  store.set('tally_stats', ST);
}
export function resetStats() {
  for (const k of Object.keys(ST)) delete ST[k];
  store.set('tally_stats', ST);
}

/** Daily practice log for the Progress page: { 'YYYY-MM-DD': { dec, ok, cq, cok, cps } } (local dates).
 *  dec/ok: scored decisions (drill + table, hinted ones excluded); cq/cok: table count checks;
 *  cps: best correct count-drill speed that day (cards/s). Keeps the last 365 days. */
export const DAYS = store.get('tally_days', {});
export const dayKey = (d = new Date()) => d.toLocaleDateString('sv'); // 'sv' formats as YYYY-MM-DD
export function logDay(add) {
  const d = DAYS[dayKey()] || (DAYS[dayKey()] = {});
  for (const [f, v] of Object.entries(add)) d[f] = f === 'cps' ? Math.max(d[f] || 0, v) : (d[f] || 0) + v;
  const keys = Object.keys(DAYS).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 365))) delete DAYS[k];
  store.set('tally_days', DAYS);
}
