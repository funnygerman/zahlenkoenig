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

Planning is complete; no application code has been written. The next step is
`src/core/` — `expression.ts`, `evaluate.ts`, `solver.ts` — pure TypeScript with
no React imports, testable from the terminal before any UI exists. `wrap` and
`dissolve` are exact inverses, which is a property worth testing directly.

Four questions are deliberately open; they are listed in section 16 of the
concept document.

**Section 17 lists what is missing before each implementation step.** The one
that blocks the very first step: there is no test runner in this repository yet,
and `core/` is specified as terminal-testable. Add vitest before writing
`expression.ts`, and start with the property that `wrap` and `dissolve` are exact
inverses.

## Conventions

- **Specifications are written in German**, matching the existing ones. Code,
  comments and commit messages are in English.
- **Verify claims rather than estimating them.** `scripts/checkDepth1.mjs` is the
  pattern: it answers a design question exhaustively and is itself checked
  against known-good and known-bad cases. Run it with `node scripts/checkDepth1.mjs`.
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
