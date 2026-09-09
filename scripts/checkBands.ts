// How many target ranges ("Bänder", concept 15.5) a selection can carry
// before the range itself starts choosing the operator for the player.
//
// The PO's report: "− , ÷ and [] will be used very seldom", with
// "2 Zahlen, alle Rechenzeichen, grosses Ziel" producing nothing but
// `a × b`. checkVariety.ts shows the draw is not at fault there — the
// pool the band selects is 0% − and 0% ÷ — so the question moves to the
// band boundaries, and to the PO's own proposal: fewer ranges for small
// number counts, one range when the maximum target is small.
//
// A band is currently a tertile of target magnitude. With two single
// digits, − reaches at most 8 and ÷ at most 9, while × reaches 81 — so a
// tertile split puts − and ÷ entirely inside the lowest band and leaves
// the top band mathematically unable to contain them. This script measures
// that for every selection, and searches for the boundaries that would
// avoid it.
//
// Run with: npx tsx scripts/checkBands.ts [--threshold 10] [--json FILE]

import { bandRanges } from '../src/core/puzzles.ts'
import type { Operator } from '../src/core/expression.ts'
import {
  ALL_OPS, GLYPH, maskOfPattern, multisets, opSubsets, selfTestModel, shapesOf,
} from './varietyModel.ts'

/** One (multiset, target) pair of the pool, reduced to what a band decision needs. */
interface Entry {
  target: number
  repMask: number   // operators the representative solution uses
  anyMask: number   // operators some solution uses
  needsBlock: boolean
}

function poolOf(numbers: 2 | 3 | 4, ops: Operator[]): Entry[] {
  const out: Entry[] = []
  for (const nums of multisets(numbers)) {
    for (const [target, shape] of shapesOf(nums, ops)) {
      out.push({ target, repMask: maskOfPattern(shape.pattern), anyMask: shape.anyOps, needsBlock: shape.minBlocks > 0 })
    }
  }
  out.sort((a, b) => a.target - b.target)
  return out
}

/**
 * Prefix sums over the pool sorted by target, so the share of any
 * contiguous target range can be read off in constant time — which is what
 * makes the exhaustive boundary search below affordable (all ~500k pairs
 * of cut points for three bands).
 */
interface Prefix {
  entries: Entry[]
  count: number[]        // count[i] = entries in [0, i)
  perOp: number[][]       // perOp[o][i]
  blocks: number[]
}

function prefixOf(entries: Entry[]): Prefix {
  const n = entries.length
  const count = new Array(n + 1).fill(0)
  const perOp = ALL_OPS.map(() => new Array(n + 1).fill(0))
  const blocks = new Array(n + 1).fill(0)
  for (let i = 0; i < n; i++) {
    count[i + 1] = count[i] + 1
    blocks[i + 1] = blocks[i] + (entries[i].needsBlock ? 1 : 0)
    for (let o = 0; o < 4; o++) perOp[o][i + 1] = perOp[o][i] + ((entries[i].repMask & (1 << o)) ? 1 : 0)
  }
  return { entries, count, perOp, blocks }
}

/** The share of [from, to) using each selected operator, and the minimum of those shares. */
function coverage(p: Prefix, from: number, to: number, opIdx: number[]): { shares: number[]; min: number; size: number; blocks: number } {
  const size = to - from
  if (size === 0) return { shares: opIdx.map(() => 0), min: 0, size: 0, blocks: 0 }
  const shares = opIdx.map(o => (p.perOp[o][to] - p.perOp[o][from]) / size)
  return { shares, min: Math.min(...shares), size, blocks: (p.blocks[to] - p.blocks[from]) / size }
}

/**
 * Cut points must fall between two different target values — a band is
 * shown to the player as a range, so two bands may not share a target.
 * (The current table does share them: `generateBandTable.mjs` slices the
 * sorted target list by index and takes `pairs[from]`..`pairs[to-1]`, so a
 * value repeated across a tertile boundary lands in both bands. The
 * `overlap` figure in the report is how many pool entries that
 * double-counts.)
 */
