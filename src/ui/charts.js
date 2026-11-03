// Strategy tab: basic strategy tables for the current rules + index list.
// Tapping a cell selects it: its row and column stay lit (the rest dims) and a one-line reason for the
// play appears under that table, plus the spot's index rule and why the count changes it.
import { basic, DEV, INS_IDX, handFor, devMatches } from '../engine.js';
import { S, app } from '../state.js';
import { upName, idxText, idxRule, idxSpotWhy, ruleSummary, actPill } from './common.js';

const UPS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
let SEL = null; // { k: row key like 'h16' / 's7' / 'p8', u: upcard }

export const actions = {
  chcell: (k, u) => { SEL = SEL && SEL.k === k && SEL.u === +u ? null : { k, u: +u }; app.render(); },
};

/** Why a play is right, in one plain sentence. kind: 'h' hard, 's' soft, 'p' pair; t: total (pair: card). */
function why(kind, t, u, a) {
  const up = u === 11 ? 'an ace' : u === 8 ? 'an 8' : 'a ' + u, weak = u <= 6; // with its article: "a 6", "an 8"
  if (a === 'R') return `Surrender: this hand loses so often against ${up} that getting half your bet back is the better deal.`;
  if (a === 'P') {
    if (t === 11) return 'Split: always split aces. Each ace starts a new hand worth 11.';
    if (t === 8) return 'Split: always split 8s. 16 is the worst total, and two hands starting from 8 do much better.';
    return `Split: two hands starting from ${t} do better than one total of ${t * 2}${weak ? `, especially against a weak dealer card like ${up.split(' ')[1]}` : ''}.`;
  }
  if (kind === 'p') {
    if (t === 10) return 'Stand: 20 is already a winning hand, so don\'t break it up.';
    if (t === 9) return u === 7 ? 'Stand: 18 beats the 17 the dealer most likely ends on.' : 'Stand: 18 is the best you can do here; splitting 9s against a strong card makes two weaker hands.';
    if (t === 5) kind = 'h', t = 10; // a pair of 5s plays as hard 10
    else kind = 'h', t *= 2;
  }
  if (a === 'D' || a === 'Ds') {
    const s = kind === 's'
      ? `Double: the dealer's ${up.split(' ')[1]} is weak and a soft hand can't bust with one card, so get more money out.`
      : `Double: ${t} is a strong start and one card often makes 19–21${weak ? `, while a dealer showing ${up} is likely to bust` : ''}.`;
    return a === 'Ds' ? s + ' If you can\'t double, stand.' : s;
  }
  if (a === 'S') {
    if (kind === 's') return t >= 19 ? `Stand: soft ${t} is already a strong hand.` : `Stand: 18 is good enough against ${up}.`;
    if (t >= 17) return 'Stand: hitting 17 or more busts too often.';
    return `Stand: a dealer showing ${up} busts often, so don't risk busting yourself.`;
  }
  // Hit
  if (kind === 's') return 'Hit: a soft hand can\'t bust with one card, and this total isn\'t strong enough yet.';
  if (t >= 9 && t <= 11) return weak
    ? `Hit: doubling ${t} against ${up} doesn't win often enough to pay off. You can't bust with one card.`
    : `Hit: ${t} is a good start, but a dealer showing ${up} is too strong to double against. You can't bust with one card.`;
  if (t <= 11) return 'Hit: you can\'t bust with one card.';
  if (t === 12 && (u === 2 || u === 3)) return `Hit: 12 busts only on a 10-value card, and ${up} isn't weak enough to stand on it.`;
  return `Hit: a dealer showing ${up} usually ends on 17 or more, so standing on ${t} loses more often than hitting.`;
}

/** why() without its leading "Hit: " (shown next to a pill that already names the play), capitalized.
 *  Also used by the drill's Weakest spots. */
export function reason(kind, t, u, a) {
  const r = why(kind, t, u, a).replace(/^[^:]+: /, '');
  return r[0].toUpperCase() + r.slice(1);
}

