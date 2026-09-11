// Can the generator hand a player a board the hint cannot even start?
//
// The question, and why it is not rhetorical. `core/hints.ts`'s search only
// ever proposes **two**-number groups, because a hint move is expressed as a
// tap and growing a group past its two-number minimum is drag-only (concept
// 6.2). `solver.ts`'s `reachable()` — which the *generator* uses — has no
// such limit: it does not care how a group's shape gets built. So a puzzle
// whose only solutions need a three-number group is solvable to the
// generator and a dead end to the hint. `hints.test.ts` already pins one:
// `[1,1,1,3] → 9`.
//
// **What this script found, and what is still true.** `useHint`'s `deadEnd`
// used to be literally `hint === null`, so such a board opened already
// outlined as unsolvable on an untouched field. That half is fixed: the
// verdict is withheld wherever this search is blind to a solvable puzzle.
// What is *not* fixed is the gap itself — the hint budget is read from the
// same null continuation, so the hint button still does not appear on these
// boards at all. Re-run this after teaching `completions` three-number
// groups: the numbers below are what should go to zero.
//
// CLAUDE.md asserted it could not happen ("no puzzle actually generated hits
// this today — the generator doesn't favor 3-number-only solutions"). That
// sentence was written during step 4, before the generation round removed the
// strict `>` comparison that made **brackets lose every tie by
// construction**. An assertion about a draw that has since been rewritten is
// exactly the kind this repo's own convention says to re-measure rather than
// trust — see CLAUDE.md, "Verify claims rather than estimating them", and
// the v2.1 concept, two of whose confident sentences turned out to be
// wrong when someone finally measured them.
//
// Two passes, because they answer different halves:
//
//   POOL — exhaustive. Every multiset of digits `randomNumbers` can produce
//          (1..9, the generator's own range), every target each selection's
//          band admits, filtered exactly as `nextPuzzle` filters. This is
//          definitive for the main draw path: if the pool holds none, no
//          draw can produce one, however the ranking changes later.
//   DRAW — the real `nextPuzzle`, N times per selection. Covers the
//          uniqueOnly *exception-list* branch, which returns from a
//          precomputed table and never touches the pool path, and gives the
//          rate a player would actually meet rather than a worst case.
//
// Run with: npx tsx scripts/checkHintReachable.ts [options]
//   --draws N     draws per (selection, band) in the DRAW pass; default 300
//   --numbers 3,4 restrict to these number counts; default 2,3,4
//   --pool-only / --draw-only   run just one pass
//
// Like the other measurement scripts under `scripts/`, this imports
// `solver.ts` and `hints.ts` rather than keeping a copy of either model —
// the four scripts that did keep copies were deleted along with the
// bank-era questions they answered, and `varietyModel.ts`'s self-test
// exists because one of them drifted.

import { reachable } from '../src/core/solver'
import { computeHint } from '../src/core/hints'
import { createExpression, createTray, type Operator } from '../src/core/expression'
import { bandCount, bandRanges, nextPuzzle, uniqueOnlyAvailable, type PuzzleSettings } from '../src/core/puzzles'

const ALL_OPS: Operator[] = ['+', '-', '*', '/']
/** The generator's own digit range — `puzzles.ts`'s `randomNumbers`. */
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/** Whether the hint can make its first move on an empty board for this puzzle. */
function hintCanStart(numbers: number[], target: number, ops: Operator[]): boolean {
  return computeHint(createExpression(), createTray(numbers), target, ops, numbers.length) !== null
}

