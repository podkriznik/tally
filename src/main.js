// App shell: tab bar, rendering, and one delegated event handler per event type.
// Buttons declare their action as data-a="name:arg1:arg2" → A[name](arg1, arg2).
import './style.css';
import { S, app, store, saveSettings, STP, BEGINNER } from './state.js';
import { $, ruleSummary, hideToast, stpTxt, toast, placeFeedback } from './ui/common.js';
import * as table from './ui/table.js';
import * as drill from './ui/drill.js';
import * as count from './ui/count.js';
import * as charts from './ui/charts.js';
import * as edge from './ui/edge.js';
import * as settings from './ui/settings.js';
import * as guide from './ui/guide.js';
import * as progress from './ui/progress.js';

const TABS = [
  ['table', 'Table', table.render],
  ['drill', 'Drill', drill.render],
  ['count', 'Count', count.render],
  ['charts', 'Strategy', charts.render],
];
// Pages that aren't tabs: no tab is highlighted, and closing them returns to the last tab.
const PAGES = { settings: settings.render, guide: guide.render, progress: progress.render };
// The gear button opens the 'settings' view (not a tab) and closes it back to the tab you came from.
const GEAR = '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>';
const CLOSE = '<path d="M6 6l12 12M18 6L6 18"/>';
let lastTab = 'table';
let bump = null; // data-a of the chip just tapped

// Layout animation (FLIP) for the view's top-level blocks: re-renders replace every element, so blocks
// are matched across renders by class name (+ position among same-class siblings). A block that moved
// glides from its old spot; a new block fades in unless it animates on its own (.pop). Skipped on tab
// changes (the view fades instead) and with reduced motion.
const calm = matchMedia('(prefers-reduced-motion: reduce)');
let shownTab = null;
function blocks() {
  const seen = {}, m = new Map();
  // .side (the right column on wide screens) is a wrapper: track its children, not the wrapper
  for (const el of $('view').querySelectorAll(':scope > :not(.side), :scope > .side > *')) {
    // state classes don't change a block's identity (.chips.mark after a mistake is still the chips)
    const cls = el.className.replace(/\b(pop|enter|mark)\b/g, '').replace(/\s+/g, ' ').trim(), n = (seen[cls] = (seen[cls] || 0) + 1);
    m.set(`${el.tagName}.${cls}#${n}`, el);
  }
  return m;
}
function flip(before) {
  for (const [k, el] of blocks()) {
    const top = before.get(k);
    if (top === undefined) {
      if (!el.classList.contains('pop')) el.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
      continue;
    }
    const dy = top - el.getBoundingClientRect().top;
    if (Math.abs(dy) > 1) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.3,1)' });
  }
}

// Tab bar: built once; each render only moves the 'on' class and the sliding pill (.ind) under the
// selected tab, so the pill glides from tab to tab. On Settings / the guide no tab is selected: pill hidden.
// Tab icons, shown above the labels on phones only (style.css): cards, target, tally mark, chart grid.
const TAB_ICON = {
  table: '<rect x="3" y="6" width="11" height="15" rx="2"/><path d="M8 3.5l9.2 2.4a2 2 0 0 1 1.4 2.5l-3 11"/>',
  drill: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  count: '<path d="M6 5v14M10 5v14M14 5v14M18 5v14M3.5 15.5l17-7"/>',
  charts: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
};
let pillTab = null; // the tab the pill was last placed under (go() moves it before app.tab changes)
function tabBar(tab = app.tab) {
  pillTab = tab;
  const nav = $('tabs');
  if (!nav.firstChild) {
    nav.innerHTML = '<span class="ind" aria-hidden="true"></span>' + TABS.map(([k, t]) =>
      `<button data-a="tab:${k}"><svg class="ti" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TAB_ICON[k]}</svg><span>${t}</span></button>`).join('');
    nav.dataset.ready = '';
  }
  let on = null;
  for (const b of nav.querySelectorAll('button')) { const sel = b.dataset.a === 'tab:' + tab; b.classList.toggle('on', sel); if (sel) on = b; }
  const ind = nav.querySelector('.ind');
  ind.classList.toggle('off', !on);
  if (on) { ind.style.width = on.offsetWidth + 'px'; ind.style.transform = `translateX(${on.offsetLeft}px)`; }
  if (nav.dataset.ready === '') requestAnimationFrame(() => { nav.dataset.ready = '1'; }); // no slide on the very first placement
}
// re-place the pill whenever the tab bar changes size (window resize, layout change, font load)
new ResizeObserver(() => { if (pillTab) tabBar(pillTab); }).observe($('tabs'));

