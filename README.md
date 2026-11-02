# Tally

A personal blackjack trainer: basic strategy, Hi-Lo counting, index plays and a house edge simulator.

## Setup

Requires Node 18+.

```bash
npm install
npm run dev        # opens http://localhost:5173
npm test           # engine tests
```

To use it on your phone on the same Wi-Fi, run `npm run dev:host` and open the Network URL it prints.

## Builds

- `npm run build`: regular static build in `dist/`, which can be hosted anywhere (GitHub Pages, Netlify, a folder on a server).
- `npm run build:single`: a single self-contained `dist/index.html` that works opened directly from disk. `npm run open` builds it and opens it in your browser.

Both builds run the tests first and stop if any fail.

## Install on a phone

The regular build is an installable web app that works offline. Host `dist/` on any HTTPS site, open it in Safari, then Share → Add to Home Screen. Offline support doesn't work from the dev server on your Wi-Fi, because service workers need HTTPS.

## Tabs

- **Table:** play from a shoe, count every card, get feedback on each decision and periodic count checks.
- **Drill:** quick strategy decisions, weighted toward situations you get wrong.
- **Count:** count down a deck against the clock, and practice running to true count conversion.
- **Strategy:** strategy chart for the current rules, plus the index plays. Tap a cell to see why that play is right.

Before your first deal the table shows a welcome screen with three starting points: **Learn the basics** (a "How to play" guide, also linked from Settings), **Drill strategy** and **Play a shoe**.

The chart button in the header opens **Progress**: your practice day by day (decision accuracy, count checks, count drill speed) over the last 14 days.

The gear button in the header opens **Settings**:

- **Appearance:** automatic, light or dark theme.
- **Table rules and training:** decks, H17, DAS, surrender, resplit aces, 3:2 / 6:5, penetration, other players, count checks, index plays, and **bet practice**: bet in units before each hand, graded against a 1–4, 1–8 or 1–12 ramp by true count.
- **House edge:** Monte Carlo simulation for the current rules.
- **Your data:** export stats and settings to a JSON file, or import one (to back up, or to move between devices).

On phones the tab bar sits at the bottom of the screen, and you can swipe left or right to switch tabs. On wide screens the Table and Drill show the felt and the chips side by side.

Keyboard shortcuts:

| Key | Does |
|---|---|
| H, S, D, P, R | Hit, Stand, Double, Split, Surrender |
| Enter or Space | The main gold button (Deal, Next hand, Check, ...); continue after a mistake |
| ? | Show or hide the hint |
| Y / N | Take or decline insurance |
| Arrow keys, + / − | Change a count or bet (you can also drag the number sideways) |

Stats are stored in the browser's localStorage, per browser and device.

See `CLAUDE.md` for architecture and conventions.