function legalCuts(entries: Entry[]): number[] {
  const cuts: number[] = []
  for (let i = 1; i < entries.length; i++) if (entries[i].target !== entries[i - 1].target) cuts.push(i)
  return cuts
}

/** The best k-band split by "worst operator in any band", subject to no band being tiny. */
function bestSplit(p: Prefix, opIdx: number[], k: number, minShare: number): { min: number; bounds: [number, number][] } | null {
  const n = p.entries.length
  const cuts = legalCuts(p.entries)
  const minSize = Math.floor(n * minShare)
  const ranges = (bounds: number[]) => {
    const out: [number, number][] = []
    for (let i = 0; i < bounds.length - 1; i++) out.push([bounds[i], bounds[i + 1]])
    return out
  }
  const score = (bounds: number[]) => {
    let worst = Infinity
    for (const [a, b] of ranges(bounds)) {
      const c = coverage(p, a, b, opIdx)
      if (c.size < minSize) return -1
      worst = Math.min(worst, c.min)
    }
    return worst
  }

  let best: { min: number; bounds: [number, number][] } | null = null
  const consider = (bounds: number[]) => {
    const sc = score(bounds)
    if (sc < 0) return
    if (!best || sc > best.min) best = { min: sc, bounds: ranges(bounds) }
  }

  if (k === 1) consider([0, n])
  else if (k === 2) for (const c of cuts) consider([0, c, n])
  else for (let i = 0; i < cuts.length; i++) for (let j = i + 1; j < cuts.length; j++) consider([0, cuts[i], cuts[j], n])
  return best
}

function label(p: Prefix, a: number, b: number): string {
  return `[${p.entries[a].target},${p.entries[b - 1].target}]`
}

// ------------------------------------------------------------- self-test

function selfTest(): void {
  selfTestModel()
  const fail = (m: string) => { throw new Error(`checkBands self-test: ${m}`) }
  const eq = (a: unknown, b: unknown, w: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${w}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)
  }

  // A hand-built pool: three targets, two with +, one with ×.
  const entries: Entry[] = [
    { target: 1, repMask: 0b0001, anyMask: 0b0001, needsBlock: false },
    { target: 2, repMask: 0b0001, anyMask: 0b0001, needsBlock: true },
    { target: 3, repMask: 0b0100, anyMask: 0b0100, needsBlock: false },
  ]
  const p = prefixOf(entries)
  eq(coverage(p, 0, 3, [0, 2]).shares, [2 / 3, 1 / 3], 'coverage shares over the whole pool')
  eq(coverage(p, 0, 2, [0, 2]).min, 0, 'a band with no × scores 0 for ×')
  eq(coverage(p, 0, 3, [0]).blocks, 1 / 3, 'bracket share')
  eq(legalCuts(entries), [1, 2], 'cuts between distinct targets')
  // Splitting this pool in two always leaves one band without + or without ×.
  eq(bestSplit(p, [0, 2], 2, 0)!.min, 0, 'no two-band split of this pool keeps both operators')
  eq(bestSplit(p, [0, 2], 1, 0)!.min, 1 / 3, 'one band keeps both')

  // Known-bad: a repeated target may not be cut through.
  const dup: Entry[] = [
    { target: 5, repMask: 1, anyMask: 1, needsBlock: false },
    { target: 5, repMask: 4, anyMask: 4, needsBlock: false },
  ]
  eq(legalCuts(dup), [], 'a repeated target offers no legal cut')

  // Known-good, against the live table: the shipped 2-number all-ops
  // bands must reproduce the symptom this script exists to explain.
  const [, , gross] = bandRanges(2, ALL_OPS)
  if (gross[0] <= 9) fail(`expected the 2-number gross band to start above 9, got ${gross[0]}`)

  console.log('self-test: all checks passed')
}

