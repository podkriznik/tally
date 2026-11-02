// House edge section of the Settings page: Monte Carlo simulation in chunks so the UI stays responsive.
import { simShoe, simRound } from '../engine.js';
import { S, app } from '../state.js';
import { ruleSummary } from './common.js';

const ED = { running: false, n: 0, sum: 0, sq: 0, target: 1e6, rules: null, shoe: null };
const CHUNK = 40000;

function start() {
  ED.running = true; ED.n = 0; ED.sum = 0; ED.sq = 0;
  ED.rules = { ...S };
  ED.shoe = simShoe(S);
  chunk();
  app.render();
}

function chunk() {
  if (!ED.running) return;
  const end = Math.min(ED.target, ED.n + CHUNK);
  for (; ED.n < end; ED.n++) { const x = simRound(ED.shoe, ED.rules); ED.sum += x; ED.sq += x * x; }
  if (ED.n >= ED.target) ED.running = false; else setTimeout(chunk, 0);
  if (app.tab === 'settings') app.render();
}

export const actions = {
  edopt: (k, v) => { ED[k] = +v; app.render(); },
  edstart: start,
  edstop: () => { ED.running = false; app.render(); },
};

export function render() {
  let h = `<div class="panel"><h2>House edge</h2><p class="muted">The house edge is how much of each bet the casino keeps on average: at 0.5%, you lose about 50 cents per $100 bet over time. Counting is how you turn it in your favor. This simulates hands with flat bets and perfect basic strategy for your current rules: ${ruleSummary()}.</p>
  <div class="field">Hands to simulate<div class="seg">${[[2e5, '200k'], [1e6, '1M'], [3e6, '3M'], [1e7, '10M']].map(([v, t]) => `<button data-a="edopt:target:${v}" class="${ED.target == v ? 'on' : ''}">${t}</button>`).join('')}</div></div>
  <div class="btns">${ED.running ? '<button class="b" data-a="edstop">Stop</button>' : '<button class="b primary" data-a="edstart">Run simulation</button>'}</div>`;
  if (ED.n) {
    const m = ED.sum / ED.n, sd = Math.sqrt(ED.sq / ED.n - m * m), se = sd / Math.sqrt(ED.n);
    h += `<div class="bar"><i style="width:${((ED.n / ED.target) * 100).toFixed(1)}%"></i></div>
    <div><div class="bigNum">${(-m * 100).toFixed(2)}%</div><p class="muted">House edge ± ${(1.96 * se * 100).toFixed(2)}% (95%) after ${ED.n.toLocaleString('en')} hands. Std. dev. per hand ${sd.toFixed(2)} units.</p></div>`;
  }
  return h + `</div><div class="panel"><p class="muted">Rough guide to rule effects: H17 costs about 0.2%, 6:5 blackjack about 1.4%, no DAS about 0.14%, late surrender gains about 0.08%. Change the rules above and run again to compare.</p></div>`;
}