// Segmented pickers (.seg: count-drill options, theme) are rebuilt on every render, so their highlight
// can't use a CSS transition. Instead: remember where each picker's highlight was (keyed by its action,
// e.g. 'cdopt:speed'), then after the render add a .ind pill under the selected option and slide it there
// from the remembered spot.
const segKey = s => s.querySelector('button')?.dataset.a.replace(/:[^:]*$/, '');
function segSpots() {
  const m = new Map();
  for (const s of $('view').querySelectorAll('.seg')) { const on = s.querySelector('.on'); if (on) m.set(segKey(s), [on.offsetLeft, on.offsetWidth]); }
  return m;
}
function segPills(before) {
  for (const s of $('view').querySelectorAll('.seg')) {
    const on = s.querySelector('.on');
    if (!on) continue;
    const ind = document.createElement('span');
    ind.className = 'ind';
    ind.style.cssText = `width:${on.offsetWidth}px;transform:translateX(${on.offsetLeft}px)`;
    s.prepend(ind);
    const was = before.get(segKey(s));
    if (was && was[0] !== on.offsetLeft && !calm.matches) {
      ind.animate([{ width: was[1] + 'px', transform: `translateX(${was[0]}px)` }, { width: on.offsetWidth + 'px', transform: `translateX(${on.offsetLeft}px)` }],
        { duration: 300, easing: 'cubic-bezier(.3,.8,.3,1)' });
    }
  }
}

