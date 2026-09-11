# Zahlenkönig

A German mathematical puzzle game for mobile (PWA). The player gets 2–4 numbers
and a target, and must reach the target using every number exactly once. Audience
ranges from first-graders to adult maths enthusiasts.

Deployed to GitHub Pages from `main` via Actions.

## Read this before working on v2

v2 is a re-architecture of the input. Planning is done and implementation is
under way (see "Where v2 stands" below). Two documents carry the plan, and
both are worth reading before proposing anything:

| File | What it is |
|---|---|
| `spec/zahlenkoenig-v2-konzept.md` | **What** v2 is. Data model, block interaction, layout, design system, implementation order. |
| `spec/zahlenkoenig-v2-entscheidungen.md` | **Why**, and **what was already rejected**. Read this before suggesting an approach — a lot of plausible ideas have been considered and turned down for stated reasons. |
| `spec/generator-audit.html` | **Vorher/Nachher for the generation round below.** Open it in a browser: all 33 selectable settings combinations, measured before and after, with the puzzles each one draws today. Self-contained, no build step. |
| `spec/entwurf.html` | The clickable draft. Open it in a browser: a playable board with the selection panel, plus the studies that settled bracket shape, block contrast and the block icon. It also measures the worst-case width live. |

Entries marked **PO** in the decisions document were chosen by the product owner
directly. They are instructions, not recommendations; don't revise them without
asking.

The v1 documents (`zahlenkoenig-anforderungen.md`, `zahlenkoenig-spezifikation.md`)
describe the app as it currently stands. Where they disagree with the v2 concept,
the v2 concept wins for anything being built now.

## Next v2 step

**Nothing is open that has been scoped.** The three-number-group round
closed the last measured gap (see "Where v2 stands"): the hint's search
now reaches everything `solver.ts`'s `reachable()` does at two, three and
four numbers — 0 walled boards over 19 100 real draws, and the exhaustive
pool clean at every number count. Concept 16's roadmap was already
finished before that.

**The one product question that round raised is answered: the onboarding
bracket puzzle shows its hint** (PO). `Board.tsx`'s `onboarding` prop is
gone entirely — it had no other job — so an onboarding board is treated
exactly like any other. The argument for hiding it was that a hint can
walk the whole bracket, which is the lesson the card asks for; the
argument that won is that withholding it left a beginner meeting the
game's hardest gesture with no help at all. The budget settles it without
a special case: the plan is eight chips, the budget is half rounded up, so
four presses land the setup and the icon mutes — the `grow` drag is the
seventh move and stays the player's. Verified in a browser: four presses
give `3 × (1)`, then muted.

Anything else past this point (dark mode, the "Zwischenschritt beim
Auflösen" notation-line question, either open item in concept section 17's
own table) still needs a fresh product decision before it is a "step" at
all. Everything below this paragraph is about concept 16's roadmap.

**Step 6 (concept section 16, "Feinschliff") is done, and it was the last
row in concept 16's own table — there is no step 7.** Animations, landscape
(Querformat) and the PWA work (concept section 19) are all built and
verified; see "Where v2 stands" below for the round in full. Concept
section 16 has not grown a further row since this file last checked, so
per this file's own standing instruction there is no "following step" to
point at. **If asked to "implement next step" with nothing more specific
now**, say so rather than guessing at new scope — concept 16's roadmap is
complete, and anything past this point (dark mode, the "Zwischenschritt
beim Auflösen" notation-line question, either open item in section 17's
own table) needs a fresh product decision before it's a "step" at all, not
just doing.

Below is how step 6 itself got here — concept section 18's "Vor Schritt 6"
named two things not yet done at the start of this round; both are
resolved now, and neither resolution did any of step 6's own work (no
animations, no landscape layout, no manifest/service worker come from
them by themselves):

**The `--cell` caps (88px/104px) are confirmed, not provisional any more.**
Concept 12.5 always flagged them as "am Gerät zu bestätigen" against the
worst case (four numbers, three operators, two blocks — `(a op b) op (c op
d)`) rather than just a resized browser window. Confirmed on a real iPad,
in both orientations (portrait hits the 88px cap, landscape the 104px one
via `tokens.css`'s `@media (min-aspect-ratio: 1/1)` switch) — screenshots
of `(7×1)÷(8+3)`, the worst case built for real, show both brackets sitting
inside the field with a clean margin before the rounded corner, neither
orientation clipping the way the earlier tablet/desktop-window report
described. `tokens.css`'s own comment is updated to say so.

**`public/crown.svg` is a real vector crown now, not the Unicode emoji it
used to be — and that was the actual bug, not merely "unfilled line art"
as concept 18's own description had it.** The old file was
`<text y=".9em" font-size="90">👑</text>` inside an SVG wrapper: not vector
art at all, just the emoji glyph, rendered however the OS/browser's own
emoji font happens to draw it — precisely what concept 13.2's "keine
Emoji" rule (inline-SVG stroke symbols only) exists to rule out, and
exactly why it couldn't be trusted down to a 16px favicon or generated
into the 192/512px PWA icons concept 19.2 needs. The replacement is actual
`<path>`/`<circle>`/`<line>` geometry: a two-tone blue crown (both shades
matching the app's own accent hue from `tokens.css`, not the crown's own
separate palette) with three gold jewels, and — the product owner's own
addition once shown the plain version — a small "+ ×" rendered as vector
strokes in the band, tying the icon to the game itself rather than being a
generic crown. An earlier draft used a 2×2 grid of all four operators;
cut to two on the PO's own call once side-by-side renders showed the
four-symbol version blurring into texture below ~48px while two stayed
legible at every size tested, including a true (device-pixel-accurate)
16px render. Checked in a real browser as the actual served favicon too,
not just as a static file — the old file's literal bug (an XML comment
containing `--`, from an early draft of this same round) only ever showed
up that way, as a parse error on load, never in a plain file read.

Both open questions from the bug-fix round are resolved now — the
negative-result notation line by the negative-result-display round, and
**Tastaturbedienung** (below the ranges-display rounds) by a PO decision
not to build it, at least for now.

**Tastaturbedienung, PO decision: not building it.** The chips are real
`<button>`s and take focus, but pressing Enter or Space did nothing —
`onClick` is dropped wherever the drag handlers are wired (`Tray.tsx`,
`Expression.tsx`, `Board.tsx`'s own display-only target chip — see
`NumberCell`'s own note on why a plain `onClick` alongside `useDrag` would
double-fire), and `useDrag` only ever listened to pointer events. The
product question this file used to raise — placing/returning only, or a
full keyboard path to a bracket — is moot now: neither is being built. What
*was* worth fixing on its own, independent of that decision: a chip that
takes Tab focus but does nothing on Enter/Space reads as broken, not as
"no keyboard support here". Every such chip (`NumberCell`, the tray's
operator and block chips, `Expression.tsx`'s `LeafChip`, `Board.tsx`'s
target chip) now gets `tabIndex={-1}` exactly when it has no working
`onClick` — tied to the same condition (`dragHandlers`/`hasDrag` truthy)
that already governs whether `onClick` is wired at all, so it can't drift
out of sync with it. The `=` submit button and the header's chip/hint
button needed no change: they never depended on drag, so Enter/Space
already worked on them, confirmed by tabbing through a real build
(Playwright): only those two remain in tab order now, the submit button
rejoins it the moment it's enabled, and everything else is skipped rather
than sitting there looking clickable. (The onboarding round added a third:
the intro card's own dismiss button, which takes focus on mount — the only
focus move in the app, and it has nothing to restore focus *to* precisely
because of this decision.)

## Where v2 stands

**An SEO round gave the page something to find.** Like the footer/history
and onboarding rounds, this is scope the PO asked for after concept 16's
roadmap was already finished, not a step. The starting point, measured
rather than assumed: the served HTML was 943 bytes, of which the only prose
was a nine-word German `<meta name="description">`, and `<div id="root">`
was empty. There was no `<h1>` anywhere — not in the static file *and not
in the rendered app*, which the board's own design explains (it says its
shape completely and never names the game).

*The finding that set the agenda is that this app has two audiences of
crawler, not one, and they need different things.* A search engine renders
JavaScript, so it would eventually see the board — but a board is chips and
digits, and it never states the one real rule. Most LLM-based crawlers do
**not** run JavaScript at all; they fetch the HTML and read it. For those,
the page was literally an empty div. So the fix is two-sided:

- **`index.html`'s `#root` now holds the page as prose** — the name, the
  rule ("jede Zahl genau einmal"), what the operators and brackets do, and
  who it is for. `createRoot` clears its container on first render
  (`src/main.tsx`), so this is the no-JavaScript fallback and the loading
  state in one, and it is never on screen beside the game.
- **`Game.tsx` renders a visually hidden `<h1>` and one-sentence
  description** (`.srOnly` in `Game.module.css`), for the renderer-based
  crawler and for a screen reader, which had no heading either. The
  sentences are `introGoal`/`introRule` — the onboarding card's own words —
  rather than two new i18n keys, so there is one place to change the
  wording and it is already translated into all three languages.

*The fallback was measured in a real browser before it landed, because it
is the one change here a player could feel.* React replaces it **57–81ms**
after navigation normally and **~470ms** on a 6× throttled CPU; **CLS is
0.0000 either way**, checked against a control build with the fallback
stripped back out, so it costs nothing in Core Web Vitals. It introduces no
scrolling (`scrollHeight === clientHeight`, which `tokens.css`'s own
`overflow: hidden` already guaranteed since the stylesheet is
render-blocking). With JavaScript off it is simply the page. Worth being
plain about the tradeoff: on a slow phone there is now a brief flash of
German prose where there used to be a blank white screen — which is the
comparison that matters, and it is an improvement rather than a cost.

*The rest of the round is metadata that did not exist at all:* a title that
says what the thing is, a 150-character description, `canonical`, `robots`,
full Open Graph and Twitter cards, and **schema.org structured data**
(`SoftwareApplication` + `Game` in a `@graph`, with `offers` at price 0,
`audience`, `educationalUse` and a `featureList`). The structured data is
the part aimed squarely at the AI crawlers: it is the only place on the
page that states the facts *as data* rather than as prose.

*`public/og-image.png` is generated from the app's own tokens*, not from a
second palette — 1200×630, the worst-case board `(6+2) × (9−3) = 48` drawn
with `tokens.css`'s real HSL values and the crown from `public/crown.svg`.
**Building it surfaced a real cost the build reported on itself**: at first
it was precached by the service worker, 36 KB — 13% of the whole precache —
that no player ever downloads, since link-preview scrapers never reach a
service worker and the image is never rendered in the app. `workbox.globIgnores`
excludes it now; the precache went from 277.69 KiB back to 242.33 KiB.

*`sitemap.xml` is emitted at build time by a small Vite plugin, not checked
in.* `lastmod` is the build date, which is right by construction every
deploy — a literal date in the repo is wrong the day after it is written,
and this file's own "a command that still reads plausibly is not evidence
it still does anything" warning applies to data as much as to commands.

**`robots.txt` was deliberately not added, and this is the one thing here
that cannot be fixed from this repository.** Crawlers read robots.txt only
at the origin root — `https://funnygerman.github.io/robots.txt` — and this
is a project page, so anything shipped here would land at
`/zahlenkoenig/robots.txt` and never be read by anything. A file that looks
like it works and doesn't is worse than no file. The practical consequence
is small: a missing robots.txt means "crawl everything", which is what is
wanted; only the `Sitemap:` directive has nowhere to live, and submitting
the sitemap URL once in Google Search Console does that job instead. The
other half of it is worth knowing for later: **if the site ever moves to a
custom domain, `public/robots.txt` starts working and should be added.**