// ---------------------------------------------------------------- self-test
// The convention this repo holds every measurement script to: prove the
// instrument against a known-bad and a known-good case before it reports
// anything. Without this, a scan that silently always answers "fine" is
// indistinguishable from a scan that found nothing.
function selfTest(): void {
  // This self-test used to assert the opposite of its middle line, and it
  // is worth saying why it changed rather than quietly rewriting it.
  // `[1,1,1,3] → 9` was the canonical *known-bad* case: solvable per
  // `reachable()`, un-hintable because `(1+1+1)×3` needs a three-number
  // group. The three-number-group round taught `completions` to propose
  // one, so the case flipped — and this self-test is how that was noticed,
  // by refusing to report anything at all on the first run afterwards.
  // That is the whole point of holding every measurement script to a
  // known-good/known-bad pair: an instrument whose assumptions have gone
  // stale should fail loudly, not quietly return zero findings.
  //
  // It is now the known-*good* case, and a sharp one: it passes only if the
  // search can see three-number groups, which is exactly the capability
  // this script's numbers depend on. A zero below therefore means "nothing
  // walled", not "instrument blind".
  const solvable = reachable([1, 1, 1, 3], ['+', '*']).some(e => e.target === 9 && e.wholeSolution)
  const threeGroupHintable = hintCanStart([1, 1, 1, 3], 9, ['+', '*'])
  const flatHintable = hintCanStart([1, 2, 3, 4], 10, ['+', '*'])
  // Known bad: genuinely out of reach, so `computeHint` must say so. Keeps
  // the instrument able to return false at all — without this, a build in
  // which `hintCanStart` always answered true would sail through.
  const impossibleHintable = hintCanStart([1, 1, 1, 1], 1000, ['+', '-', '*', '/'])

  if (!solvable || !threeGroupHintable || !flatHintable || impossibleHintable) {
    throw new Error(
      `self-test failed (solvable=${solvable} threeGroup=${threeGroupHintable} flat=${flatHintable} ` +
      `impossible=${impossibleHintable}) — the instrument is wrong, so its findings mean nothing. ` +
      'Fix this before reading anything below.',
    )
  }
  console.log('self-test ok: three-number groups are visible to the search; an unreachable target still reports null\n')
}

// ------------------------------------------------------------------ helpers
function opSubsets(): Operator[][] {
  const out: Operator[][] = []
  // At least two: concept 15.6 (revised) — the panel will not let a player
  // deselect down to one, so a single-operator selection is unreachable.
  for (let mask = 1; mask < 16; mask++) {
    const s = ALL_OPS.filter((_, i) => mask & (1 << i))
    if (s.length >= 2) out.push(s)
  }
  return out
}

/** Every sorted multiset of `count` digits — what `randomNumbers` can produce, up to order. */
function multisets(count: number): number[][] {
  const out: number[][] = []
  const walk = (start: number, acc: number[]) => {
    if (acc.length === count) { out.push([...acc]); return }
    for (let i = start; i < DIGITS.length; i++) walk(i, [...acc, DIGITS[i]])
  }
  walk(0, [])
  return out
}

const label = (n: number, ops: Operator[], band: number, uniq: boolean) =>
  `${n}n ops=${ops.join('')} band=${band}${uniq ? ' uniqueOnly' : ''}`

interface Selection { numbers: 2 | 3 | 4; ops: Operator[]; band: number; uniqueOnly: boolean }

function selections(counts: readonly (2 | 3 | 4)[]): Selection[] {
  const out: Selection[] = []
  for (const numbers of counts) {
    for (const ops of opSubsets()) {
      for (const uniqueOnly of [false, true]) {
        for (let band = 0; band < bandCount(numbers, ops); band++) {
          // Exactly the gate `useSettings.reconcile` applies, so this scans
          // what a player can actually select and nothing else.
          if (uniqueOnly && !uniqueOnlyAvailable(numbers, ops, band as 0 | 1 | 2 | 3)) continue
          out.push({ numbers, ops, band, uniqueOnly })
        }
      }
    }
  }
  return out
}

