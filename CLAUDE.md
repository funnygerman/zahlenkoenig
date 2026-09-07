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

**Step 4** (concept section 16, "ein Tippknopf steht"): build the hint system
(concept section 10) — a `core/hints.ts` "Restlöser" that answers "is the
target still reachable from here?" and computes the **kanonische Fortsetzung**
(10.2: smallest continuation by block count, then document order, over the
remaining tray numbers and the tree already built), plus the one hint button
described in 10.3 (dead-end amber border, first press pulses the next
canonical block's two operands in the tray, every press after that places one
more chip of it). 10.4: pressing through to the end **is** giving up — no
separate button, and the solved board stays on screen instead of advancing
automatically (12.8's 1200ms auto-advance is for a *correct answer* only).
Concept section 18 ("Vor Schritt 4") says nothing is blocking this — the rule
is fully specified in section 10.

**If asked to "implement next step" with nothing more specific, this is the
step.** Before ending your turn: if concept section 16's stated result for
this step is actually true, update this section — in the same PR — to name
the *following* step instead, so the next session can start from the same
bare instruction. If the step isn't fully done, leave this section as it is;
don't advance the pointer on a partial result.

## Where v2 stands

Steps 0–3 of concept section 16 are done and merged to `main`: vitest is set
up, `src/core/` (`expression.ts`, `evaluate.ts`, `solver.ts`, `puzzles.ts`,
`notation.ts`, `settings.ts`) is written and tested, and `src/ui/` has a full
game loop. Puzzle generation is on-device (step 2b, `puzzles.ts`'s
`nextPuzzle()` — no bank, no bank JSON).

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

**The selection panel (`Header.tsx`, concept 15.6) only builds the chip and
the panel it opens** — not the hamburger/hint icons concept 12.7 also puts in
the header. Those belong to menu/language (never scoped to a step) and hints
(step 4, not built yet); a button with no handler would be worse than no
button, so they're left out rather than stubbed.

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

**Try it**: `index-v2.html`/`src/main-v2.tsx` mount `Game.tsx` standalone,
separate from v1's `src/main.tsx`. `npm run build` emits both, so every push
to `main` deploys the v2 preview too, at `/zahlenkoenig/index-v2.html` — open
it on a real device rather than guessing from the code.

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