*`src/seo.test.ts` pins the invariants, and it caught two defects in the
round that produced it* — a 210-character meta description that a search
result would have truncated mid-sentence, and structured data that
paraphrased the rule instead of stating it, so the two disagreed. What it
holds still is the three things nothing else in the build fails on: the
deployed URL is written by hand in two files that cannot read each other
(`vite.config.ts`'s `siteUrl` and `index.html`'s meta tags — a static tag
cannot read `base`), the fallback prose is the only text a non-JS crawler
gets, and the JSON-LD is a JSON string inside HTML where a bad edit is
invisible. It reads both files through Vite's own `?raw` imports rather
than `node:fs`: `npm run build` typechecks `src`, and `@types/node` is not
a dependency here — a node builtin in a test would have broken CI while the
test itself passed.

**`README.md` was one line ("# zahlenkoenig") and is now a real
description.** Not housekeeping: a GitHub repository page is itself a
heavily crawled surface, and for the LLM crawlers it is often a better one
than the app, because it is static text. It leads with the rule, links the
live site, and shows the og image. No `## License` section was written —
there is no `LICENSE` file, and that call is the PO's to make, not one to
invent in a README.

**An onboarding round gave the game a first-run introduction — two fixed
puzzles and a card each — after feedback from players who had never seen
the idea: "if a user opens the game for the first time, it's not clear
what to do there."** Like the footer/history round, this is scope the PO
asked for after concept 16's roadmap was already finished, not a step.

*The round started by looking at the actual first screen rather than
reasoning about it*, and that is what set the agenda. Outside the footer
there is not one word on it. The board explains its own **shape**
completely — the scaffold says how many chips go where, the target chip
says what to hit, the greyed `=` says something is still missing — and
says nothing at all about the **one real rule**, that every number must be
used exactly once. A newcomer reads `4 6 7 → 14` as "make 14 somehow".

