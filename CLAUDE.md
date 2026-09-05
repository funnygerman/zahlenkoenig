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

**Step 3** (concept section 16, "vollständige Spielschleife"): wire
`puzzles.ts`'s `nextPuzzle()` into `Game.tsx` in place of its current
hardcoded `(6+2)×(9−3)=48`, build the selection/settings UI (concept section
15), and give the notation line real precedence-aware notation instead of
just the evaluated result. `onSubmit`'s `=` check already exists in
`useGame.ts`. Concept section 18 lists what else this step needs first.

**If asked to "implement next step" with nothing more specific, this is the
step.** Before ending your turn: if concept section 16's stated result for
this step is actually true, update this section — in the same PR — to name
the *following* step instead, so the next session can start from the same
bare instruction. If the step isn't fully done, leave this section as it is;
don't advance the pointer on a partial result.

## Where v2 stands

Steps 0–2 of concept section 16 are done and merged to `main`: vitest is set
up, `src/core/` (`expression.ts`, `evaluate.ts`, `solver.ts`, `puzzles.ts`) is
written and tested, and `src/ui/` has a playable board (`Game.tsx`, wiring
`useGame.ts` + `useDrag.ts` + `Chip`/`Tray`/`Expression`). Puzzle generation is
already on-device (step 2b, `puzzles.ts`'s `nextPuzzle()` — no bank, no
bank JSON; the "two things to know before touching the puzzle bank" this
section used to warn about are gone, not just moved) — `Game.tsx` just doesn't
call it yet.

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
7px to spare (7.7px measured in the app at 390px wide, once the empty trailing
frontier stopped charging the row's 4px `gap` for itself — see decisions 3.1),
which makes three proportions in section 12.5 load-bearing —
expression chips are smaller than tray chips, and bracket edges are absolutely
positioned so they cost no width. Changing any of them costs 50–80px and
overflows. `spec/entwurf.html` recomputes the slack on every render and turns
red if it goes negative, so a later session finds out immediately. `Game.tsx`
doesn't build the 5-column grid yet — that needs `Header.tsx` and the
selection panel, which come with step 3.

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