function render() {
  const set = app.tab === 'settings';
  const animate = shownTab === app.tab && !calm.matches;
  const before = new Map(), segs = segSpots();
  if (animate) for (const [k, el] of blocks()) before.set(k, el.getBoundingClientRect().top);
  if (!PAGES[app.tab] && !TABS.some(t => t[0] === app.tab)) app.tab = 'table';
  document.body.dataset.tab = app.tab; // per-tab layout (style.css); set before tabBar() measures the buttons
  tabBar();
  const g = $('gear');
  g.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${set ? CLOSE : GEAR}</svg>`;
  g.title = g.ariaLabel = set ? 'Close settings' : 'Settings';
  g.classList.toggle('on', set);
  $('prog').classList.toggle('on', app.tab === 'progress');
  $('rulesum').textContent = ruleSummary();
  $('view').innerHTML = PAGES[app.tab] ? PAGES[app.tab]() : TABS.find(t => t[0] === app.tab)[2]();
  placeFeedback(); // a pending mistake goes under the chips (common.js)
  // The tapped chip was just replaced by the re-render: play the press bounce on its replacement.
  if (bump) {
    $('view').querySelector(`.chip[data-a="${bump}"]`)?.classList.add('bump');
    bump = null;
  }
  segPills(shownTab === app.tab ? segs : new Map());
  const landed = dealCards();
  payouts(landed);
  tween(landed + 250);
  if (animate) flip(before);
  shownTab = app.tab;
}

// Dealing pace: cards leave the shoe one after another (in shoe order, data-n) and fly from the shoe,
// the felt's top-right corner, to their spot. Result tags and the round result wait for the last card.
// The Deal speed setting (S.pace: 1.6 slow, 1 normal, 0.45 fast) scales all of it, payouts included.
const DEAL_STEP = 170, DEAL_FLY = 450;
function dealCards() {
  const v = $('view'), step = DEAL_STEP * S.pace, fly = DEAL_FLY * S.pace;
  const cards = [...v.querySelectorAll('.pc.deal, .pc.flip')].sort((a, b) => (+a.dataset.n || 0) - (+b.dataset.n || 0));
  if (!cards.length) return 0;
  let t = 0;
  for (const c of cards) {
    const felt = c.closest('.felt');
    if (felt && c.classList.contains('deal')) {
      const f = felt.getBoundingClientRect(), r = c.getBoundingClientRect();
      c.style.setProperty('--fx', `${f.right - r.width - 14 - r.left}px`);
      c.style.setProperty('--fy', `${f.top + 10 - r.top}px`);
    }
    c.style.animationDelay = `${t}ms`;
    c.style.animationDuration = `${c.classList.contains('flip') ? fly * 0.93 : fly}ms`;
    t += step;
  }
  const landed = t - step + fly;
  for (const e of v.querySelectorAll('.tag.pop, .fb.info.pop')) e.style.animationDelay = `${landed}ms`;
  return landed;
}

// Settling bets: payout chips (.mini.fly) fly from the dealer's rack (top center of the felt) onto the
// hand's stack; lost chips (.mini.lose.fly) fly from the stack to the rack and vanish.
function payouts(start) {
  for (const el of $('view').querySelectorAll('.mini.fly')) {
    const lose = el.classList.contains('lose');
    if (calm.matches) { if (lose) el.remove(); continue; }
    const f = el.closest('.felt').getBoundingClientRect(), r = el.getBoundingClientRect();
    const rack = { transform: `translate(${f.left + f.width / 2 - r.left}px,${f.top + 6 - r.top}px) scale(.85)`, opacity: 0 };
    const at = { transform: 'none', opacity: 1 };
    el.animate(lose ? [at, { opacity: 1, offset: .75 }, rack] : [rack, { opacity: 1, offset: .2 }, at], {
      duration: 560 * S.pace, delay: start + +el.style.getPropertyValue('--i') * 90 * S.pace,
      easing: 'cubic-bezier(.3,.7,.3,1)', fill: lose ? 'forwards' : 'backwards',
    });
  }
}

// Numbers marked data-tween="key" data-v="value" (table units) count from the last shown value to the new one.
const shown = {};
const half = v => { const r = Math.round(v * 2) / 2; return (r >= 0 ? '+' : '') + r; };
function tween(delay) {
  for (const el of $('view').querySelectorAll('[data-tween]')) {
    const k = el.dataset.tween, to = +el.dataset.v, from = shown[k];
    shown[k] = to;
    if (from === undefined || from === to || calm.matches) continue;
    el.textContent = half(from);
    const t0 = performance.now() + delay;
    const step = now => {
      if (!el.isConnected) return;
      const p = Math.min(1, Math.max(0, (now - t0) / 600));
      el.textContent = half(from + (to - from) * (1 - (1 - p) ** 3));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // land on the exact value even if animation frames are throttled (background tab)
    setTimeout(() => { if (el.isConnected) el.textContent = half(to); }, delay + 650);
  }
}
app.render = render;

/** Switch view: fade-through. The current page fades out (sliding a little after a swipe; dir -1 / 1),
 *  is swapped while invisible, so the rebuild and the scroll jump never show, then the new page fades in.
 *  It animates the real page, so the whole screen moves together (also the part under Safari's toolbar),
 *  and the two pages are never on screen at once. The tab pill slides to the new tab right away.
 *  A newer go() during the fade-out wins. Reduced motion: an instant switch. */
const scrolls = {}; // each tab's scroll position, restored when you come back to it
const OUT = 110, IN = 200;
let goId = 0;
function go(k, dir = 0) {
  const v = $('view'), id = ++goId;
  const swap = () => {
    if (app.tab === 'count' && k !== 'count') count.leave();
    scrolls[app.tab] = scrollY;
    app.tab = k;
    if (!PAGES[k]) { lastTab = k; store.set('tally_tab', k); }
    render();
    scrollTo(0, PAGES[k] ? 0 : scrolls[k] || 0);
  };
  if (calm.matches) { swap(); return; }
  tabBar(k);
  const dx = dir * 18;
  for (const a of v.getAnimations()) if (a.id === 'page') a.cancel();
  const out = v.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-dx}px)` }],
    { id: 'page', duration: OUT, easing: 'ease-in', fill: 'forwards' });
  // a timer, not out.finished: the swap must happen even if animation frames are throttled
  setTimeout(() => {
    if (id !== goId) return;
    swap();
    const inn = v.animate([{ opacity: 0, transform: `translateX(${dx}px)` }, { opacity: 1, transform: 'none' }],
      { id: 'page', duration: IN, easing: 'cubic-bezier(.2,.8,.3,1)' });
    out.cancel(); // the fade-in now holds the view; drop the fade-out's held end state
    setTimeout(() => inn.finish(), IN + 150); // never leave the page invisible if animation frames stall
  }, OUT);
}