**The single worst finding was that `?` did not mean help.** `Header.tsx`'s
`HintIcon` was literally a question mark in a ring — the universal glyph
for *help* — so a first-time player hunting for an explanation tapped the
one thing on screen that looked like one and got a chip silently placed on
their board, a hint poorer. It is a **lightbulb** now (inline SVG per
concept 13.2, not v1's 💡). No `?` remains anywhere in the app, verified
against a real render: nothing now promises help without giving it.

**Two fixed puzzles, not a GIF and not a coach-mark tutorial** (both were
offered; the PO chose neither). A GIF is three files across three
languages, goes stale on every UI change, and teaches the *rule* — the one
invisible thing — not at all. A guided-overlay tutorial would have to hook
into `useDrag`'s hit-testing, which is where this repo's worst bugs have
lived. `core/onboarding.ts` (new) holds the two boards instead:

- **`1 + 2 = 3`.** Not teaching arithmetic — teaching "I touched a thing
  and it worked". Concept 6.4's promise ("für Erstklässler die ganze
  Anleitung, ohne Worte") is literally true at two numbers and one
  operator; the app's own default (3 numbers, all four operators) never
  delivered it on a cold open.
- **`(1+1+1) × 3 = 9`** (PO). The three-number group is the one capability
  in the game that trying things cannot find: tap structurally can't build
  it (concept 6.2) and neither can the hint (`hints.ts` only proposes
  two-number groups). Scripted, with a card naming the gesture, it's the
  lesson.

**The PO's first candidate for that second puzzle, `(1+2+3) × 1 = 6`, was
measured and rejected before anything was built.** `reachable()` reports
its representative solution as `n+n+n×n` — flat, no bracket — and
`computeHint` on the empty board returns seven plain tap moves. A player
taps `1+2+3×1`, wins, and never meets a bracket. A bracket that is merely
*permitted* teaches nothing; the one that ships is required
(`onboarding.test.ts` pins both facts).

**The second puzzle needed Board to suppress the hint layer, and that is
why the `onboarding` prop existed — it has since been removed entirely,
both halves, by later rounds; see below.** `useHint`'s `deadEnd` is
`hint === null` recomputed every render, and `computeHint` returns null on
this board — the exact case `hints.test.ts` already pinned for `[1,1,1,3]
→ 9`. Untouched, a first-time player's second board opens **already
outlined as a dead end, before they touch anything**. `Board.tsx` forces
`deadEnd` false and `blockingIds` null while onboarding, and reports
`offered: false` so the header keeps the lightbulb away. That second part
is belt-and-braces rather than load-bearing — the budget is read from the
same null continuation and comes out 0, so `offered` was already false —
and the test file says so: removing the `deadEnd` half fails a test,
removing the `offered` half does not.

**Two things were hidden during onboarding that the first render caught,
and neither was in the plan.** The selection chip showed `3 numbers, 4
operators` over a two-number, one-operator board — and changing it would
have visibly done nothing, which is exactly the silent-no-op class the
bug-fix round removed four of. And the history arrows appeared after the
first onboarding puzzle, mid-lesson, inviting a detour that empties the
board. `Header.tsx` gained `selectionHidden`; `Game.tsx` passes
`total={0}` to `HistoryNav`. The update pill keeps its slot regardless.

**"Shown until played", not "shown once"** (PO: *"do we really need help
again if the user saw it once and played already?"*). That closed the
permanent rules button this round had proposed, and with it concept 12.7's
header-left menu icon — reserved since v2 began, now unbuilt on purpose in
*both* halves (language by the i18n round, rules by this one). The real
risk was never the player who read and played, but the one who dismissed
the card *before* reading it: so the **step** is persisted
(`zahlenkoenig:onboarding-v1`) and the **card's dismissal is not**. A
reload brings the card back; a solved puzzle stays solved. Its own key and
module rather than a sixth `Settings` field or a count off
`solvedHistory.length` — deriving it from the archive would silently
restart onboarding the day that archive is cleared or its cap lowered.

**Drag is deliberately not mentioned on the first card, and is the whole
of the second.** On a two-number `+` board drag can't do anything, so
naming it there teaches a gesture with no use yet and costs a line nobody
reads. The nudge line ("Tap a number") borrows the notation line, which is
already laid out and blank at 22.8px on an untouched board, and removes
itself with the first chip — which is also when it stops being true.

**Both puzzles were played through in a real browser** (Playwright, real
pointer events), not just jsdom. The second is solvable with **exactly one
drag**: tap `1`, `+`, `1`, tap the block chip, drag the third `1` onto the
right bracket edge, then `+`, `×`, `3`, `=`. The card's literal order
works too — tapping the block chip on an empty field yields `()`, which
then fills by tapping.

**The three-number-group round closed the gap the scan found: the hint can
propose a bracket holding three numbers, and every four-number board is
hintable again.** `scripts/checkHintReachable.ts` now reports **0 of 19 100**
draws without a hint, against 7 037 of 17 700 four-number draws before —
and the **exhaustive pool is clean too**, at two, three and four numbers.
That pool pass is the definitive one: 35 selection/band rows held walled
boards before, and none does now.

*It is not a wider search — it is a new gesture.* A hint move has to be
something the player can actually do, and growing a group past two numbers
is drag-only (concept 6.2). So `HintMove` gained a **`grow`** kind: a tray
number dragged onto the right bracket edge, applied through the very
`insertLeafIntoGroup` that `useGame`'s own drop handler calls. One chip per
press still holds (10.3) — the drag places the number, and `withPair`
opens the operator slot beside it that the next press fills.

*The round's real bug was that the plan could not survive its own first
press, and only the real hook showed it.* `useHint` recomputes from scratch
after every press and applies `moves[0]`, so a plan beginning "put a block
at position 2" is re-derived one press later against a board that now
*holds* that block. The first version could fill an existing group's slots
but never grow one — so the board died at `3 × ()` with the hint reporting
a dead end on a board it had itself just built. The fix is a second branch:
**a group already on the board may grow too**, not only one the search is
inventing. Driving `applyHintMove` through the actual `useGame` is the only
level at which this was visible; `hints.test.ts`'s own replay against its
local primitives was perfectly happy.

*The third number comes from the tray, never off the board* — a placed one
would need `absorbPairIntoGroup` and a second new move kind. Left out
deliberately: the boards this is for are overwhelmingly empty ones (the
budget is read from an empty field), and one new move kind is enough risk
for one round.

*The search got faster while getting wider.* `computeHint` now searches
budget by budget — no new bracket, then one, then two — and takes the first
budget that answers. That is 10.2's own order ("erst nach Anzahl der
Blöcke") searched rather than filtered for, and the result is identical.
Measured against real draws at four numbers with all four operators:

| | |
|---|---|
| before three-number groups | ~30ms |
| with them, enumerating and filtering | 70ms |
| with them, searching budget by budget | **~20ms** |

The one case that got slower is a board no budget can complete (~48ms) —
the dead-end path, rarer and already the expensive one. `useHint` runs this
in a memo on every board change, so these are felt directly.

*Three tests had to be rewritten, and the previous round predicted it.*
`hints.test.ts`, `onboarding.test.ts` and `Hint.test.tsx` each held the old
limitation as an assertion (`expect(hint).toBeNull()`). The convention
"write the test as the invariant, not as the bug" says exactly this will
happen — whoever fixes the bug has to delete the test — and the contrast is
the proof of the rule: **"a freshly drawn puzzle never opens as a dead
end" needed no change at all**, before or after.

*The measurement script reported the round on itself.* `checkHintReachable.ts`
refused to print anything on its first run afterwards, because its
known-bad case (`[1,1,1,3] → 9`: solvable, un-hintable) was no longer bad.
That is precisely why every measurement script here is held to a
known-good/known-bad pair — an instrument whose assumptions have gone stale
should fail loudly rather than quietly return zero findings. That case is
the known-*good* one now, and a sharp one: it passes only if the search can
see three-number groups, so a zero means "nothing walled", not "instrument
blind".

*Two things kept deliberately.* `useHint`'s dead-end guard stays although
no generated puzzle can trigger it any more — it is the net against exactly
the regression that cost 39.8%, costs nothing while inert (the `&&`
short-circuits), and `Hint.test.tsx` exercises it against a synthetic board
rather than relying on a blind spot existing. And `Board.tsx`'s
`onboarding` prop, kept last round as belt-and-braces, briefly became
load-bearing — `(1+1+1) × 3` now has a real budget, so it was the only
thing keeping a lightbulb off that board. **The PO then removed it**: see
"Next v2 step". The prop is gone; onboarding boards are ordinary boards.

*Verified in the browser, not only in the model*: on real four-number
boards the hint builds `7 × (1 …)` for 154 and `(6 + 7) × …` for 182, no
dead-end border, budget respected. One honest consequence — **the budget
runs out before the `grow` is ever reached** (four chips of eight, and the
last two are always the player's), so a press on a fresh board does not
perform the drag. What the round buys is that the search *sees* the
solution at all, and therefore that these boards have a hint instead of a
dead-end border.

**The scan that round left open has been run, and it found a live bug that
is much bigger than onboarding: two in five four-number puzzles open as a
dead end.** `scripts/checkHintReachable.ts` (new) asks whether the
generator can hand a player a board `computeHint` cannot even start. This
file asserted it could not. It can, constantly.

| Numbers | Exhaustive pool | Real `nextPuzzle` draws |
|---|---|---|
| 2 | clean | 0 / 2 200 |
| 3 | clean | 0 / 13 200 |
| 4 | **35 selection/band rows affected** | **7 037 / 17 700 — 39.8%** |

Two rows are their *entire* pool: `4 Zahlen, −×÷` uniqueOnly in XL
(800/800) and XXL (453/453). Several more clear 98%. And no four-number
selection is clean — the mildest, `+−÷` band 0, still lands at 5%.

**Every single case is a three-number group** — the patterns are
`(n+n+n)×n` and `(n+n×n)×n`, checked on the browser-confirmed examples.
That is exactly what `completions` cannot propose, and the reason is
unchanged since step 4: a hint move is a tap, and growing a group past two
numbers is drag-only (concept 6.2). **Three numbers is clean for a
structural reason rather than by luck** — a three-number group there spans
the whole expression, so it is just the flat chain and reaches nothing new;
at four numbers `(a∘b∘c)∘d` is a genuinely different value.

**Confirmed in the real app, not only against the model**: with `4 Zahlen,
+×÷, XL` selected, 3 of 12 freshly loaded boards came up with the
dead-end border already lit on the empty field *and* no hint button at all
(the budget is read from the same null continuation, so `offered` is
false and the header hides the icon). `[2,3,5,6] → 102` is one of them —
solvable as `(2+3×5)×6`, and the player is told it is hopeless before
touching a chip.

**The border half is fixed; the search half is not.** The two were always
independent, and conflating them would have delayed the cheap one behind
the expensive one.

*`useHint.ts` no longer derives `deadEnd` from `hint === null`.* The first
draft of this guard read "a dead-end border on an **empty** field is
always a false alarm" — true, but too narrow: on these boards `computeHint`
is null at *every* stage, so a player two chips in was being blamed just
as wrongly as one who had touched nothing. The rule that shipped withholds
the verdict for the whole puzzle, and it is `findBlockers`'s own rule,
which has always had this right — "nothing the player placed is to blame"
when the empty field could not reach the target either.

*The distinction it turns on is the one the first draft missed: `hint ===
null` from an empty field has two causes.* Either the search is blind to
the puzzle (three-number group — solvable, by drag) or the puzzle really
is unsolvable. `computeHint` cannot tell them apart; `solver.ts`'s
`reachable()` can, because it is the model that does not care how a
group's shape gets built. So `useHint` asks it — and only where the hint
came back null, since the `&&` short-circuits, so 60% of boards pay
nothing and the rest pay ~23ms against a `computeHint` that already costs
~30ms. The generator cannot produce the second case at all (`nextPuzzle`
only returns targets `reachable()` gave it), so it arrives only from a
hand-built puzzle — and `Hint.test.tsx`'s own `[1,1,1,1] → 1000` test,
which *should* show a border, still does. That test failing against the
too-broad first draft is what surfaced the distinction.

*It also dissolved a special case.* `Board.tsx`'s `onboarding` prop no
longer suppresses the dead-end border — the general rule covers the
onboarding bracket puzzle on the way past, since it is exactly one of
these boards. The prop keeps only the hint *offer*. A special case turning
out to be an instance of a general rule is usually a sign the general rule
is right.

*Verified the same way the bug was found*: the browser check that reported
3 of 12 freshly loaded boards with the border lit now reports **0 of 12**,
on the same selection. The 3 that still show no hint button are the
remaining gap, correctly reported.

**The search half is fixed too, in its own round — `completions` proposes
three-number groups now, and the 39.8% is 0%.** Details below.

**The obvious third fix is a trap, and is written down here so nobody
reaches for it later: do not make the generator refuse these puzzles.**
Two selections are 100% walled, so refusing would empty them, `nextPuzzle`
would exhaust its attempts and throw, and that unmounts the app — the
exact crash class the bug-fix round fixed. More fundamentally these
puzzles are not broken: a player can solve them, the drag gesture exists.
Deleting hundreds of good puzzles to work around a hint limitation is
backwards. The fraction-only refusal was different — those puzzles were
genuinely unsuitable for the audience.

**A second hint round, from three more PO play-test reports, changed the
search itself and put two guards on the budget.**

*A bracket may now enclose chips that are already on the board, and not
allowing that was a real bug in the dead-end verdict.* The report: `(9 − 2)
× 4 × 2` "marks as wrong" on the puzzle whose hinted solution is `(4 + 2) ×
9 + 2` — both reach 56 from 4, 2, 9, 2. Reproduced at the board `9 −`, four
chips before the finish: `computeHint` returned `null`, so the dead-end
border came on and a press marked the `−` as blocking. The cause was in
`completions`, which could only place a bracket at a position **nobody had
touched** — while the game itself lets a tapped or dragged block chip
*wrap* an adjacent pair (`resolveBlockDrop`'s `wrap`, span 3). So any route
needing a bracket around what the player had already put down read as
impossible. Measured old-versus-new on identical randomly-built boards:
**~9% of every dead-end verdict was wrong** (7.6% of all boards at both
three and four numbers) — and random boards over-represent genuine dead
ends, so a thinking player meets it more often than that. `completions` now
offers, at every even position, a group over that position and the next
two, each of the three either already placed or drawn from the tray.
`diffMoves` is gone with it: the moves are built as the row is built,
because a bracket that consumes three positions of `fixed` for one resolved
position breaks the one-to-one alignment diffing depended on. The block
move's *order* depends on what it wraps — first when the three positions
are empty (so the player is never shown a complete, wrong row waiting for
its bracket), last when it wraps chips already down (`resolveBlockDrop`
only reports `wrap` once both operands are real leaves).

*The hint never places either of the last two chips* (PO). One comparison —
`hint.moves.length > 2`, since that length is exactly how many chips still
finish the board — and it is the guarantee that actually holds: the budget
only keeps the player finishing the puzzle themselves while the
**accounting** holds, and the accounting had already been laundered once.

*That laundering is closed too.* The PO's own workaround: "get hint,
remember it, remove it, add hint manually — left hint count increased by
1". `placeOperator`/`placeBlockAt` mint a fresh id every time, so an
operator taken off and put back by hand was never the id the hint had
recorded, and the budget saw the chip leave and never return. Numbers were
never affected (the tray mints one stable id per number for the puzzle's
life). `useHint`'s `Contribution` matches an operator by its glyph and a
block by being a block — once each, greedily, against what the board holds
— so the honest refund the PO asked for (an accidental press, undone) still
works while the laundering does not. The PO judged the leak itself
acceptable and proposed the last-two rule instead; both shipped, because
they guard different things: the rule is an invariant of the hint, the
`Contribution` fix keeps the budget meaning what it says for everyone not
exploiting it.

**The hint round (PO play-testing plus a QA browser pass) replaced what
the hint button does, and closed two of its own bugs.** The report was
"I'm not sure pulsing really helps", "often different numbers are pulsing
than the next press places", and "sometimes, if there are already numbers
in the expression field, clicking hint does nothing". All three were real,
and a scripted QA pass measured each one against HEAD before anything was
built:

*The pulse is gone.* Concept 10.3's first press pulsed two tray chips and
placed nothing. Measured: the next press placed a chip that was **not** one
of the pulsed ones in **30.3%** of the states that showed a pulse at all —
and in **100%** of the states whose plan contains a bracket, where the
pulse named the two operands going *inside* the block while `diffMoves`
walks the plan in document order, so every chip left of the bracket landed
first (mean **3.67** presses before a pulsed chip appeared). The pulse was
truthful about *which* chips end up in the bracket (157/158 walkthroughs) —
it was wrong about *when*. Worse, it was invisible exactly when a board was
half-built: `pulseIds` is null whenever ≤ 1 number is still unplaced
(verified, 0 violations over 510 live states), which is **30.0%** of live
states and the whole second half of every solve, so the first press
routinely did nothing at all. `Chip`'s `pulsing` prop, its `@keyframes`,
and `Tray`'s `pulsingIds` are all deleted; **every press places a chip
now** (PO).

*The budget is half the chips a puzzle takes, rounded up, and counted in
chips rather than presses* (PO). It shipped as a flat two per puzzle first,
and the PO's own play-test killed that within the hour: two hints on a
four-number puzzle is a much smaller share of the board than two on a
three-number one. `useHint.ts`'s `hintBudget(numbersCount, chipsNeeded)` is
the rule now — the PO's own three worked examples are `Hint.test.tsx`'s
first three assertions: 4 numbers + 3 operators = 7 chips → **4** hints;
+ 1 block = 8 chips → **4**; + 2 blocks = 9 chips → **5**. `chipsNeeded` is
the length of the canonical continuation from an **empty** field — exactly
"how many chips finish this puzzle", and the reason the same four numbers
can be worth 7, 8 or 9: a block is a chip too. It is read once per puzzle
rather than recomputed as the board fills, so the budget a player starts
with is the budget they keep. **Two numbers get none at all** (PO), rather
than the two the formula would give: three chips is the whole board. The
header *hides* the icon there instead of showing a permanently dead one —
`useHint` reports `offered` alongside `available`, and the two are
different things (nothing to give, versus nothing to give *right now*).
The budget is spent while the chip a hint contributed is still on the
board, so taking that chip back gives the hint back — "count chips, not
presses" was the PO's own wording. Which chips those are is read off the tree rather
than predicted: `placeOperator`/`placeBlockAt` mint their own ids inside
`useGame`, so a press records the board's ids first and attributes whatever
appears next (`useHint.ts`'s `beforePressRef`). No counter is shown (PO);
the header's icon simply mutes once a press would do nothing — genuinely
`disabled`, unlike the tray's spent operator chips, which stay muted-but-
droppable because dragging onto them is still a gesture. `Board` reports
that upward through a new `onHintState` prop rather than having the
hint state lifted: `Header` is a *sibling* in `Game.tsx`'s tree, and Board
is remounted per puzzle while Header is not — the same asymmetry that made
`pressHint` an imperative handle in the first place, seen from the other
direction.

*A dead-end board is marked, never repaired* (PO). The other half of
"nothing happens" was `useHint`'s `if (!hint) return` — on a board that can
no longer reach the target the press exited before touching anything, and
the dead-end border it might have been taken for was already on screen from
the previous render. Measured at **45.8%** of randomly tap-built states,
and **70.8%** of boards holding a drag-grown three-number group (a shape
`computeHint` structurally cannot produce, so those boards are dead ends far
more often). `core/hints.ts`'s new `findBlockers` answers it: the
**smallest set of placed chips whose removal makes the target reachable
again**, ties broken toward the *right* (a player's most recent move is the
one they can still picture making), searched to three removals before
giving up and marking everything. A block counts as one chip in that set —
marking it marks its brackets, since dissolving it is how a block is taken
back. Two things it deliberately does not do: it never touches the board
(the PO chose "only mark the wrong chips" over three offered repair
behaviours), and it marks **nothing** when the empty field can't reach the
target either — nothing the player placed is to blame there, and the
dead-end border has already said the puzzle is over. Marking costs no hint,
so a blunder can't eat the budget.

Three things the QA pass **disproved**, which is worth as much as what it
confirmed: the chosen continuation is *not* unstable as chips are placed
one at a time (the recomputed plan was exactly the tail of the previous one
in **1079/1079** presses), a hint move is *never* refused by the placement
function it is dispatched to (`resolveBlockDrop` returned null 0 times and
the operator-budget guard blocked 0 times over 4113 moves — both are
structurally unreachable from a hint), and the pulse never lied about which
chips end up in the bracket. Two of those were the first explanations that
came to mind for the PO's report, and both were wrong.

`Hint.test.tsx`'s "press through to the end" tests could no longer press
through to the end — two hints is by design not a solution — so that
regression coverage moved down a level: it drives `useGame.applyHintMove`
over a freshly recomputed `computeHint` via `renderHook`, which is exactly
what a press does minus the budget. `Game.history.test.tsx` solved its
puzzles the same way and now mocks `nextPuzzle` to a fixed sequence of
two-number sums instead, which makes those tests deterministic rather than
merely unblocked.

**A footer/history round added two things outside concept 16's roadmap
entirely** — the roadmap itself is finished (see "Next v2 step" above), so
this isn't a step, it's new scope the PO asked for afterward: a page
footer, and a way to step back into already-solved puzzles.

*The footer is attribution only, on the PO's own two lines: "made with ❤️
and Claude", and a coffee mention.* Neither is translated content beyond
the usual three languages — `i18n.ts` gained `footerMade`/`footerCoffee`
alongside the existing keys, same `Record<Language, Strings>` key-parity
guarantee as everything else there. `footerCoffee` shipped as plain text
at first — no URL existed yet, and a fake or placeholder one isn't
something this file's own "never generate or guess URLs" rule allows
working around — then became a real link the same day, once the PO gave
one directly (`https://ko-fi.com/funnygerman`, `Game.tsx`): `target="_blank"
rel="noopener noreferrer"`, same as any external link out of the app.
"made with ❤️ and Claude" stays its own plain `<span>` regardless — only
`footerCoffee` was ever going to become an `<a>`.

*Puzzle history is `core/solvedHistory.ts` (new) plus a two-arrow strip
above the header (`HistoryNav.tsx`, new), and Board.tsx needed no changes
at all* — it already took numbers/target/ops as plain props with no
opinion about whether they came from a fresh draw or an old one, so
feeding it an archived puzzle instead of the live one was a `Game.tsx`-only
change. `solvedHistory.ts` mirrors `history.ts`'s own storage conventions
(same try/catch-everything load, same "slice to a window" cap — 20 here,
the same order of magnitude as `history.ts`'s 30/12) but keeps a different
kind of thing: `history.ts`'s window exists only so the generator can avoid
an immediate repeat and holds nothing but a signature string, while this is
an actual replayable log — `{ numbers, target, ops }` per entry, logged
every time a *live* puzzle is solved, never deduplicated (solving the same
puzzle twice is honestly two entries, not one moved to the end the way
`history.ts`'s repeat-avoidance window does it). `ops` is stored per entry
rather than read from today's `settings.ops` at replay time on purpose: a
player can change which operators are enabled between solving a puzzle and
later browsing back to it, and replaying with the *puzzle's own* operators
keeps the tray matching the solution that puzzle actually has, rather than
whatever's currently selected.

`Game.tsx` holds one new piece of state, `historyIndex: number | null` —
`null` means "showing the live puzzle" (the normal case), a number is a
position in the archive. Browsing doesn't touch the live puzzle's own
*puzzle* state at all: it only changes what's displayed.

**It does throw away the in-progress board, though, and this file used to
claim the opposite — a browser QA pass (hint round) disproved it, and the
PO then ruled that the behaviour itself is fine.** The claim was that
Board's key stays `live-${puzzleKey}` when the live puzzle hasn't changed
underneath, so React never remounts it and a player browsing away mid-solve
resumes exactly where they left off. React unmounts on *any* key change:
the key goes `live-N → hist-0 → live-N`, and the Board that comes back is a
brand-new instance with an empty field. Measured directly — place two
chips, browse back, browse forward, and the field is empty. **PO, shown the
finding: "not a bug."** Browsing away is a deliberate step out of the
puzzle, and starting the live one from a clean board on the way back is a
fine thing for that to mean — so this is documented behaviour now, not an
open defect, and nothing is owed here. (What it would take, should that
ever change: leaving the live Board mounted and hidden beside the archived
one instead of swapping keys — a change to how `Game.tsx` renders, not to
the key expression.) Solving a replayed puzzle doesn't log a second archive entry or
advance the live puzzle — Board.tsx's `onSolved` fires the same way either
path, so `Game.tsx`'s `handleSolved` is the one place that has to tell them
apart. Live (the normal case): logs the puzzle and draws the next one,
unchanged from before this round.

**Browsing (`historyEntry` set) was first shipped as "always return to
live", and that was wrong — fixed the same day, after a report of solving
the *oldest* browsed entry and landing on the live puzzle instead of the
next one in.** Bouncing straight to live from wherever the player happened
to be skipped over every other already-solved entry between there and the
newest one — fine from the newest entry (there's nothing left to review),
wrong from anywhere else, since it cut a review session short the moment
it solved one puzzle rather than letting it continue. `handleSolved`'s
replay branch now just calls `handleHistoryForward()` — the exact same
step its own arrow takes — so solving an entry advances one position
toward the newest, and only solving the newest entry itself (one step past
it) returns to live. `Game.history.test.tsx`'s regression test builds a
three-entry archive, browses to the oldest, and solves through all three
in place to pin this down: `1/3 → 2/3 → 3/3 → live`, never jumping.

The arrows themselves are deliberately not part of `Header.tsx` — Header
owns the selection chip and the hint icon (concept 12.7), a different
concern from browsing what's already been solved, and its own left/right
slots are already spoken for (the update-hint pill, the hint icon). Placed
as their own row above the header instead (PO's own suggestion), sized to
the same width so it lines up rather than reading as an unrelated element.
The position indicator between the arrows is deliberately just digits
("2/8"), no translated label — the same reasoning Header's own mini
number/operator chips in its selection chip already follow: digits read
the same to a first-grader as to an adult, and need no i18n. The strip
renders nothing at all until at least one puzzle has been solved, rather
than showing two permanently-disabled arrows on a brand-new install with
nothing yet to browse.

**The footer sat glued to the board on anything taller than the game
itself, and that was `.page`'s own `justify-content: center` — reported
against a desktop window, fixed by splitting `.page` into two flex
children.** `Game.module.css`'s `.page` used to center HistoryNav, Header,
Board and the footer as one block; on a viewport much taller than that
block (any desktop window, not just an extreme one) that puts the whole
group — footer included — in the vertical middle of the screen, reading as
"the footer is right under the board" rather than as a page footer.
`Game.tsx` now wraps HistoryNav/Header/Board in their own `.gameArea` div;
`.gameArea` takes `flex: 1` (claims whatever vertical space `.footer`
doesn't need) and centers its own children inside that, so the game stays
exactly as centered as before while `.footer` — a normal flex item after
it — gets pushed down to sit near the bottom of the viewport instead.
Checked at both a 1280×900 desktop window (footer ~23px from the bottom
edge, was flush against the board before) and a 390×780 phone (nothing
changed there — `.gameArea`'s `flex: 1` barely grows on a short viewport,
so the whole page still reads the same as it did).

Steps 0–5 of concept section 16 are done and merged to `main`: vitest is set
up, `src/core/` (`expression.ts`, `evaluate.ts`, `solver.ts`, `puzzles.ts`,
`notation.ts`, `settings.ts`, `hints.ts`) is written and tested, and `src/ui/`
has a full game loop with hints. Puzzle generation is on-device (step 2b,
`puzzles.ts`'s `nextPuzzle()` — no bank, no bank JSON). **v1 is gone**: `src/main.tsx` is v2's own entry point now (`src/ui/Game.tsx`), and `index.html` — the site's actual root URL — serves it directly; there is no more `index-v2.html`/`main-v2.tsx` split.

**Step 6 (concept 16's "Feinschliff") is done: three animations (concept
13.3), landscape verified with no bug found, and the full PWA build
(concept 19).** All three pieces were built and checked against a real
browser (Playwright, real pointer events, both `prefers-reduced-motion`
states), not just against jsdom or a resized window.

*Landscape needed no code change at all.* Concept 12.6's promise —
portrait and landscape supported equally — was already true: `tokens.css`'s
`@media (min-aspect-ratio: 1/1)` switch (from the `--cell` confirmation
round above) already re-derives every size from the same aspect-ratio
signal, and the selection panel's own fixed-px sizing (independent of
`--cell`) is a normal fixed-size overlay, not a layout that was supposed to
scale with the board. Checked with real screenshots at two landscape
widths — an iPad (1194×834) and a phone rotated (780×390) — panel, board and
header all still fit with margin to spare in both. No follow-up work came
out of this, which is itself the finding worth recording: "verify claims
rather than estimating them" cuts both ways, and the honest result of
checking a claim is sometimes that it already held.

*The PWA build is `vite-plugin-pwa`'s `generateSW` mode, wired to the
same design tokens the CSS uses rather than a second, hand-maintained
palette.* `vite.config.ts`'s manifest (concept 19.1) sets
`background_color`/`theme_color` to `--zk-bg`/`--zk-accent`'s exact hex —
computed once from `tokens.css`'s own HSL values, since neither JSON nor a
static `<link>` tag can read a CSS custom property, with a comment at
`--hue`'s declaration listing the three places (`vite.config.ts`,
`index.html`, `pwa-assets.config.ts`) that now have to stay in sync by
hand if the hue ever changes. Icons (concept 19.2) are generated by
`@vite-pwa/assets-generator` from `public/crown.svg` — the same filled
vector crown the `--cell`-confirmation round above replaced the emoji
placeholder with — via a custom `pwa-assets.config.ts` rather than the
tool's bare `minimal` preset: the preset's maskable icon padded with a
*transparent* background, which is unsafe for actual masking (an Android
launcher's circular mask would show whatever sits behind the icon through
that padding), so the config overrides `maskable.resizeOptions` with an
explicit `background: '#fafbfc'` fill — confirmed correct with a real
circle-crop test in Playwright, not just by looking at the square PNG.
`useUpdateAvailable.ts` wraps `virtual:pwa-register/react`'s
`useRegisterSW()` so a waiting service-worker update surfaces as a small
pill in the header (`Header.tsx`, mirroring the hint button's own
positioning on the opposite side) rather than updating silently or never —
concept 19 doesn't specify the UI for this, so the choice was to always
tell the player rather than force a reload or hide it entirely. Verified
end to end: manifest validity, service-worker registration, and (the part
that actually matters for a PWA) that the app still loads and is playable
with the network disabled after a first visit.

*Animations are concept 13.3's three named behaviours, each with its own
mechanism, and building the third one surfaced a real architecture bug in
the second attempt at it.* "Chip hebt beim Greifen ab" (lifts on grasp) is
a CSS `@keyframes` scale on the ghost's *child* chip, not on `.ghost`
itself — `useDrag.ts` already writes `.ghost`'s own transform every frame
for position tracking, and a stylesheet transform on the same element
would either be overwritten or fight it, so the lift has to live one level
down, where its transform doesn't collide with anything. It's an
`animation`, not a `transition`: `GhostChip` is only ever in the DOM for
one drag (Board.tsx renders it conditionally on `drag.draggingItem`), so
it mounts fresh every time, and a `transition` never plays on mount — only
`animation-fill-mode: both` holds the scaled-up end state without
replaying. "Wege zwischen Ablage und Ausdruck laufen als FLIP-Animation
über die stabile `id`" is `useFlip.ts`: a `useLayoutEffect` that measures
every registered chip's rect before and after a render, and where a chip
moved, plays the difference back as a transform animation instead of
letting the chip simply appear in its new spot — riding the existing
stable-id scheme (`useGame.ts`'s `tray = createTray(numbers)` gives every
number one `id` for its whole lifetime, tray or field) so a number crossing
that boundary is genuinely one continuous thing to animate. Operators don't
get the tray→field half of this — the tray's operator/block chips are one
permanent chip per *type* (concept section 4), not per placement, so a
placed operator leaf's id never matches the tray chip it came from — but
still FLIP within the tree itself, where every leaf does keep one stable id
across a move. Both mechanisms respect `prefers-reduced-motion` on their
own, checked once via `matchMedia`.

The third behaviour — concept 6.7's bracket dissolve, "die Stege blenden ab
und die getönte Fläche fällt über rund 150 ms in den Feldhintergrund
zurück, während die Chips exakt stehen bleiben" — was built once inside
`Expression.tsx`, intercepting its own `onDissolveGroup` prop with local
state, and had to be rebuilt one level up after a grep of every
`onDissolveGroup` call site found that path was never reachable in the
real app: `Board.tsx`'s `handleTap` calls `game.onDissolveGroup` directly
for every drag-detected tap on a bracket edge, bypassing the prop
entirely — `Expression.tsx`'s own `onClick` only ever fires when
`dragHandlers` is absent, which happens in a handful of direct unit tests
of `<Expression>` and never in the running app, since Board.tsx always
wires drag. The fade would have compiled, passed its own component-level
tests, and simply never played for an actual player. Fixed by moving the
timing to where the trigger actually is: `Board.tsx` now owns a
`dissolvingId` piece of state and a `handleDissolve` wrapper — held under
`prefers-reduced-motion` skips the delay outright — and `Expression.tsx`
went back to a pure prop-passthrough, rendering whichever group id it's
told is fading via a new `dissolvingGroupId` prop rather than deciding for
itself. `Expression.module.css`'s `.dissolving` rules (the group's tinted
background and the bracket edges' opacity, both fading over the same
150ms) needed no change once the state moved — only *what supplies the
class* changed, not what the class does. Verified in a real browser by
tagging the live group DOM node and polling its attachment: it stays in
the DOM with `.dissolving` applied for the full ~150–185ms, then detaches
in one step, matching the spec exactly; under `prefers-reduced-motion` the
same node detaches within 30ms with no held state at all. Worth keeping in
mind for any future prop wired through `Expression.tsx`: its own `onClick`
paths are test-only scaffolding now, not what the real app calls, because
`useDrag`'s tap detection intercepts first.

**An i18n round added English and Russian, on a PO decision that closes
concept 12.7's own long-open question about the header-left menu icon —
there isn't one, and won't be.** `Settings.language` (concept section 11)
existed from the start but was completely inert — stored, never read.
Grepping the whole UI tree found the entire translatable surface to be
eight short strings, none of them taking a parameter or needing
pluralization (numbers here are small integers, rendered with plain
`String()` — no `Intl`/locale-sensitive formatting exists or was needed):
Header.tsx's three panel-row labels, its hint button's aria-label, the
uniqueOnly checkbox's sentence (split into three fragments around the one
word concept 15.6's own copy bolds, so the emphasis survives translation),
the "beliebig" single-band label, and Expression.tsx's "Klammer auflösen"
aria-label (used on both bracket edges). `core/i18n.ts` holds all of it —
a flat `Record<Language, Strings>` and a `t(language, key)` lookup;
`Record`'s own key parity means TypeScript refuses to build if any
language is missing a key. v1's own i18n (`src/i18n/`, deleted in step 5)
was a hand-rolled module-singleton-plus-listener-Set system built for
streaks/levels/hints text that no longer exists — not worth reviving, and
this round doesn't.
Math notation itself (×, ÷, −) never goes through this file — `notation.ts`'s
`operatorGlyph`/`formatResult` stay locale-invariant, matching how German,
English and Russian schooling all typeset it the same way.
**No language switcher exists, on purpose (PO decision, this round):**
`settings.ts`'s `detectLanguage()` reads `navigator.language` once, on a
player's first visit (`loadSettings()`'s `!raw` branch — a value already in
storage always wins over a fresh detection, so it only ever runs once per
player), and falls back to English — not German — for anything it doesn't
recognize; `DEFAULT_SETTINGS.language` changed from `'de'` to `'en'` to
match. Concept 12.7's header-left "Menü (Sprache, Regeln)" icon, reserved
but never built since v2 started (`Header.tsx`'s own comment used to say so
directly), stays unbuilt — a player's language is decided once, by their
browser, and that's the whole feature. `Game.tsx` also keeps
`document.documentElement.lang` in sync with it (a screen reader's own
pronunciation depends on that attribute, independent of anything this app
renders) — the one place a language value crosses into a DOM API rather
than a translated string. `index.html`'s static meta description stays
German-only: it's not part of gameplay, and rewriting a `<meta>` tag from
JS after the fact buys little a search engine would ever see.
`Board.tsx`/`Expression.tsx` both default their language-derived props to
German rather than requiring them everywhere, so the many existing tests
that don't care what language a label renders in didn't all need updating
— only `vitest.setup.ts` did, stubbing jsdom's own `navigator.language`
default (`'en-US'`) to `'de-DE'` so a fresh `<Game>` in a test keeps
exercising German exactly as every existing assertion already expected;
`core/i18n.test.ts` and `core/settings.test.ts`'s own `detectLanguage`
tests cover English/Russian/unsupported-locale detection directly,
independent of that stub.

**A negative-result-display round (PO decision) resolved the "Ein
negatives Ergebnis zeigt gar kein Ergebnis" open question: a wrong,
negative-result attempt now shows its own number instead of bare
notation.** `evaluate.ts`'s `evaluate()` still enforces concept 8's ≥0 rule
exactly as before — solver.ts, puzzles.ts and hints.ts all still need a
puzzle target, and a hint's own completion, to only ever be built around a
non-negative route, so nothing about generation or hinting changed. What
changed is `useGame.ts`'s own `result` (what `Board.tsx`'s readout reads):
it now comes from a new `evaluateAttempt()`, which is `evaluate()` minus
the `< 0 → null` step — same incomplete/division-by-zero handling,
negative kept instead of discarded. The submit comparison (`result ===
target`) needed no change: a target is always non-negative, so a negative
attempt already compared unequal under the old `evaluate()`, and still
does under the new one — only the *display* gained a case it didn't have
before. `notation.ts` gained `formatResult()` so a negative result prints
with the same typographic minus (`−`) the rest of the line already uses
for the `-` operator, rather than JS's plain `-` sitting in a different
glyph next to it.

**A result-on-submit round (PO decision) withheld the notation line's `=
result` until the player presses `=`, and moved the line itself.** Both
were live before: `Board.tsx`'s `readout` used to show `"${notation} =
${result}"` as soon as `useGame`'s `result` went non-null — which happens
the moment the tree is structurally complete (`isExpressionComplete`),
independent of the submit button entirely — so a player watched the answer
appear (and, once wrong, turn red) while still arranging chips, before ever
committing to the attempt. The line now reads `game.status !== 'idle' &&
game.result !== null` before appending `= result`; `status` already resets
to `'idle'` on every tree edit (a `'wrong'` verdict doesn't outlive the
expression it was about, from the earlier bug-fix round), so `status !==
'idle'` already means exactly "judged by a submit press and unedited
since" — no new state needed. The line also moved: it used to sit below
the tray (`Board.tsx`'s JSX had `<Tray>` before the readout `<div>`); it's
between the field row and the tray now, directly under what the player is
building. Both were plain JSX/condition changes — `.board`'s `flex-
direction: column` follows DOM order with no `order` property anywhere in
`Game.module.css`, so no CSS moved. `Hint.test.tsx`'s three assertions that
a hint press alone (never `=`) produced a `"… = N"` readout no longer hold
by construction — a hint completes the board the same way a tap does, and
never presses submit — so those tests now click the submit chip
(`screen.getByText('=', { selector: 'button' })`) before asserting the
result appears, matching what the UI actually requires now.

**A follow-up to the target-ranges-display round removed 3 numbers' XXL
band, on the PO's own hunch that it was "only solvable by multiplication"
— checked before building anything, per this file's own "verify claims
rather than estimating them" rule, and confirmed true for 3 numbers but
not for 4.** Measured against the exhaustive pool: everything a 3-number ×
selection holds above 150 is 96–100% pure-× (0% or, at most, 4% also using
+ or −) with 0–2 unique-solution puzzles per selection — the "only
solvable by multiplication" slice the PO suspected, and only 2–5% of the
pool for a mixed-operator selection. `generateBandTable.ts` caps 3 numbers'
× pool at 150 before computing anything (not merely displaying it that
way — those targets are never drawn), leaving three bands: "M" 1–50, "L"
51–100, "XL" 101–150 — no XXL. The same check on 4 numbers found the
opposite: everything above 300 there still needs + or − 65–90% of the time
and holds hundreds of unique-solution puzzles (7–11% of the pool for a
mixed selection) — not a boring slice, so 4 numbers keeps its fourth band
exactly as the target-ranges-display round shipped it (M/L/XL/XXL,
1–50/51–100/101–250/251–max). `Header.tsx`'s `BAND_LABELS` needed no new
entry for the 3-band case: `MULT_BAND_LABELS` (`['M','L','XL','XXL']`) is
indexed by position already, so a selection with 3 bands and one with 4
read `M`/`L`/`XL` off the same array without a lookup keyed by band count.

**The target-ranges-display round replaced how many bands a selection
offers, and how they're named — a direct PO decision, not a measured
recommendation this time.** The tertile/operator-floor search
`generateBandTable.ts` used to run (and `checkBands.ts` still explores, now
purely as historical record — see its own header) is gone from
`BAND_TABLE`'s generation entirely. In its place: two numbers always get one
band ("beliebig"), spanning the selection's whole `[min, max]`; three or
four numbers without × also get one band, same reasoning; three or four
numbers *with* × get four fixed bands regardless of selection — "M" 1–50,
"L" 51–100, "XL" 101–250, "XXL" 251–max, the same four cut points on every
× selection a player can reach; the exhaustive pool for every one of them
already crosses all three cut points, so "four bands, or sometimes three"
never actually happens in the reachable table — only unreachable
single-operator rows would ever ship fewer, and concept 15.6 already keeps
those off the panel. The reasoning: magnitude only ever tracked one
operator. − and ÷ on single digits barely move regardless of where a cut
lands, so slicing *any* selection by magnitude except a × one was never
buying the player anything — the earlier tertile split's whole failure mode
(a "großes Ziel" band mathematically unable to contain − or ÷) was a
symptom of slicing something that didn't need slicing, not a boundary
placement problem the search could fix. `Settings.band`/`PuzzleSettings.band`
widened from `0 | 1 | 2` to `0 | 1 | 2 | 3` to carry the fourth band;
`Header.tsx`'s `BAND_LABELS` collapsed to two rows — `1: ['beliebig']` and
`4: MULT_BAND_LABELS` (`['M', 'L', 'XL', 'XXL']`) — since the earlier
2-and-3-band cases this table used to have to name ("klein · groß" without
a "mittel" to imply) no longer exist. `bandCount`/`bandRow`/`reconcile`'s
clamping (`Math.min(settings.band, bands.length - 1)`) needed no changes —
it was already generic over how many bands a selection has.

**A second generation round (PO play-testing, a UX review, and four
measurement scripts) rebuilt what the generator offers. Three product
decisions came out of it, and each one changes what a puzzle can be.**

*The draw picks at random among equals now, and remembers shapes.* The PO's
report was "very many puzzles with the same patterns" and "−, ÷ and [] are
used very seldom". Measured against the exhaustive pool: 200 draws of
`4 Zahlen, alle vier, groß` produced `(n+n)×n−n` **91%** of the time, from a
pool holding 25 shapes whose most common is 19%. The cause was one
character. `nextPuzzle` kept the best candidate under a strict `>`
comparison, so every tie fell to whichever candidate `reachable()` happened
to enumerate first — and that order is fixed (flat arrangements before
bracketed ones, operator tuples in `+ − × ÷` order), so **brackets lost
every tie by construction**. It collects the tied candidates and picks at
random now. On top of that, `history.ts` keeps a second, shorter window of
recently-seen *shapes* (`SHAPE_LIMIT`, its own LocalStorage key), and the
draw prefers a shape it hasn't just shown. The puzzle window fixed the same
puzzle coming back; it had no opinion about the same *shape* coming back
with different digits, which is what a player actually notices.

*The operator preference is a floor now, not a ceiling.* `minDistinctOps`
was added so that picking four operators wouldn't feel like picking one
(`5 + 5 + 5 + 5`), by demanding as many distinct operators as a draw could
offer. It worked, and it was also the single biggest cause of the monotony:
demanding three distinct operators from four numbers admits **3 of those 25
shapes**. `operatorFloor` asks for two instead. Carved out where two is
impossible — two numbers have one operator position, and `{+,−}` always
keeps a whole-number one-operator route through `a−(b−c) = a−b+c`.
**`{×,÷}` is no longer carved out**, and that is a genuine change of fact,
not of policy: its identity `a÷(b÷c) = a·c÷b` goes through `b÷c`, which is
usually a fraction, so once fractional routes stopped counting, 14% of
three-number and 48% of four-number `×÷` puzzles genuinely need both.

*A target reachable only through a fraction is refused.* The evaluator only
ever checked the **final** result (concept 8), which made
`9 ÷ (1 ÷ 9 ÷ 9) = 729` a legal puzzle — the bracket is 1/81 and dividing by
it multiplies. Measured, it is not an edge case: wherever ÷ is selected
without ×, dividing by a fraction is the only route to a large target, so
**79% of `4 Zahlen, +÷, groß` has no whole-number solution at all** (72% for
`+−÷`, 59% for `−÷`). Two numbers is 0% everywhere, so the youngest players
were never exposed. `solver.ts`'s `staysWhole` decides it and `reachable`
reports it as `wholeSolution`; `puzzles.ts` refuses rather than ranks, on the
PO's decision that this is a correctness question for a first-grade audience
rather than a taste one. A related but weaker fault, the wasted chip
(`× 1`, `÷ 1`, `6 ÷ 6` — `hasIdentityStep`/`cleanSolution`), stayed a
preference; measured, it lands at 0–3% of draws anyway.

*A selection carries one to three bands, not always three.* Concept 15.5's
"kein einziges Band leer" understated the problem: a band is a slice of
target magnitude and magnitude is a proxy for operator, so with two single
digits — where `a − b ≤ 8` and `a ÷ b ≤ 9` while `a × b` reaches 81 — a
third band starting above 12 **cannot contain − or ÷ at all**, and searching
every legal boundary placement confirms no three-way split fixes it. That is
the PO's own `9 × 9 = 81` report, and no draw could ever have fixed it.
`BandRow.bands` is variable-length now; 28 of the 33 selections a player can
reach keep three bands, three get two, and `2 Zahlen` with three or four
operators gets one. `Header.tsx` names them by count (`beliebig` alone,
`klein · groß` for two), because calling the only band "klein" is a lie.
Boundaries are also restricted to numbers a player can read off a chip —
measured cost of that restriction: under a point of operator coverage.

Two consequences worth knowing before touching any of this:
**`uniqueOnlyAvailable` is band-aware**, because a selection can have
unique-solution puzzles and a band of it have none (`3 Zahlen, +÷` has 74
and not one in groß, which made `nextPuzzle` exhaust its attempts and throw
— the same blank screen `reconcile` already guarded, one level in). And
**concept 15.11's exception lists are now a map**, generated for every
selection whose uniqueOnly pool is thin enough to ship; `4 Zahlen, nur ÷`
lost its list entirely, because every unique-solution ÷ puzzle at four
numbers reaches its target through a fraction.

Measured after, on `3 Zahlen, alle vier` — the documented default (17.1),
and where the complaint actually lives, not the four-number case: the most
common shape falls from 62% to 8–12%, distinct shapes rise from 5 to 9–14,
brackets from 13% to 23–39%, ÷ from 6% to 22–62%. On `4 Zahlen, alle vier,
groß`: 91% → 7%, 3 → 25 distinct shapes. No repeats, in either.

**The four scripts this round produced are the reason any of it is
checkable**, and all of them import `solver.ts` rather than keeping a copy
of the model — which is what `generateBandTable.mjs` and
`dumpUniqueExceptions.mjs` did, and why they are gone:

| Script | What it answers |
|---|---|
| `scripts/checkVariety.ts` | What the draw actually produces, per selection and band, against the exhaustive pool — plus four counterfactual draw policies, so a fix can be measured before it is built |
| `scripts/checkBands.ts` | How many bands a selection can carry without starving an operator, and where the boundaries go |
| `scripts/checkFloorAndIdentity.ts` | Whether the operator floor starves a band, and how often puzzles waste a chip or leave the whole numbers |
| `scripts/generateBandTable.ts` | Emits `BAND_TABLE` and `UNIQUE_EXCEPTIONS` — regenerate and paste after any model change |
| `scripts/checkHintReachable.ts` | Whether the generator can draw a board the hint cannot start (onboarding round). Two passes: exhaustive over every multiset `randomNumbers` can produce, and over real `nextPuzzle` draws — the second is what covers uniqueOnly's exception-list branch, which never touches the pool path |

`scripts/varietyModel.ts` holds what the measurement scripts share. Its
self-test cross-checks its own `minDistinctOps` against `reachable()`, which
is what caught it drifting the moment the solver started ignoring fractional
routes — worth keeping, and worth copying if a fifth script appears.

**A bug-fix round after step 5 (PO play-testing plus a scripted browser
pass) changed four things about how the game feels, and each of them is
worth knowing before touching the code they live in.**

*A tap that moves is still a tap.* `useDrag`'s threshold was concept 5.1's
own 6px, which is below what a finger does — Android's touch slop is 8dp,
the browsers' click slop about 10px — so an ordinary tap became a
millimetre-long drag, was released over no drop zone, and did nothing at
all (a tray chip bounces back). That is the PO's "clicking on a number or
an operator did nothing, I had to click several times", and a scripted
pass confirmed the cliff is exact: 5px works, 6px is dead, on every
draggable surface. The threshold is 10px now *and* a drag that hit no zone
but was released back inside the chip it started from is reported as a
tap. Both are needed: the threshold alone only moves the cliff.

*The generator remembers.* An immediate repeat was not a flaw in the draw
but the absence of memory in it: the thinnest selection (two numbers, ×÷,
band klein) has 19 puzzles in its whole search space, so one draw in
nineteen returns the one still on screen. `core/history.ts` keeps the last
30 played (its own LocalStorage key) and `nextPuzzle` takes that window;
where the window is larger than the pool it falls back to the *least
recently played* candidate rather than throwing or picking blind, which
makes those selections cycle their pool (16–17 puzzles between sightings)
instead of repeating at random. **The bank was not brought back, and
shouldn't be**: a bank has exactly the same repeat behaviour without a
memory, and the pools it would ship are the ones measured here.

*The draw also asks the puzzle to need the operators the player picked.*
`reachable()` reports `minDistinctOps` and the draw prefers candidates that
need `min(#operators, n − 1)` of them, after preferring unseen ones. It
prefers rather than requires, for two exhaustively measured reasons: with
{+,−} or {×,÷} selected **no puzzle can need both operators at any number
count** (the bracket turns one into the other: `a−(b−c) = a−b+c`,
`a÷(b÷c) = a·c÷b`), and where mixing is possible it is sometimes scarce
enough that requiring it would trade this bug for the repeat one
("4 Zahlen, +−÷, mittel" would go from 3405 puzzles to 30). What it asks
for drops by one every few draws, which is what keeps the impossible case
cheap.

*Four silent no-ops were removed, and one crash.* `=` accepted an
expression that left numbers in the tray (concept 9.1 asks for two
conditions and only the gap was checked), so a puzzle whose target equals
one of its own numbers — about one three-number puzzle in four — was won
by tapping a single chip. A "wrong" verdict outlived the expression it
judged. An operator chip whose budget was spent looked live and did
nothing (it is muted now — *muted*, not `disabled`, because dragging one
onto a placed operator to replace it is a real gesture and a disabled
button gets no pointer events). And `useSettings` only re-checked
`uniqueOnly` in `toggleOp`, so carrying it across a change of the *number
count* could reach a selection whose search space has no unique-solution
puzzle at all ('3-3'/'4-3' in `puzzles.ts`'s table, from two numbers with
+− and uniqueOnly on): `nextPuzzle` then exhausts its attempts and throws,
which unmounts the app — and the impossible combination is persisted, so
every reload throws again. One `reconcile()` runs after every change and
once on load now. The same file no longer resets the band on a settings
change (PO: it is the player's own choice, and concept 15.5 gives every
selection all three bands).

*Two hint bugs, both from the Restlöser mishandling a board it had itself
half-built.* `completions` stopped as soon as the tray ran out and threw
away every board position further right, so a board reading `⬚ ÷ 5 + 7`
with one 5 left produced the single candidate `5` — a dead-end verdict one
tap from the solution — and, with the tray empty, *every* completed
expression came back as unreachable, which is why the dead-end border used
to sit around correct answers. And a `HintMove` of kind `block` carried no
position, so `applyHintMove` placed it where a *tap* would
(`nextBlockTarget`'s first eligible position): for `2 × (1+3)` from a board
reading `2 ×` it wrapped the `2` instead, leaving a board the hint could
never finish. The move names its index now and `useGame.placeBlockAt`
honours it — the placement a block *dragged* there makes, which is a
gesture the player has; only the tap path can't choose a position, and it
is unchanged. This qualifies the "a hint move is expressed as a tap"
paragraph below: the *number* and *operator* moves still are, the block
move is a drag.

Two findings from that pass were left alone deliberately, because the fix
shape depends on a product decision rather than on the code: chips are
focusable but keyboard-inert, and an expression whose result is negative
shows no `= …` at all. Both are written up as open questions under "Next
v2 step" above.

**Step 5 deleted v1 outright rather than leaving it running alongside v2 —
a product-owner decision (this section always flagged it as one), not a
default.** The three options put to the PO were: keep v1 live and drop v2 in
as a separate preview page indefinitely; delete v1's code but leave v2 at
its old `/index-v2.html` preview URL; or delete v1 *and* promote v2 to the
site's actual root. The PO chose the third. That made this step two things,
not one: **deletion** (`src/components/`, `src/hooks/`, `src/i18n/`,
`src/data/`, `src/index.css`, and the v1-only `src/core/` pieces —
`models/Level.ts` (and its 🔥-labelled group), `models/Puzzle.ts`,
`models/Token.ts`, `services/HintEngine.ts`, `services/ProgressService.ts`,
`services/PuzzleGenerator.ts`, `services/PuzzleValidator.ts`,
`services/ScoringService.ts`, `storage/IStorage.ts`, `storage/LocalStorage.ts`
— confirmed unreachable from `src/ui/`+`src/core/`'s v2 files by grepping
every import site first, not assumed from the file list) and **promotion**
(`src/main-v2.tsx` → `src/main.tsx`, `index-v2.html` → `index.html` — keeping
v1's old `index.html` metadata, the `crown.svg` favicon and German
description included, since none of that was v1-specific — and
`vite.config.ts`'s two-entry `rollupOptions.input` collapsed back to Vite's
own single-`index.html` default).

**The other two "Schritt 5" line items — emoji→SVG and v1-style copy —
turned out to already be done, not by this step but by construction.**
Grepping the whole tree for emoji before deleting anything found every hit
inside a file this step was about to delete anyway; `src/ui/` and v2's own
`src/core/` files had zero emoji to begin with (concept 13.2 was followed
from the start, not retrofitted). Same story for leftover v1 wording —
`src/ui/Header.tsx`'s copy ("Wie viele Zahlen", "Welche Rechenzeichen", …)
was written fresh for v2's own selection model (concept 15.6), never
touched v1's i18n strings, and grepping for `Level`/`Punkte`/`Streak`/
`Aufgeben` across `src/ui/`+`src/core/` turned up nothing outside the files
already being deleted. Worth knowing for the next time a "Schritt" table
entry looks like three tasks: it can turn out to be one task plus two
already-true assumptions, and checking that first is cheaper than doing
the other two blind.

**Step 4 built `core/hints.ts`'s Restlöser as a search over completions of
the tree already on the board, reusing the depth-1 model from
`solver.ts` rather than re-deriving it, but constrained to what a *tap* can
actually build.** Concept 10.2's "kanonische Fortsetzung" needed a concrete
way to complete the board's still-open positions (existing group interiors
and everything past the row's current length) from the tray's remaining
numbers, plus optionally a brand-new bracket — but concept 6.2's own rule
(growing a group past its two-number minimum is drag-only) means a
hint-introduced block can never be more than a pair: 10.3's presses are
literally taps (a block-chip tap, a number tap, an operator tap), so the
search only ever proposes a two-number group when it needs one, never a
three-number one. That has a real, verified consequence:
`hints.test.ts` pins down a case (`[1,1,1,3]` → 9 under `+`/`×`, the same
fact `solver.test.ts` already uses for "a three-number group reaches values a
flat chain cannot") where `solver.ts`'s `reachable()` — which the *generator*
uses, and which doesn't care how a group's shape gets built — says the
puzzle is solvable, but `computeHint` correctly reports a dead end, because
the only solution needs a 3-number block a hint press could never construct.
**That sentence used to continue "no puzzle actually generated hits this
today (the generator doesn't favor 3-number-only solutions)", and that was
wrong — measured, not argued, by `scripts/checkHintReachable.ts`.** At four
numbers it happens on **39.8% of real draws**, and on two selections it is
every single puzzle in the pool. See "Where v2 stands" for the numbers and
`scripts/checkHintReachable.ts`'s own header for the method. The gap
between what the game can generate and what the hint can walk a player
through is not hypothetical and never was.

**A hint move is expressed as a tap, and applying one reuses the exact
placement functions a manual tap already calls** (`useGame.ts`'s
`applyHintMove`, dispatching on `HintMove.kind` to `placeBlock`/
`placeNumber`/`placeOperator`) — not a bespoke tree-surgery path in
`hints.ts` itself. `core/hints.ts` only decides *what* the next move is;
*where* it lands (which root position, which group) is `nextOpenSurface`/
`nextBlockTarget`'s job, the same as any other tap. This is also why
`ui/useHint.ts` never stores a captured plan across presses: it recomputes
`computeHint` fresh from the current board on every press and always applies
`moves[0]` of that fresh result, so a player who places a chip by hand
between two hint presses still gets the right next move instead of a stale
one.

**The dead-end border and the hint's own "is there anything left to do"
check are not gated on `isExpressionComplete`.** Concept 2.1 gives the root
no minimum length — `useGame.test.ts` already documents "a single placed
number with nothing else is a 'complete' expression" as intentional — so
gating hint availability on that flag stopped the whole hint sequence dead
after exactly one placed number on a fresh board (caught by `Hint.test.tsx`
pressing all the way through and finding the readout stuck at `"6 = 6"`).
`useHint.ts` calls `computeHint` unconditionally instead; a fully, correctly
built expression just comes back with an empty, harmless move list.

**10.2's "kleinste bezüglich einer festen Ordnung" doesn't name the order,
only two criteria (fewest blocks, then document order) — any consistent
order satisfies the letter of that rule.** `computeHint`'s own choice:
generate candidates in a fixed recursion order (remaining tray leaves tried
in tray order, operators in a fixed `+ - × ÷` priority) and keep the first
one found at the minimum block count. One consequence worth knowing:
"fewest blocks" can pick a completely flat continuation over the textbook
`(6+2)×(9−3)` shape when a 0-block arrangement of the same four numbers also
reaches the target (`6×9−2×3=48` does) — `Hint.test.tsx`'s own "press
through to the end" test had to stop asserting the literal notation string
for exactly this reason, and only checks that the readout ends `= 48`.

**Step 3 split `Game.tsx` into `Game.tsx` (owns settings, generation, the
header) and `Board.tsx` (one puzzle, played) rather than growing the old file
in place.** `useGame.ts` never resets its own expression tree when its
`numbers` prop changes — it didn't need to while the puzzle was hardcoded — so
swapping in a new puzzle after a correct answer remounts `Board` under a fresh
`key` instead of trying to reset state in place; a stale tree still holding
the *previous* puzzle's leaf ids is exactly the kind of second source of truth
this codebase avoids elsewhere. `Game.test.tsx`'s interaction tests import
`Board` directly with a fixed puzzle, the same `(6+2)×(9−3)=48` they always
used — they're about tap/drag wiring, not which puzzle the generator drew,
and a random one would make them flaky for no reason.

**Settings persistence lives in `core/settings.ts`, kept mutually valid by
`ui/useSettings.ts`.** `core/settings.ts` itself only loads/saves/sanitizes
(concept section 11's five fields); the "last operator can't be deselected"
and "uniqueOnly turns itself off once the selection can't offer it" rules
(concept 15.6/15.7) are `useSettings.ts`'s job, one level up, because they
need `puzzles.ts`'s `uniqueOnlyAvailable()` to answer and `core/` doesn't
import across its own files that way.

**`Header.tsx` (concept 15.6/12.7) builds the selection chip, the panel it
opens, and — as of step 4 — the hint icon on the right.** The hamburger menu
concept 12.7 also puts on the left still isn't built: it belongs to
language/rules, which no step has scoped yet, and a button with no handler
would be worse than no button. The hint icon's own click handler can't live
in `Header.tsx` itself, though — the hint state it needs (`useHint`) lives
inside `Board.tsx`, a sibling, not a parent, of `Header` in `Game.tsx`'s
tree, and `Header` has to keep working across puzzle changes that remount
`Board` under a fresh `key`. `Board` exposes a `BoardHandle`
(`useImperativeHandle`: `{ pressHint }`) instead of lifting hint state
upward; `Game.tsx` holds the `ref` and wires the header button's `onClick`
straight to it. The dead-end border and the pulsing tray chips (10.3) never
leave `Board`'s own tree, so no state actually needs to flow the other way.

**The board still isn't concept 12.1's literal 5-column CSS grid** — `Board`'s
own layout note explains why flex-with-matched-widths was chosen over grid
back in step 2, and step 3 kept that choice rather than revisiting it:
`Header.tsx` sizes itself to the same total width
(`5 × --cell + 4 × --gap`) so the chip lines up over the board, which is the
part of 12.1 that's actually visible, without rewriting either component's
layout.

**Growing a group past its minimum shape to a third number (concept 6.2)
is a drag-only gesture, and it was silently un-hittable until a fourth
device round.** Tapping can't do it at all — the tap-after-a-complete-group
step is inherently ambiguous (does the next operator tap mean "grow this
block" or "start the next one beside it", concept 12.5's own worst case,
`(6+2)×(9−3)`, needs the *second* reading and is exercised by
`Game.test.tsx`'s tap-only playthrough) — so it stays root-priority for tap,
unchanged. Drag was supposed to reach it via `useDrag`'s 8px tolerance
around the group's own zero-width trailing frontier (`Expression.tsx`'s
`groupFrontier`), and the data layer and the tolerance math were both
correct in isolation. What broke it: the group's own wrapper is *also*
registered as a big `operand` drop zone spanning the whole block (concept
6.5, so dropping a number onto the block swaps with it), and that wrapper
geometrically *encloses* the frontier's zero-width `operator` zone. The
"a zone of the other kind squarely inside is a refusal, not a near miss"
rule (concept 3.2, `useDrag.ts`'s `hitTest`) doesn't distinguish a sibling
zone (what it was built for — an operand slot next to an operator slot)
from a container enclosing its own child zone, so it refused every point
inside the wrapper except the one exact pixel sitting on the frontier's
own line — no real finger or mouse lands on a single pixel on purpose.
Fixed in `useDrag.ts` by excluding an other-kind rect from the refusal set
when it encloses one of the current drag's own same-kind zones
(`encloses()`), leaving the genuine sibling case untouched. Confirmed with
real (unmocked) Playwright pointer drags before and after: every offset
from -15px to +15px around the frontier's true position bounced beforehand,
and only exactly 0px landed; afterwards the full ±8px tolerance band works,
matching the design's own stated intent.

**Fixing the frontier's hit-test immediately surfaced the next bug: moving
a single already-placed leaf into (or out of) a root position could
permanently strand its neighbor.** Once the frontier became reachable,
dragging the one leftover chip next to a block into that block — the
obvious next thing to try, and exactly what a player building `(6+2)×(9−3)`
from a flat `6+2×9` would do — grew the block correctly but left the
*other* half of the connecting pair sitting at the root with nothing to
pair it with. `useGame.ts`'s move logic clears a moved leaf's old root
position to `null` without touching its neighbor (concept 3's own
revision: a root-level return only ever clears the one slot) — correct and
harmless when there's still a spare chip of that kind to eventually refill
the gap, but the moment a puzzle's operator or operand budget is already
exactly spent (which it always is once anything is fully built — n numbers
always need exactly n−1 operators, no slack), the leaf that just moved was
the *only* thing that could ever fill its own old spot, and it can't fill
two positions at once. The expression becomes permanently uncompletable
with no visible explanation, breaking concept 6.8's "every gesture has an
inverse" promise (there's no gesture that gets you back).

Fixed with two changes in `useGame.ts`'s `onDrop`, both `core/expression.ts`
primitives: **`absorbIntoGroup`** (new) lets a root-level leaf dropped onto
an *adjacent* group bring its whole connecting (operand, operator) pair in
at once, rather than moving only the one chip that was dragged — checked
first, since it's what the player actually wants and it can never strand
anything (a pair always keeps a group's length odd). For the
non-adjacent case, **`wouldStrandAGap`** (new) refuses a move outright
when clearing the old position would leave a gap nothing could ever fill
again, rather than corrupting the tree — the same outcome as any other
invalid drop (the chip bounces back). Verified both in `useGame.test.ts`
(including that a genuinely unrelated, non-adjacent move without any spare
budget still refuses rather than corrupts) and end-to-end in
`Game.test.tsx` with real pointer drags, plus manually against the built
app: dragging either half of the connecting pair into an adjacent block
now always yields the *whole* thing wrapped, submit-ready.

**A block has two ends, and each bracket edge is one of them.** The fourth
device round reported two things that turned out to be one: an operator let
go on the *left* of a block vanished, while the right worked; and a number
let go on a block ended up with its operator on the far side of the
bracket, outside it. Both came from the block being registered as a single
wide `operand` zone spanning the whole thing — an operator found no
operator-kind zone in reach at all (no zone means concept 5's
"herausziehen", so the chip was removed), a number found that zone and got
6.5's old swap rule. And a single zone can't say *which end* was meant,
which is the whole content of the gesture. The bracket edges are the zones
now (`Expression.tsx`'s `blockZoneId`, `useDrag`'s new `'both'` zone kind —
a number and an operator mean the same thing there), the wrapper is not a
zone any more, and a chip dropped on one brings its connecting partner
along (`absorbPairIntoGroup`: the neighbour on the side facing the block,
so nothing is left outside with nothing to pair with) and lands at the end
it was dropped on, however far away it started. From the tray a chip has no
partner, so it brings an open slot for one (`insertLeafIntoGroup`), which
is how a block is prepared for a third number; `withinBudget` refuses the
drop that would open a slot the puzzle can never fill. Concept 6.2 and
decisions 3.4 have the round in full. Two of the PO's eleven examples had
"left"/"right" swapped against the rule the same report states; the PO
confirmed the labels were the slip, so the rule holds literally — the side
of the *drop*, always.

**Dropping onto a block's *interior* slot is deliberately unchanged** —
that aims at a slot, and `absorbIntoGroup`'s adjacent-only, both-halves-real
rule still guards it against stranding. The edges are the pair gesture; the
slots stay what they were.

**Moving a placed block now moves the brackets, not the content** (concept
6.5, revised by the PO in the same round — the old "a block is an operand,
so swap" row is gone). `moveGroup` re-encloses the same number of positions
at the drop anchor over the flattened row, so `(a×b)+c−d` dropped on `c` is
`a×b+(c−d)` and dropped on its own `b` is `a×(b+c)−d`; the block's own
interior is a valid target for the block itself (that's where the positions
one step over live), another block's never is. Concept 6.5's own worked
example, `(6+2)×9` → `6+(2×9)`, is one gesture now instead of two.

**A refusal is not a removal** (`useDrag`'s `DropOutcome`). Concept 3.2
makes a surface of the other kind a refusal rather than a near miss, but
that refusal was reported to the board as "no zone", which the board reads
as dragging the chip off the field — so releasing an operator 2px past the
bracket edge, on the number inside the block, deleted it. That is the same
"it removes the operator" from the report, one drop position over. `null`
now means only a release clear of the board; `'refused'` bounces.

**The geometry here was checked in a real browser, not only in jsdom**
(Playwright, real pointer events, 390px wide) — the whole point of the round
is where a finger lands relative to a 16px strip, and jsdom has no layout.
The left edge hits across an 11px band (its own width); left of that is the
dragged chip's own slot, right of it the first chip inside the block, and
every offset in that direction used to lose the chip. `Game.test.tsx`'s new
`layoutField()` mirrors the real stylesheet's rects — padding, and bracket
edges that overlap the outermost chip by a few px — rather than the flat
non-overlapping row `mockZoneRects` invents; all six new drag tests were run
against the pre-fix code first and fail there with the reported symptoms.

**Every open position is a drop target, and tapping fills the next free one
of its kind.** Concept 6.4 originally made the scaffold slots decorative; the
product owner overruled that on the second device test, because a chip that can
only land in the next free slot makes dragging pointless next to tapping. So a
number goes into any free number slot and an operator into any free operator
slot, skipping over positions that stay open behind it (`placeAt`), and a
trailing gap is never stored (`trimTrailingGaps` — a stored one makes a finished
expression look unfinished and greys out `=`). Tapping follows the same rule,
which is what `entwurf.html` always did and the app didn't: two numbers in a row
now work. Decisions 3.2 has the whole round, including the one place this goes
beyond the draft (an operator may be the first chip).

**Tapping returns a chip on the board and places one from the tray — and the
payload's `origin` is what tells those apart.** Dispatching on what a chip *is*
(`role`) rather than where it *is* meant a tapped operator on the board placed a
second one; numbers escaped it only because `onTapNumber` happens to check
whether the id is already placed. Decisions 3.3. The wiring between `useGame`
and `Tray`/`Expression` is the one place the hook tests can't see, so
`Game.test.tsx` is where that class of bug has to be caught — and a new test
there should be checked against the unfixed code before it counts.

**`spec/entwurf.html` has no drag at all** — only `click` handlers. Its
`.ghost` class is 6.4's pale scaffold slot, not a ghost following a finger. It
tells you how tapping should feel, never whether dragging works.

**Drag works, and was rebuilt to.** The first device test found it broken
outright on Android and desktop alike: the ghost was positioned by the
pointer's *travel* rather than its position (so it sat in the screen's corner),
it was an empty grey square rather than the chip you picked up, and the only
registered drop zone in an empty field rendered nothing at all — a 0x0 element
no finger can hit. Decisions section 3.1 has the full account, including the
two rules that came out of it: hit testing falls back to the nearest zone
within 28px, and the trailing frontier is one drop target covering the scaffold
and the empty rest of the field. Concept 6.4's scaffold is now wired up
(`useGame`'s `scaffoldOperands`/`scaffoldOperators`), which is what gives an
empty field anything to aim at. Two rules from that round were tightened in the
next one: a release inside a slot of the *other* kind is a refusal rather than a
near miss, and the tolerance is 8px, not 28 — every root position is registered
at its row's full height now, so tolerance only bridges the horizontal seams,
and 28px reached into the tray and broke "drag it out to remove it".

**Try it**: `index.html`/`src/main.tsx` mount `Game.tsx` — the site's actual
root now (step 5 promoted it; there is no more `index-v2.html` preview
split). Every push to `main` deploys it at `/zahlenkoenig/` — open it on a
real device rather than guessing from the code.

**There are no levels any more.** A1–F3 and E1 are gone; the player sets three
things directly — how many numbers, which operators, how big the target — and the
target range is *derived* from that selection rather than fixed, so no
combination can be empty. Concept section 15 is the whole story.

**The block chip in the tray is a single, permanent chip** (like an
operator's), not one placeholder per unit of budget — a revision made after
trying the first playable board (concept section 4, decisions section 3). It
disables once the puzzle's block budget (⌊n/2⌋) is used up.

The worst-case expression `(6+2) × (9−3)` fits the five-column grid with about
7px to spare at `spec/entwurf.html`'s own fixed `--cell: 64px` (once the empty
trailing frontier stopped charging the row's 4px `gap` for itself — see
decisions 3.1), which makes three proportions in section 12.5 load-bearing —
expression chips are smaller than tray chips, and bracket edges are absolutely
positioned so they cost no width. Changing any of them costs 50–80px and
overflows.

That 7px figure — and `entwurf.html`'s own live recomputation of it — only
ever covers that one fixed cell size. The app's own `--cell` is responsive
(concept 12.5's "Die Formel") and caps at a fixed 88px/104px on anything wider
than a phone; two full blocks actually overflowed there in practice (from
about 500px wide up — a tablet or a desktop window, not just an extreme),
clipping a sliver off the second bracket at the field's own rounded corner.
The cause: `tokens.css`'s `--gap` was a flat 10px, the one size in the whole
board that didn't scale with `--cell` (and didn't match 12.5's own `gap =
0.14 × cell` either) — invisible at the narrow width everything was tuned at,
fatal once `--cell` hit its cap. Fixed by scaling `--gap` with `--cell` too
(concept 12.5's addendum, decisions section 3 has the revision entry) — but
checking only `entwurf.html`'s own fixed-`--cell` reference, the way the
previous paragraph describes, would not have caught this class of bug; a
later session touching these proportions needs to check across the app's own
actual `--cell` range, not just `entwurf.html`'s one measurement.

## Conventions

- **Specifications are written in German**, matching the existing ones. Code,
  comments and commit messages are in English.
- **Verify claims rather than estimating them.** `scripts/checkVariety.ts` and
  `scripts/checkHintReachable.ts` are the pattern: each answers a design
  question exhaustively and is itself checked against known-good and
  known-bad cases before it reports anything. This applies to the documents
  too, **this file very much included** — `checkHintReachable.ts` exists
  because a confident sentence right here ("no puzzle actually generated
  hits this today") turned out to be wrong about 39.8% of four-number
  draws, and the two sentences in the v2.1 concept that a scan disproved in
  round 3 were the same lesson. A claim nobody has measured is a claim,
  however long it has sat in a document unchallenged.
- **Decide layout questions by looking.** Where two options exist, render both
  and compare, rather than arguing them in prose.
- **CI runs on every push and pull request** (`.github/workflows/ci.yml`):
  `npm ci`, `npm run build` (which is `tsc && vite build`, so it is the
  typecheck too) and `npm test`. About a minute in total — the suite is
  ~25s and the build ~6s — which is why it can afford to run on everything.
  `deploy.yml` runs the suite before building too, so a red `main` cannot
  reach the live site even on a direct push.
  **The exhaustive scripts in `scripts/` deliberately stay out of CI**:
  `checkHintReachable.ts`'s four-number pool pass alone takes ~17 minutes.
  What they check belongs in the suite as a *fast sample* instead —
  `Hint.test.tsx`'s "a freshly drawn puzzle never opens as a dead end"
  draws real puzzles from four selections and asserts the property on each
  in about a second. That is the pattern worth copying: the script proves
  the property exhaustively once, the test keeps it from regressing on
  every push.
- **Write the test as the invariant, not as the bug.** The dead-end
  regression tests assert "a freshly drawn puzzle never opens as a dead
  end", not "these selections produce walled puzzles" — so they keep
  passing, unchanged, once `completions` learns three-number groups. A test
  that encodes the bug has to be deleted by whoever fixes it, which is
  exactly when you would rather it still ran.
- The sibling project `funnygerman/flashcards` is the reference for house style:
  one aspect-ratio switch instead of width breakpoints, sizes derived from a
  single variable, `system-ui`, SVG icons rather than emoji, `100dvh` with no
  scrolling.

## Commands

```sh
npm install
npm run dev        # vite
npm run build      # tsc && vite build  (this is the typecheck too)
npm run preview
npm test           # vitest run — ~25s, the same command CI runs
```

**There is no puzzle bank and no command to regenerate one.** Generation is
on-device (`puzzles.ts`'s `nextPuzzle()`, step 2b); this section used to
document a `scripts/generatePuzzles.mjs` that wrote level banks into
`src/data/`, a directory step 5 deleted. That instruction outlived what it
described by several rounds, which is worth knowing about this file in
general: a command that still *reads* plausibly is not evidence it still
*does* anything.

The one generator that remains is not a scan but a source step:

```sh
npx tsx scripts/generateBandTable.ts   # emits BAND_TABLE + UNIQUE_EXCEPTIONS
```

Its output is pasted into `puzzles.ts` by hand, so it has to be re-run and
re-pasted after any change to the model underneath it.

`scripts/` holds three on-demand measurement tools besides that
(`checkVariety.ts`, `checkFloorAndIdentity.ts`, `checkHintReachable.ts`,
plus `checkBands.ts` kept as historical record and `varietyModel.ts` as
their shared helper). **They are investigation tools, not infrastructure** —
run one when you are changing the generator or the solver and have a
question, not on a schedule and not in CI. Four bank-era scripts that used
to sit here were deleted: two crashed on `src/data` files that no longer
exist, one regenerated a bank nothing loads, and the fourth's findings are
written out in full at `MAX_ATTEMPTS` in `puzzles.ts`, which is the only
place they ever decided anything.
