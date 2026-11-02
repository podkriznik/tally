// "How to play" page (not a tab; app.tab === 'guide'): blackjack and Hi-Lo counting for beginners.
import { INS_IDX } from '../engine.js';
import { actPill } from './common.js';

const sec = (title, body) => `<div class="panel guide"><h2>${title}</h2>${body}</div>`;

export function render() {
  return `<div class="btns"><button class="b ghost" data-a="back">← Back</button></div>` +
  sec('The goal', `
    <p>Finish with a higher total than the dealer without going over 21.</p>
    <ul>
      <li>Cards 2–10 count their number, J, Q and K count 10, and an ace counts 11 or 1, whichever helps.</li>
      <li>A hand where an ace counts as 11 is <b>soft</b> (A+6 is soft 17): one more card can't bust it. Every other hand is <b>hard</b>.</li>
      <li>An ace and a 10-value card as your first two cards is a <b>blackjack</b>. It pays 3:2 (or 6:5 at worse tables).</li>
    </ul>`) +
  sec('How a round goes', `
    <ul>
      <li>Everyone gets two cards. The dealer's first card is face up (the <b>upcard</b>), the second face down (the <b>hole card</b>).</li>
      <li>You play your hand first. Going over 21 is a <b>bust</b>: you lose right away, even if the dealer busts later.</li>
      <li>Then the dealer turns over the hole card and must draw until reaching 17 or more. The dealer has no choices.</li>
      <li>Higher total wins even money. Equal totals are a <b>push</b>: you get your bet back.</li>
    </ul>`) +
  sec('Your options', `
    <ul class="opts">
      <li>${actPill('H')} take another card.</li>
      <li>${actPill('S')} keep your hand.</li>
      <li>${actPill('D')} double your bet and take exactly one more card. First two cards only.</li>
      <li>${actPill('P')} split a pair into two hands, each with its own bet.</li>
      <li>${actPill('R')} give up the hand and get half your bet back. First two cards only, where offered.</li>
      <li><b>Insurance</b> is a side bet offered when the dealer shows an ace. Basic strategy never takes it; counters take it at a true count of +${INS_IDX} or more.</li>
    </ul>`) +
  sec('Basic strategy', `
    <p>For every hand against every upcard there is one mathematically best play. Played perfectly, it cuts the casino's edge to about half a percent. The Strategy tab shows the chart for your rules.</p>
    <ul>
      <li>A dealer showing <b>2 to 6</b> is weak and busts often: stand on 12–16 more and double more.</li>
      <li>A dealer showing <b>7 to ace</b> is strong: hit totals of 12–16, which lose more often if you stand.</li>
      <li>Always split aces and 8s. Never split 10s or 5s.</li>
    </ul>`) +
  sec('Counting cards (Hi-Lo)', `
    <p>Low cards left in the shoe favor the dealer; tens and aces favor you. Counting tracks which are left.</p>
    <ul>
      <li>Every card you see adds to the <b>running count</b>: 2–6 count <b>+1</b>, 7–9 count <b>0</b>, 10–ace count <b>−1</b>.</li>
      <li>Divide by the decks still in the shoe for the <b>true count</b>: running +6 with 3 decks left is +2.</li>
      <li>The higher the true count, the better your odds. Counters bet more when it's high and the minimum when it's low.</li>
    </ul>`) +
  sec('Index plays', `
    <p>At certain true counts the best play changes. Standing on 16 against a 10 once the true count is 0 or higher is the most famous one. Tally uses the Illustrious 18 and the Fab 4 surrenders. Learn basic strategy first; you can turn index plays off in Settings.</p>`) +
  sec('Using Tally', `
    <ul>
      <li><b>Table</b>: play a full shoe with other players and keep the count. Every few hands you're asked for it.</li>
      <li><b>Drill</b>: one decision at a time, focused on the spots you get wrong.</li>
      <li><b>Count</b>: count down a deck against the clock, and convert running to true counts.</li>
      <li><b>Strategy</b>: the chart. Tap a cell to see why.</li>
      <li>Not sure? Tap <b>?</b> on the felt for a hint. After a mistake, tap the right chip to continue.</li>
    </ul>`) +
  `<div class="btns mid"><button class="b primary" data-a="back">Got it</button></div>`;
}
