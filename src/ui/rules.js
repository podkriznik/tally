// Rules section of the Settings page: table rules and training options. Choices are segmented pickers
// (data-a="setopt:<key>:<value>"), on/off options are switches (data-set="<key>"); both go through
// setOption() in main.js. Every option has a one-line beginner explanation under it.
import { S } from '../state.js';
import { RAMPS } from '../engine.js';

const help = t => `<small class="help">${t}</small>`;

export function render() {
  const sel = (k, label, list, h) => `<div class="field">${label}<div class="seg">${list.map(([v, t]) => `<button data-a="setopt:${k}:${v}" class="${S[k] == v ? 'on' : ''}">${t}</button>`).join('')}</div>${help(h)}</div>`;
  const chk = (k, t, h) => `<div class="field"><label class="chk"><input type="checkbox" class="switch" role="switch" data-set="${k}" id="s_${k}"${S[k] ? ' checked' : ''}>${t}</label>${help(h)}</div>`;
  return `<div class="panel"><h2>Table rules</h2><p class="muted">Set these to match the casino you play at. Strategy charts, drills and the house edge all follow them.</p><div class="grid">
    ${sel('decks', 'Decks', [[1, '1'], [2, '2'], [4, '4'], [6, '6'], [8, '8']],
      'How many 52-card decks are shuffled together into the shoe. Most casinos use 6 or 8. Fewer decks are slightly better for you, and the count swings faster.')}
    ${sel('bj', 'Blackjack pays', [[1.5, '3:2'], [1.2, '6:5']],
      'Your win when your first two cards are an ace and a 10-value card. 3:2 pays 1.5× your bet, 6:5 only 1.2×. 6:5 costs about 1.4%, so avoid those tables.')}
    ${sel('pen', 'Penetration', [[0.5, '50%'], [0.65, '65%'], [0.75, '75%'], [0.8, '80%'], [0.85, '85%']],
      'How much of the shoe is dealt before the reshuffle. Deeper is better for counting: the fewer cards left, the more the count tells you.')}
    ${chk('h17', 'Dealer hits soft 17 (H17)',
      'A soft 17 is 17 with an ace counted as 11, like A+6. On: the dealer draws another card. Off (S17): the dealer stands. H17 costs you about 0.2%.')}
    ${chk('das', 'Double after split (DAS)',
      'After splitting a pair you may double down on the new hands. Good for you.')}
    ${chk('sur', 'Late surrender',
      'Give up a bad hand (like 16 against a 10) and get half your bet back, after the dealer has checked for blackjack. Good for you.')}
    ${chk('ra', 'Resplit aces',
      'If a split ace gets another ace, you may split again. Normally split aces get one card each and that\'s it.')}
  </div></div>
  <div class="panel"><h2>Training</h2><div class="grid">
    ${sel('others', 'Other players at the table', [[0, 'None'], [1, '1'], [2, '2'], [3, '3'], [4, '4']],
      'Extra players don\'t change your odds, but their cards are more cards to count, like at a real table.')}
    ${sel('pace', 'Deal speed', [[1.6, 'Slow'], [1, 'Normal'], [0.45, 'Fast']],
      'How quickly cards are dealt and chips paid out. Slow is easier to count along with; fast is for drilling once you\'re comfortable.')}
    ${sel('fbin', 'Feedback', [[1, 'By chips'], [0, 'Top banner']],
      'Where right and wrong answers are explained. By chips: a card under the chips that floats over the page, so nothing moves. Top banner: a banner under the tabs.')}
    ${sel('ask', 'Ask for the count every … hands', [[0, 'Never'], [1, '1'], [3, '3'], [5, '5'], [10, '10']],
      'How often the table pauses after a hand to quiz you on the running count.')}
    ${chk('dev', 'Use index plays (Illustrious 18, Fab 4, insurance)',
      'Change a few plays when the true count says so, like standing on 16 against a 10 when the count is 0 or higher. New to the game? Turn this off and learn basic strategy first.')}
    ${chk('showCount', 'Show the count at the table (training wheels)',
      'Shows the running and true count while you play. Handy while you learn; turn it off to practise for real.')}
    ${chk('bets', 'Practise betting (bet spread)',
      'Before each hand, bet more units when the true count is high, the way counters make their money. Each bet is graded against the ramp below, and wins and losses scale with your bet. Learn basic strategy first.')}
    ${sel('spread', 'Bet spread (units)', [[4, '1–4'], [8, '1–8'], [12, '1–12']],
      `Ramp by true count (rounded down): ${RAMPS[S.spread].map((u, i) => `${i === 0 ? '+1 or less' : i === 4 ? '+5 or more' : '+' + (i + 1)}: ${u}`).join(', ')}.`)}
  </div><p class="muted">Basic strategy here is the standard multi-deck chart with H17, DAS and surrender adjustments. With 1–2 decks a few borderline plays differ slightly.</p></div>`;
}