// Phones: swipe left / right on the page to go to the next / previous tab. Kept deliberate so scrolling
// doesn't trigger it: the swipe must be long (30% of the screen), quick (< 0.5 s) and flat (3× more
// sideways than vertical), and if the finger's first movement is mostly vertical it's a scroll for the
// rest of the gesture. Ignored when it starts on buttons/chips or on things that move sideways themselves.
let swipe = null;
document.addEventListener('touchstart', e => {
  const t = e.touches[0];
  swipe = e.touches.length === 1 && !e.target.closest('.tw, .stepper, .seg, input, select, header, button')
    ? { x: t.clientX, y: t.clientY, t: performance.now(), dir: null } : null;
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (!swipe || swipe.dir) return;
  const t = e.touches[0], dx = Math.abs(t.clientX - swipe.x), dy = Math.abs(t.clientY - swipe.y);
  if (dx + dy < 12) return; // decide once the finger has moved a little
  swipe.dir = dy > dx ? 'v' : 'h';
  if (swipe.dir === 'v') swipe = null; // started as a scroll: never a tab swipe
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!swipe) return;
  const t = e.changedTouches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y, quick = performance.now() - swipe.t < 500;
  swipe = null;
  const i = TABS.findIndex(x => x[0] === app.tab);
  if (!quick || i < 0 || Math.abs(dx) < Math.max(100, innerWidth * 0.3) || Math.abs(dx) < Math.abs(dy) * 3) return;
  const j = i + (dx < 0 ? 1 : -1);
  if (j < 0 || j >= TABS.length) return;
  hideToast();
  go(TABS[j][0], dx < 0 ? 1 : -1);
}, { passive: true });

// Tooltips: any element with data-tip shows it in one shared bubble above it, on hover and on keyboard
// focus (Progress chart columns). Text goes in with textContent; a line break in data-tip starts line 2.
const tip = document.createElement('div');
tip.id = 'tip';
tip.setAttribute('role', 'tooltip');
tip.hidden = true;
document.body.append(tip);
function showTip(el) {
  tip.textContent = el.dataset.tip;
  tip.hidden = false;
  const r = el.getBoundingClientRect(), w = tip.offsetWidth;
  tip.style.left = `${Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2))}px`;
  tip.style.top = `${r.top - tip.offsetHeight - 8}px`;
}
const tipFor = e => e.target.closest?.('[data-tip]');
document.addEventListener('pointerover', e => { const t = tipFor(e); if (t) showTip(t); else tip.hidden = true; });
document.addEventListener('focusin', e => { const t = tipFor(e); if (t) showTip(t); });
document.addEventListener('focusout', () => { tip.hidden = true; });
addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });

// Steppers (count entry): update STP and the readout only, no full re-render.
function setStp(id, v) {
  const o = $('o_' + id), units = o?.closest('.stepper').hasAttribute('data-u'); // bets: plain number, at least 1
  STP[id] = units ? Math.max(1, v) : v;
  if (o) { o.textContent = units ? STP[id] : stpTxt(STP[id]); o.classList.remove('tick'); void o.offsetWidth; o.classList.add('tick'); }
}
// Drag a stepper's readout sideways: one step per 18px.
document.addEventListener('pointerdown', e => {
  const o = e.target.closest?.('.stepper output');
  if (!o) return;
  const id = o.closest('.stepper').dataset.stp, x0 = e.clientX, v0 = STP[id] || 0;
  o.setPointerCapture(e.pointerId);
  o.focus();
  const move = ev => { const v = v0 + Math.round((ev.clientX - x0) / 18); if (v !== STP[id]) setStp(id, v); };
  const up = () => { o.removeEventListener('pointermove', move); o.removeEventListener('pointerup', up); o.removeEventListener('pointercancel', up); };
  o.addEventListener('pointermove', move);
  o.addEventListener('pointerup', up);
  o.addEventListener('pointercancel', up);
});

const A = {
  tab: go,
  toastx: hideToast,
  settings: () => go(app.tab === 'settings' ? lastTab : 'settings'),
  guide: () => go('guide'),
  progress: () => go(app.tab === 'progress' ? lastTab : 'progress'),
  back: () => go(lastTab),
  stp: (id, d) => setStp(id, (STP[id] || 0) + +d),
  ...table.actions,
  ...drill.actions,
  ...count.actions,
  ...edge.actions,
  ...settings.actions,
  ...charts.actions,
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if (!b || b.disabled || b.ariaDisabled === 'true') return;
  // data-confirm (destructive buttons): the first tap arms the button and shows the confirm text for 3 s;
  // only a second tap while armed runs the action.
  if (b.dataset.confirm && !b.classList.contains('armed')) {
    const label = b.textContent;
    b.classList.add('armed');
    b.textContent = b.dataset.confirm;
    setTimeout(() => { if (b.isConnected) { b.classList.remove('armed'); b.textContent = label; } }, 3000);
    return;
  }
  if (b.classList.contains('chip')) bump = b.dataset.a;
  const [name, ...args] = b.dataset.a.split(':');
  // Any action (except the count steppers) dismisses the feedback toast; actions that produce feedback show a new one.
  if (name !== 'stp') hideToast();
  A[name]?.(...args);
});