export function render() {
  const o = { canDouble: true, canSplit: true, canSurrender: S.sur, raw: true };
  const head = '<tr><th></th>' + UPS.map(u => `<th${SEL && SEL.u === u ? ' class="on"' : ''}>${upName(u)}</th>`).join('') + '</tr>';
  const acts = c => UPS.map(u => basic(c, u, S, o));
  const row = (k, lab, c) => {
    const a = acts(c), r = SEL && SEL.k === k;
    return `<tr><th${r ? ' class="on"' : ''}>${lab}</th>` + UPS.map((u, i) => {
      const x = r || (SEL && SEL.u === u), on = r && SEL.u === u;
      return `<td class="c${a[i][0]}${x ? ' x' : ''}${on ? ' on' : ''}" data-a="chcell:${k}:${u}">${a[i]}</td>`;
    }).join('') + '</tr>';
  };
  const ROWS = { h: [], s: [], p: [] }; // [key, label, cards, total]
  for (let t = 8; t <= 16; t++) ROWS.h.push(['h' + t, t === 8 ? '≤8' : t, handFor(t), t]);
  // 18+ always stands; 17 only differs with H17 + surrender (surrender 17 v A).
  if (acts(handFor(17)).join() === acts(handFor(18)).join()) ROWS.h.push(['h17', '17+', handFor(17), 17]);
  else ROWS.h.push(['h17', 17, handFor(17), 17], ['h18', '18+', handFor(18), 18]);
  for (let k = 2; k <= 9; k++) ROWS.s.push(['s' + k, 'A,' + k, [11, k], 11 + k]);
  for (const p of [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) ROWS.p.push(['p' + p, p === 11 ? 'A,A' : p === 10 ? 'T,T' : p + ',' + p, [p, p], p]);

  const tbl = (kind, title) => {
    let body = ROWS[kind].map(([k, lab, c]) => row(k, lab, c)).join('');
    let note = '';
    const sel = SEL && ROWS[kind].find(r => r[0] === SEL.k);
    if (sel) {
      const [, lab, c, t] = sel, a = basic(c, SEL.u, S, o);
      const m = devMatches(c, SEL.u, S, { canDouble: true, canSplit: true, canSurrender: S.sur }); // labelled, so always shown
      note = `<p class="why"><b>${lab} vs ${upName(SEL.u)}</b> ${actPill(a)} ${reason(kind, t, SEL.u, a)}</p>` +
        (m.length ? `<p class="why muted">With the count: ${idxRule(m)}. ${idxSpotWhy(m)}</p>` : '');
    }
    return `<div class="panel"><h3>${title}</h3><div class="tw"><table class="ch${sel ? ' pick' : ''}">${head}${body}</table></div>${note}</div>`;
  };

  let h = `<div class="panel"><h2>Basic strategy for your rules</h2><p class="muted">${ruleSummary()}. Columns are the dealer upcard. Tap a cell to see why.</p>
  <div class="legend"><span style="--c:var(--cH)">H Hit</span><span style="--c:var(--cS)">S Stand</span><span style="--c:var(--cD)">D Double, else hit</span><span style="--c:var(--cD)">Ds Double, else stand</span><span style="--c:var(--cP)">P Split</span>${S.sur ? '<span style="--c:var(--cR)">R Surrender, else hit (17 v A: stand)</span>' : ''}</div></div>`;
  h += tbl('h', 'Hard totals') + tbl('s', 'Soft totals') + tbl('p', 'Pairs');
  h += `<div class="panel"><h3>Index plays (Hi-Lo true count)</h3><table class="list"><tr><th>Hand</th><th>vs</th><th>Play</th></tr>
    <tr><td>Insurance</td><td>A</td><td>Take at TC ≥ +${INS_IDX}</td></tr>` +
    DEV.filter(e => !e.sur || S.sur).map(e =>
      `<tr><td>${e.k === 'p' ? 'T,T' : e.t}</td><td>${upName(e.u)}</td><td>${e.hi ? idxText({ hi: e.hi, i: e.i }) : ''}${e.hi && e.lo ? '; ' : ''}${e.lo ? idxText({ lo: e.lo, i: e.i }) : ''}</td></tr>`).join('') +
    `</table><p class="muted">Illustrious 18 plus the Fab 4 surrenders${S.sur ? '' : ' (hidden: surrender is off)'}. Without the index, play the basic strategy above.</p></div>`;
  return h;
}