// ----------------------------------------------------------------- main

const argv = process.argv.slice(2)
const val = (name: string, fb: string) => {
  const i = argv.indexOf(name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fb
}
if (argv.includes('--self-test')) { selfTest(); process.exit(0) }
selfTest()

const threshold = Number(val('--threshold', '10')) / 100
const jsonPath = val('--json', '')
const MIN_BAND_SHARE = 0.12 // no band smaller than 12% of the selection's pool

const results: unknown[] = []
console.log(`\nthreshold: every selected operator must be the representative in >= ${Math.round(threshold * 100)}% of a band's pool`)
console.log('bands = how many ranges that still allows; current = what the shipped tertile table gives\n')

for (const numbers of [2, 3, 4] as const) {
  for (const { ops } of opSubsets()) {
    const entries = poolOf(numbers, ops)
    const p = prefixOf(entries)
    const opIdx = ops.map(o => ALL_OPS.indexOf(o))
    const total = entries.length

    // What the shipped tertile boundaries actually deliver.
    const shipped = bandRanges(numbers, ops)
    const shippedCoverage = shipped.map(([lo, hi]) => {
      const from = entries.findIndex(e => e.target >= lo)
      let to = entries.length
      for (let i = entries.length - 1; i >= 0; i--) if (entries[i].target <= hi) { to = i + 1; break }
      return coverage(p, from, to, opIdx)
    })
    const shippedMin = Math.min(...shippedCoverage.map(c => c.min))
    const shippedSum = shippedCoverage.reduce((a, c) => a + c.size, 0)

    // The most bands that keep every selected operator alive everywhere.
    let recommended = 1
    let bestFor: Record<number, { min: number; bounds: [number, number][] } | null> = {}
    for (const k of [1, 2, 3]) {
      bestFor[k] = bestSplit(p, opIdx, k, MIN_BAND_SHARE)
      if (bestFor[k] && bestFor[k]!.min >= threshold) recommended = k
    }

    const opsLabel = ops.map(o => GLYPH[o]).join('')
    const shippedLabel = shipped.map(([lo, hi]) => `[${lo},${hi}]`).join(' ')
    const best = bestFor[recommended]!
    const bestLabel = best.bounds.map(([a, b]) => label(p, a, b)).join(' ')
    const overlap = shippedSum - total

    console.log(
      `${numbers}  ${opsLabel.padEnd(4)}  pool ${String(total).padStart(5)}  ` +
      `current 3 bands ${shippedLabel.padEnd(26)} worst-op ${(shippedMin * 100).toFixed(0).padStart(3)}%` +
      `${overlap > 0 ? `  overlap ${overlap}` : ''}`,
    )
    console.log(
      `   ${' '.repeat(9)}  -> ${recommended} band${recommended === 1 ? ' ' : 's'}   ${bestLabel.padEnd(29)} worst-op ${(best.min * 100).toFixed(0).padStart(3)}%  ` +
      `(3 bands best possible ${bestFor[3] ? (bestFor[3]!.min * 100).toFixed(0) + '%' : 'n/a'}, 2 bands ${bestFor[2] ? (bestFor[2]!.min * 100).toFixed(0) + '%' : 'n/a'})`,
    )

    results.push({
      numbers, ops: ops.join(''), pool: total, overlap,
      shipped: { bands: shipped, worstOp: Number((shippedMin * 100).toFixed(1)) },
      recommendedBands: recommended,
      best: { bands: best.bounds.map(([a, b]) => [entries[a].target, entries[b - 1].target]), worstOp: Number((best.min * 100).toFixed(1)) },
      bestBy: Object.fromEntries([1, 2, 3].map(k => [k, bestFor[k] ? Number((bestFor[k]!.min * 100).toFixed(1)) : null])),
    })
  }
}

if (jsonPath) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(jsonPath, JSON.stringify({ threshold, results }, null, 2))
  console.log(`\nwrote ${jsonPath}`)
}