/** Change a setting (rules / training). Pickers re-render at once; switches wait 0.2 s so the knob's
 *  slide plays before the re-render replaces the element. */
function setOption(k, v, later = false) {
  S[k] = v;
  saveSettings();
  if (['decks', 'pen'].includes(k)) table.resetShoe();
  if (['sur', 'das', 'h17', 'decks', 'drmode'].includes(k)) drill.resetDrill();
  if (later) setTimeout(render, 200); else render();
}
A.setopt = (k, v) => setOption(k, +v);

// "I'm new" on the table's welcome screen: switch to the beginner settings (BEGINNER in state.js).
A.beginner = () => {
  Object.assign(S, BEGINNER);
  saveSettings();
  drill.resetDrill();
  render();
  toast({ ok: true, title: 'Set up for beginners', html: 'Index plays off at the table, the count shown, one other player, slow dealing. Change any of it in Settings.' });
};

document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.set) setOption(t.dataset.set, t.checked, true); // switches
  else if ('import' in t.dataset && t.files?.[0]) settings.importFile(t.files[0]);
});

// Keyboard: H S D P R play the chip with that letter (table or drill), ? toggles the hint,
// Y / N answer insurance, Enter / Space press the view's main (gold) button: Deal, Next hand, Check, ...
// Tab-specific keys (count drill pacing, continue after a mistake) are handled first by the tabs.
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, select, textarea')) return;
  count.onKey(e); drill.onKey(e); table.onKey(e);
  if (e.defaultPrevented) return;
  const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  // Arrow keys / + / − change the focused stepper, or the first one on screen.
  const step = { ArrowUp: 1, ArrowRight: 1, '+': 1, '=': 1, ArrowDown: -1, ArrowLeft: -1, '-': -1, PageUp: 5, PageDown: -5 }[k];
  const stp = step && (document.activeElement?.closest?.('.stepper') || $('view').querySelector('.stepper'));
  if (stp) { e.preventDefault(); const id = stp.dataset.stp; setStp(id, (STP[id] || 0) + step); return; }
  let sel = null;
  if ('HSDPR'.includes(k) && k.length === 1) sel = `.chip[data-a$=":${k}"]`;
  else if (k === '?') sel = '.qbtn';
  else if (k === 'Y') sel = '[data-a$="ins:1"]'; // table (ins:) and the index drill (drins:)
  else if (k === 'N') sel = '[data-a$="ins:0"]';
  else if (k === 'Enter' || k === ' ') {
    if (e.target.closest?.('button')) return; // a focused button handles its own Enter/Space
    sel = 'button.b.primary:not(:disabled), button.start.primary';
  }
  const b = sel && $('view').querySelector(sel);
  if (b && !b.disabled && b.ariaDisabled !== 'true') { e.preventDefault(); b.click(); }
});

settings.applyTheme();
render();
lastTab = app.tab;
// after an import (settings.importFile reloads the page): confirm it
const imported = sessionStorage.getItem('tally_imported');
if (imported) {
  sessionStorage.removeItem('tally_imported');
  const when = Date.parse(imported);
  setTimeout(() => toast({ ok: true, title: 'Data imported', html: `Stats and settings${when ? ` from ${new Date(when).toLocaleDateString()}` : ''} are loaded.` }), 700); // after the loader
}

// Splash (index.html): the full intro fades out once it has played (~1.5 s after page start); the quick
// loader on later loads after one assembly of the logo (~0.5 s). A tap skips either.
const splash = $('splash');
if (splash && getComputedStyle(splash).display !== 'none') {
  const quick = document.documentElement.classList.contains('quick');
  const out = () => {
    splash.classList.add('out');
    document.documentElement.classList.remove('intro'); // page background + status bar back to the theme
    settings.applyTheme();
    setTimeout(() => splash.remove(), 400);
  };
  const t = setTimeout(out, Math.max(0, (quick ? 520 : 1550) - performance.now()));
  splash.addEventListener('click', () => { clearTimeout(t); out(); });
} else splash?.remove();

// Offline support for the hosted build only: not in dev (it would cache dev files)
// and not from file:// or inside a Claude artifact, where registration just fails.
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