// ---------------------------------------------------------------- pool pass
function poolPass(counts: readonly (2 | 3 | 4)[]): number {
  console.log('POOL — exhaustive over every draw the generator could make\n')
  let findings = 0

  for (const numbers of counts) {
    const sets = multisets(numbers)
    for (const ops of opSubsets()) {
      const ranges = bandRanges(numbers, ops)
      // computeHint depends only on (numbers, target, ops), and the bands of
      // one selection share both — so answer once per pair and reuse.
      const hintable = new Map<string, boolean>()
      // [band][uniqueOnly] → counts
      const total = ranges.map(() => [0, 0])
      const walled = ranges.map(() => [0, 0])
      const examples = ranges.map(() => [[], []] as string[][])

      for (const set of sets) {
        for (const e of reachable(set, ops)) {
          // nextPuzzle's own refusal, not a ranking: a target whose only
          // route runs through a fraction is never offered.
          if (!e.wholeSolution) continue
          for (let band = 0; band < ranges.length; band++) {
            const [lo, hi] = ranges[band]
            if (e.target < lo || e.target > hi) continue
            const key = `${set.join(',')}=${e.target}`
            let ok = hintable.get(key)
            if (ok === undefined) { ok = hintCanStart(set, e.target, ops); hintable.set(key, ok) }
            for (const uniq of [0, 1]) {
              if (uniq === 1 && !e.uniqueSolution) continue
              total[band][uniq]++
              if (!ok) {
                walled[band][uniq]++
                if (examples[band][uniq].length < 3) examples[band][uniq].push(`[${set}]→${e.target} ${e.pattern}`)
              }
            }
          }
        }
      }

      for (let band = 0; band < ranges.length; band++) {
        for (const uniq of [0, 1]) {
          if (walled[band][uniq] === 0 || total[band][uniq] === 0) continue
          if (uniq === 1 && !uniqueOnlyAvailable(numbers, ops, band as 0 | 1 | 2 | 3)) continue
          findings++
          const pct = (100 * walled[band][uniq] / total[band][uniq]).toFixed(2)
          console.log(
            `  ${label(numbers, ops, band, uniq === 1).padEnd(34)} ` +
            `${String(walled[band][uniq]).padStart(5)}/${String(total[band][uniq]).padEnd(6)} (${pct.padStart(5)}%)  e.g. ${examples[band][uniq].join(' | ')}`,
          )
        }
      }
    }
    console.log(`  ${numbers} numbers: done`)
  }

  console.log(findings === 0
    ? '\n  No selection\'s pool contains a board the hint cannot start.\n'
    : `\n  ${findings} selection/band combinations can contain one.\n`)
  return findings
}

// ---------------------------------------------------------------- draw pass
function drawPass(counts: readonly (2 | 3 | 4)[], draws: number): number {
  console.log(`DRAW — ${draws} real nextPuzzle() draws per selection\n`)
  let walledTotal = 0
  let drawTotal = 0

  for (const sel of selections(counts)) {
    const settings = { ...sel, band: sel.band as 0 | 1 | 2 | 3 } as PuzzleSettings
    let walled = 0
    const examples: string[] = []
    for (let i = 0; i < draws; i++) {
      let p
      // A selection the panel offers should never throw (concept 15.6/15.9),
      // but a throw here is a finding of its own rather than a crash.
      try { p = nextPuzzle(settings, [], []) } catch (err) {
        console.log(`  ${label(sel.numbers, sel.ops, sel.band, sel.uniqueOnly)}: THREW — ${(err as Error).message}`)
        break
      }
      drawTotal++
      if (!hintCanStart(p.numbers, p.target, sel.ops)) {
        walled++; walledTotal++
        if (examples.length < 3) examples.push(`[${p.numbers}]→${p.target}`)
      }
    }
    if (walled > 0) {
      console.log(
        `  ${label(sel.numbers, sel.ops, sel.band, sel.uniqueOnly).padEnd(34)} ` +
        `${String(walled).padStart(4)}/${draws}  e.g. ${examples.join(' | ')}`,
      )
    }
  }

  console.log(walledTotal === 0
    ? `\n  0 of ${drawTotal} draws produced a board the hint cannot start.\n`
    : `\n  ${walledTotal} of ${drawTotal} draws (${(100 * walledTotal / drawTotal).toFixed(3)}%) produced one.\n`)
  return walledTotal
}

// ---------------------------------------------------------------------- main
const argv = process.argv.slice(2)
const arg = (name: string) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}
const draws = Number(arg('--draws') ?? 300)
const counts = (arg('--numbers')?.split(',').map(Number) ?? [2, 3, 4]) as (2 | 3 | 4)[]
const poolOnly = argv.includes('--pool-only')
const drawOnly = argv.includes('--draw-only')

selfTest()
const started = Date.now()
let findings = 0
if (!drawOnly) findings += poolPass(counts)
if (!poolOnly) findings += drawPass(counts, draws)
console.log(`${findings === 0 ? 'CLEAN' : 'FINDINGS'} — ${((Date.now() - started) / 1000).toFixed(1)}s`)
