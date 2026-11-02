# Tally (Hi-Lo trainer): agent handoff

Personal blackjack training web app (basic strategy + Hi-Lo card counting). Single user, not published to any store. Plain JavaScript (ES modules) + Vite. No framework, no TypeScript, no runtime dependencies.

## Commands

- `npm run dev`: dev server, opens the browser
- `npm run dev:host`: dev server reachable from a phone on the same Wi-Fi
- `npm test`: Vitest (engine tests, ~1 s)
- `npm run build`: normal build to `dist/` (runs the tests first and stops if they fail)
- `npm run build:single`: one self-contained `dist/index.html` (used to republish it as a Claude artifact or to open it straight from disk; also runs the tests first)
- `npm run open`: `build:single`, then opens `dist/index.html` in the default browser (Windows-only `start`)

Run `npm test` after any change to `src/engine.js`.

## Layout

```
index.html         App shell: header with the logo, plus the splash (inline <style> so it covers the page before
                   the app's CSS/JS load). First open per session (sessionStorage 'tally_intro'): the full intro.
                   Later loads (html.quick): a small looping logo on the page background as a loader.
                   Skipped with reduced motion; main.js fades it out.
src/engine.js      Pure logic, no DOM: card values, Hi-Lo tags, basic strategy, index plays (DEV),
                   Shoe class, fast simulation (simShoe/simRound/houseEdge), bet ramps (RAMPS, rampBet).
                   The only file with tests.
src/state.js       Settings S, per-situation stats ST, localStorage wrapper `store`, app.render hook, STP (stepper values).
src/main.js        Tab bar, gear button (opens/closes the 'settings' view), render(), delegated click/change/keydown handlers.
src/ui/common.js   View helpers (cardHTML, stepper, explain, hintHTML, ruleSummary, ...).
                   Hints (table + drill) show the hand's basic-strategy row and index rules, never the
                   count-based answer; a hinted decision isn't scored and is recorded as a miss. An open
                   hint replaces the stats strip (top of the view) and closes when you answer.
src/ui/table.js    Table play: shoe, other players, hero hand, insurance, count checks.
src/ui/drill.js    Strategy drill, weighted toward missed situations. Weakest spots (spotHTML) rebuilds each
                   stats key into the situation, your record, the correct play + reason() from charts.js,
                   and its index rule.
src/ui/count.js    Deck countdown (options are segmented pickers, data-a="cdopt:<key>:<value>") + true count drill.
src/ui/charts.js   "Strategy" tab (key 'charts'): strategy chart for the current rules + index table. Tapping a
                   cell (data-a="chcell:<row>:<up>") lights its row/column and shows a one-line reason
                   from why() (rule-based text, no made-up odds) plus the index rule for that spot.
src/ui/guide.js    "How to play" page (not a tab, like settings): rules, terms, basic strategy, Hi-Lo, using Tally.
                   Opened from the table's welcome screen (idle state, welcome() in table.js) and Settings.
src/ui/settings.js Settings page (not a tab; app.tab === 'settings'): theme, help link, rules.js + edge.js
                   sections, and "Your data": JSON export / import of the tally_* keys (import reloads).
src/ui/progress.js "Progress" page (not a tab; chart button in the header): headline stats + 14-day column
                   charts from the daily log (DAYS / logDay in state.js), each with tooltips (data-tip,
                   shown by main.js) and a table view. Bar color --series passed the dataviz palette checks.
src/ui/edge.js     Chunked Monte Carlo house edge (section of Settings).
src/ui/rules.js    Rules / training settings form (section of Settings).
src/style.css      Purple + gold light/dark theme via light-dark() tokens in :root; <html data-theme> forces one.
                   Decisions are casino chips (actionBtns in common.js), stats strips use stat(), floating
                   controls (phone tab bar, toast, gear) use the --glass* tokens / .glass class.
tests/engine.test.js  Strategy chart snapshots, index thresholds, shoe, house-edge sanity check.
public/            Copied as-is into dist/: PWA manifest, service worker (sw.js), icons.
                   icon.svg is the source; the PNGs were rendered from it with headless Chrome. icon.svg is
                   full-bleed (phones crop home-screen icons); favicon.svg is the rounded browser-tab version.
```

**Hosting:** live at https://podkriznik.github.io/tally/ (repo github.com/podkriznik/tally, public). `.github/workflows/deploy.yml` runs the tests, builds and publishes `dist/` to GitHub Pages on every push to `main`.

**Branches:** work happens on `dev`. Commit and push there: `test.yml` runs the tests on GitHub, and nothing is deployed. `main` is the live app. Publishing means merging `dev` into `main` and pushing `main`; do it only when the owner says to publish. Afterwards, switch back to `dev`. Git in this repo uses a repo-local personal identity (GitHub no-reply email), and the remote URL carries the `podkriznik` username so Git Credential Manager uses the personal login. The machine's global identity and saved GitHub login belong to the owner's employer; never commit or push with them. Commit messages carry no Claude co-author line.

