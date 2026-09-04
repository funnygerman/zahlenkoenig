# Zahlenkönig

A German mathematical puzzle game for mobile (PWA). The player gets 2–4 numbers
and a target, and must reach the target using every number exactly once. Audience
ranges from first-graders to adult maths enthusiasts.

Deployed to GitHub Pages from `main` via Actions.

## Read this before working on v2

v2 is a re-architecture of the input, planned in detail and **not yet
implemented**. Two documents carry it, and both are worth reading before
proposing anything:

| File | What it is |
|---|---|
| `spec/zahlenkoenig-v2-konzept.md` | **What** v2 is. Data model, block interaction, layout, design system, implementation order. |
| `spec/zahlenkoenig-v2-entscheidungen.md` | **Why**, and **what was already rejected**. Read this before suggesting an approach — a lot of plausible ideas have been considered and turned down for stated reasons. |

Entries marked **PO** in the decisions document were chosen by the product owner
directly. They are instructions, not recommendations; don't revise them without
asking.

The v1 documents (`zahlenkoenig-anforderungen.md`, `zahlenkoenig-spezifikation.md`)
describe the app as it currently stands. Where they disagree with the v2 concept,
the v2 concept wins for anything being built now.

## Where v2 stands

Planning is complete; no application code has been written. Section 16 of the
concept document lists the implementation steps, section 18 what is still
missing before each one.

Start at step 0: **add vitest** (`*.test.ts` beside the sources, `npm test`),
then write `src/core/` — `expression.ts`, `evaluate.ts`, `solver.ts` — pure
TypeScript with no React imports. First property to test: `wrap` and `dissolve`
are exact inverses.

**There are no levels any more.** A1–F3 and E1 are gone; the player sets three
things directly — how many numbers, which operators, how big the target — and the
target range is *derived* from that selection rather than fixed, so no
combination can be empty. Concept section 15 is the whole story;
`models/Level.ts` and `LEVELS` disappear with it.

Two things to know before touching the puzzle bank:

- **The v1 generator does not implement v2's rule.** It counts brackets; v2
  counts nesting. At `maxBracketDepth: 1` it never emits two sibling groups
  `(1+1)×(1+2)` or a three-number group `(1+1+1)×3` — the two shapes v2's whole
  block interaction is built on. `node scripts/checkBankShapes.mjs` shows it.
  So the banks get regenerated (concept section 15), and `generatePuzzles.mjs`
  gets rewritten on the model in `checkDepth1.mjs`, which the solver shares.
- **The bank gains two things:** a 15-bit operator vector per puzzle (only 61
  distinct values exist, so one byte), and a 45-row lookup table of band
  boundaries and bank sizes — 2.7 KB, so the selection never has to solve
  anything on the device.

One layout question is open and affects step 2: the worst-case expression
`(6+2) × (9−3)` does not fit the five-column grid. Section 12.5 has the measured
numbers; section 17 has the two ways out.

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
