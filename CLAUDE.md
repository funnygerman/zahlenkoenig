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
| `spec/entwurf.html` | The clickable draft. Open it in a browser: a playable board with the selection panel, plus the studies that settled bracket shape, block contrast and the block icon. It also measures the worst-case width live. |

Entries marked **PO** in the decisions document were chosen by the product owner
directly. They are instructions, not recommendations; don't revise them without
asking.

The v1 documents (`zahlenkoenig-anforderungen.md`, `zahlenkoenig-spezifikation.md`)
describe the app as it currently stands. Where they disagree with the v2 concept,
the v2 concept wins for anything being built now.

## Next v2 step

**Step 6** (concept section 16, "Feinschliff"): animations, landscape
(Querformat), and the PWA work in concept section 19. Concept section 18's
"Vor Schritt 6" names two things not yet done, and both block starting this
step for real:

| Fehlt | Warum es blockiert |
|---|---|
| **Die beiden Konstanten in `--cell`** (12.5's `88px`/`104px` caps) | Provisional, "am Gerät zu bestätigen" against the worst case (four numbers, three operators, two blocks) — needs a real device, not just a viewport resize. |
| **App-Icons in allen Größen** | Concept 19.2 names the sizes; they're generated from `public/crown.svg` (13.2), which doesn't yet have a filled, small-icon-legible version — the current one is unfilled/line art, tuned as a favicon, not as a 48×48 home-screen icon. |

Resolve those first (or bring back device-confirmed numbers and a proper
filled crown), then work through 19's manifest/icons/offline requirements
alongside the animation and landscape work 16's own table groups into this
one step.

**If asked to "implement next step" with nothing more specific, this is the
step** — but start with the two blockers above, not the animation/PWA work
itself. Before ending your turn: if concept section 16's stated result for
this step is actually true, update this section — in the same PR — to name
the *following* step instead (there isn't one currently listed past 6; check
whether concept section 16 has grown one). If the step isn't fully done,
leave this section as it is; don't advance the pointer on a partial result.

## Where v2 stands

Steps 0–5 of concept section 16 are done and merged to `main`: vitest is set
up, `src/core/` (`expression.ts`, `evaluate.ts`, `solver.ts`, `puzzles.ts`,
`notation.ts`, `settings.ts`, `hints.ts`) is written and tested, and `src/ui/`
has a full game loop with hints. Puzzle generation is on-device (step 2b,
`puzzles.ts`'s `nextPuzzle()` — no bank, no bank JSON). **v1 is gone**: `src/main.tsx` is v2's own entry point now (`src/ui/Game.tsx`), and `index.html` — the site's actual root URL — serves it directly; there is no more `index-v2.html`/`main-v2.tsx` split.

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

Two findings from that pass were left alone deliberately, and are open
questions for the PO rather than bugs with an obvious fix: chips are
focusable but keyboard-inert (`onClick` is dropped wherever drag handlers
are wired, and `useDrag` listens to pointer events only — concept 5's own
"hält aber Sechsjährige, Tastaturbedienung und Screenreader im Spiel"
wants otherwise), and an expression whose result is negative shows no `=
…` in the notation line at all, because `evaluate` returns `null` for it
(concept 8: "das Endergebnis muss ≥ 0 sein"), so a finished expression can
look unfinished.

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
No puzzle actually generated hits this today (the generator doesn't favor
3-number-only solutions), but it's a real gap between what the game can
generate and what the hint can walk a player through, worth knowing about
before either side changes.

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
- **Verify claims rather than estimating them.** `scripts/checkDepth1.mjs` and
  `scripts/checkBankShapes.mjs` are the pattern: each answers a design question
  exhaustively and is itself checked against known-good and known-bad cases
  before it reports anything. This applies to the specs too — `checkBankShapes`
  exists because two confident sentences in the v2.1 concept turned out to be
  wrong.
- **Decide layout questions by looking.** Where two options exist, render both
  and compare, rather than arguing them in prose.
- The sibling project `funnygerman/flashcards` is the reference for house style:
  one aspect-ratio switch instead of width breakpoints, sizes derived from a
  single variable, `system-ui`, SVG icons rather than emoji, `100dvh` with no
  scrolling.

## Commands

```sh
npm install
npm run dev        # vite
npm run build      # tsc && vite build
npm run preview
```

`node --max-old-space-size=512 scripts/generatePuzzles.mjs` regenerates the
puzzle bank; it skips files that already exist.