**PWA:** `main.js` registers `sw.js` only in production builds served over http(s), so dev, file:// and the artifact skip it. Service workers need HTTPS (localhost is exempt), so offline use on the phone needs a hosted build. Bump `VERSION` in `sw.js` when you change its caching logic.

## Conventions

- **Rendering:** each tab exports `render()` returning an HTML string; `main.js` sets `#view.innerHTML`. Call `app.render()` after a state change. No virtual DOM; the full view re-renders on purpose (it's small). Because of that, animations key off object identity: `fresh(o)` in `common.js` is true only the first time an object renders. `cardHTML` uses it to deal new cards in. The table numbers each card as it leaves the shoe (`c.n`), and `dealCards()` in `main.js` staggers the cards in that order (170 ms apart), flies each one from the shoe at the felt's top-right corner, and delays result tags until the last card lands. `backHTML` deals the hole card face down; `cardHTML` flips it when revealed. `pop(obj)` adds the pop-in class to new feedback. Create a new feedback object per event (don't mutate the old one), or it won't animate. The count drill uses `cardFace` (no animation). Layout shifts animate too: `render()` in `main.js` records the position of each top-level block of `#view`, matched across renders by class name and order, and glides moved blocks from their old position (FLIP). New blocks fade in unless they have `.pop`. Give a block a distinct class if it should be tracked separately. In-page results (count checks, count drill, true count drill) use `resultCard({ ok, title, html })` from `common.js`, which looks like the toast. Decision feedback (table decisions, insurance, drill) isn't part of the view: it goes to `toast()` in `common.js`, a banner under the tab bar. Mistakes stay until the next click (`main.js` calls `hideToast()` before every action except steppers); correct answers fade after 2 s. After a mistake (drill and table), `actionBtns(..., mark)` pulses the right chip and sets `aria-disabled` on the rest (`main.js` ignores those clicks). The mistake is scored, but the wrong move is never played. Tapping the right chip, or Enter/Space, continues: the drill deals the next hand, and the table plays the correct move (`T.miss`, `play()` in `table.js`), so the hand goes on with correct play. `main.js` also replays a press bounce (`.bump`) on the re-rendered copy of the tapped chip.
- **Actions:** buttons use `data-a="name:arg1:arg2"`. Each tab exports an `actions` object, and `main.js` merges them into `A`, so action names must be unique across tabs. There are no dropdowns or plain checkboxes. Choices are segmented pickers (`.seg` buttons: `setopt:<key>:<value>` for rules/training, `cdopt:` for the count drill, `edopt:` for the house edge, `theme:`). On/off settings are switches (`input.switch`, `data-set="<key>"`); both go through `setOption()` in `main.js`. The import file input uses `data-import`. Stats strips color their values with `tone.pct(ok, n)` / `tone.sign(v)` from `common.js` (green / gold / red). Steppers (`stepper(id, units)`) are the number inputs for counts and bets: ±1/±5 buttons, plus dragging the readout sideways and the arrow keys (`setStp` in `main.js`). Keyboard shortcuts live in the keydown handler in `main.js`: they click the matching button in `#view` (chip by its letter, `.qbtn`, insurance, first enabled `button.b.primary` for Enter/Space). Tab-specific keys go first in each tab's `onKey`. Destructive buttons use `class="b ghost danger"` plus `data-confirm="<text>"`: `main.js` arms them on the first tap (solid red, confirm text for 3 s) and runs the action only on a second tap.
- **Bets and payouts:** the table draws a bet stack (`stackHTML`) at the end of each hand's card row. At the result, `payouts()` in `main.js` flies `.mini.fly` chips from the felt's top center (wins) or to it (losses). Elements with `data-tween`/`data-v` count up to their new value (`tween()`).
- **Bet practice** (`S.bets`, off by default): Deal / Next hand first opens a bet step (`T.phase === 'bet'`). The bet is graded against `rampBet(trueCount, S.spread)` for the true count the hand is dealt at (0 if the shoe is about to be reshuffled). `T.unit` scales every result, insurance included; with bets off it is 1.
- **Phones (≤640px):** the tab bar is fixed at the bottom of the screen, above the home indicator, with an icon above each label (`TAB_ICON` in `main.js`; hidden on larger screens), and `main#view` gets bottom padding to match. Swiping left or right on the page switches tabs (touch handlers in `main.js`). It's deliberately strict: at least 30% of the screen width, under 0.5 s, 3× more sideways than vertical, and a gesture whose first movement is vertical stays a scroll. Ignored when it starts on buttons, `.tw`, steppers, `.seg` or inputs.
- **Switching tabs/pages:** `go()` in `main.js` fades through: the live `#view` fades out (110 ms, with an 18px shift after a swipe), is swapped while invisible (rebuild and scroll jump never show), then fades in (200 ms). The swap is timer-driven, and the fade-in is force-finished shortly after, so stalled frames can't hang the switch or leave the page invisible. A newer `go()` during the fade-out wins. Each tab's scroll position is remembered (`scrolls`). View Transitions were tried and dropped: on iOS Safari the snapshot misses the area under the floating toolbar, and cross-fading the glass tab bar flickered. The tab bar is built once by `tabBar()`. Its purple pill is a single `.ind` element moved under the selected button with a CSS transition, so it slides between tabs; `go()` moves it at the moment you tap. Segmented pickers in the view (`.seg`: count options, theme) are re-rendered on every tap, so `segPills()` adds their `.ind` highlight after each render and slides it from the position remembered before the render (keyed by the buttons' action, e.g. `cdopt:speed`).
- **Phones in landscape** (landscape, ≤520px tall, ≥600px wide): Table and Drill use the same felt | chips columns as wide screens, with a compact header, stats strip, cards and chips, and padding that keeps clear of the notch.
- **Deal speed** (`S.pace`: 1.6 slow, 1 normal, 0.45 fast) scales the deal, flip, payout timing (`dealCards`, `payouts` in `main.js`) and the drill's pause after a correct answer. **Beginner setup:** `BEGINNER` in `state.js`, applied by "New to blackjack?" on the table's welcome screen (hidden once the settings already match).
- **Wide screens (≥1000px):** the header and tab bar are wide on every tab, so they never resize on a switch (the pill is measured after `body[data-tab]` is set, and a `ResizeObserver` re-places it). Table and Drill content goes two columns. The views wrap everything after the felt in `.side` (`display: contents` elsewhere, so phones are unaffected), `body[data-tab]` scopes the CSS, and FLIP tracks `.side`'s children.
- **Accessibility:** cards carry spoken labels (`role="img"`, "7 of hearts"; the hole card is "face-down card"), stepper buttons are at least 44px tall, and the hint button shows a one-time "Not sure? Tap ?" bubble until a hint is opened (`hintUsed()`).
- **Card values:** 2–10 are numbers and ace = 11 everywhere in the engine. UI cards are `{r, s, v}` objects; pass `c.map(x => x.v)` to the engine.
- **Rules object** `R`/`S`: `{decks, h17, das, sur, ra, pen, bj}` plus training keys `{others, ask, dev, showCount, bets, spread, pace}`.
- **Action codes:** `H S D Ds P R`. `Ds` and `raw` only matter for charts; with `raw` unset, `basic()` resolves D/Ds according to `canDouble`.
- **Persistence:** localStorage keys are prefixed `tally_` (settings, stats, table, tab, cd, cdbest, streak, days, tip, theme). `days` is the daily practice log; log new scored activity with `logDay()`. `tip` records that the hint nudge has been seen. Add new keys to `KEYS` in `settings.js` too, so export/import includes them. Always go through `store` (it swallows errors). Keep stored shapes backward compatible, or migrate them.
- **Style:** 2-space indent, single quotes, semicolons. Keep `engine.js` free of DOM and storage.

## Domain notes (don't "fix" these)

- Basic strategy is the standard 4–8 deck chart with H17 / DAS / late-surrender adjustments. 1–2 decks only get the 11 v A double, a known simplification.
- Index plays (`DEV`) are the Illustrious 18 + Fab 4 for Hi-Lo; the first matching entry wins, so order matters (16 v 10 stand before 15 v 10 entries, surrender entries depend on `canSurrender`). Insurance is taken at TC ≥ +3 (`INS_IDX`).
- True count = running count ÷ decks left, with decks left rounded to the nearest half deck (min 0.5). Display rounds to one decimal.
- The dealer hole card is counted only when revealed (`revealHole()`).
- The other players at the table use simplified basic strategy (no splits or surrender). They exist only to add cards to count.
- Reference house edge: 6D S17 DAS LS 3:2 ≈ 0.36%. H17 adds ~0.2% and 6:5 adds ~1.4%. The test checks 0.36 ± 0.25 over 2M hands.

## Changing strategy

The chart snapshots in `tests/__snapshots__/` pin the exact strategy. If you change `basic()` on purpose, review the diff, then run `npx vitest run -u`. A snapshot change you didn't intend is a bug.

## Owner preferences

- Built for personal use. Keep it simple and dependency-free unless a feature clearly needs a library.
- When revising docs, the owner prefers being told what to change and where over getting a regenerated file.

## Ideas backlog (not started)

- Bankroll view for bet practice: win rate and risk of ruin for the chosen ramp (betting itself is done)
- Counting with the other players' cards shown only briefly
- Exact (combinatorial) strategy per rule set, including proper 1–2 deck charts
