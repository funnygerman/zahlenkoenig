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
// Run with: npx tsx scripts/checkBands.ts [--threshold 10] [--floor 4]
//                                          [--min-ops N] [--json FILE]

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

/**
 * Boundaries a player can read off a chip without doing arithmetic. Round
 * band edges are worth something the coverage score cannot see — "kleines
 * Ziel: bis 20" is a promise, "[1,17]" is a measurement — so the search can
 * be restricted to these and the cost in coverage read off directly.
 */
const NICE = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100, 120, 150, 200, 250, 300, 400, 500, 750]

/** Cut positions that fall on a nice boundary: the first entry with target > v, for each nice v. */
function niceCuts(entries: Entry[]): number[] {
  const out = new Set<number>()
  for (const v of NICE) {
    const i = entries.findIndex(e => e.target > v)
    if (i > 0 && i < entries.length) out.add(i)
  }
  return [...out].sort((a, b) => a - b)
}

/**
 * A band's job, restated after the first pass got it wrong.
 *
 * Maximising the worst operator's *share* of a band produces boundaries
 * like [1,2] [3,4] [5,729] — every operator survives, and the labels
 * "klein · mittel · groß" become a lie, because two of the three bands are
 * two numbers wide. That objective was never the band's job.
 *
 * Split the work instead. Once the draw is shape-aware it equalises the
 * shapes *within* whatever pool it is given, so proportion is the draw's
 * problem. What only the band can decide is **availability**: an operator
 * absent from the band's pool can never be drawn, however good the draw
 * is. So the band needs a floor, not a maximum — and among the splits that
 * clear that floor, the one that best divides the range for difficulty
 * wins, which is what the player was promised.
 */
function feasible(p: Prefix, bounds: [number, number][], opIdx: number[], floor: number, minSize: number): boolean {
  for (const [a, b] of bounds) {
    const c = coverage(p, a, b, opIdx)
    if (c.size < minSize) return false
    if (c.min < floor) return false
  }
  return true
}

/** How far a split is from equal thirds — the difficulty spread the three chips promise. */
function imbalance(bounds: [number, number][], n: number): number {
  const want = n / bounds.length
  let sum = 0
  for (const [a, b] of bounds) sum += ((b - a) - want) ** 2
  return sum
}

/**
 * The most bands that keep every selected operator available, and among
 * those splits the most evenly sized one — restricted to boundaries a
 * player can read off a chip.
 */
function bandsForPlayer(p: Prefix, opIdx: number[], k: number, floor: number, minShare: number, cuts: number[]):
  { bounds: [number, number][]; worst: number } | null {
  const n = p.entries.length
  const minSize = Math.floor(n * minShare)
  let best: { bounds: [number, number][]; worst: number; score: number } | null = null
  const consider = (edges: number[]) => {
    const bounds: [number, number][] = []
    for (let i = 0; i < edges.length - 1; i++) bounds.push([edges[i], edges[i + 1]])
    if (!feasible(p, bounds, opIdx, floor, minSize)) return
    const score = imbalance(bounds, n)
    if (!best || score < best.score) {
      best = { bounds, worst: Math.min(...bounds.map(([a, b]) => coverage(p, a, b, opIdx).min)), score }
    }
  }
  if (k === 1) consider([0, n])
  else if (k === 2) for (const c of cuts) consider([0, c, n])
  else for (let i = 0; i < cuts.length; i++) for (let j = i + 1; j < cuts.length; j++) consider([0, cuts[i], cuts[j], n])
  return best ? { bounds: best.bounds, worst: best.worst } : null
}

/** The best k-band split by "worst operator in any band", subject to no band being tiny. */
function bestSplit(p: Prefix, opIdx: number[], k: number, minShare: number, cutSet?: number[]): { min: number; bounds: [number, number][] } | null {
  const n = p.entries.length
  const cuts = cutSet ?? legalCuts(p.entries)
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

  // Nice cuts must land on a nice boundary and nowhere else.
  const niceEntries: Entry[] = [10, 20, 21, 60].map(t => ({ target: t, repMask: 1, anyMask: 1, needsBlock: false }))
  eq(niceCuts(niceEntries).map(i => niceEntries[i - 1].target), [10, 20, 21], 'cuts sit after 10, 20 and 21')

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
// Only selections the app can actually produce: concept 15.6 (revised)
// requires at least two operators, enforced in useSettings.ts's toggleOp
// and settings.ts's sanitize, so a single-operator selection is
// unreachable however the table is keyed. --min-ops 1 measures them
// anyway, which is only useful for checking puzzles.ts's own BAND_TABLE
// (still 45 rows, 12 of them dead).
const minOps = Number(val('--min-ops', '2'))

const results: unknown[] = []
console.log(`\nthreshold: every selected operator must be the representative in >= ${Math.round(threshold * 100)}% of a band's pool`)
console.log('bands = how many ranges that still allows; current = what the shipped tertile table gives\n')

for (const numbers of [2, 3, 4] as const) {
  for (const { ops } of opSubsets()) {
    if (ops.length < minOps) continue
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

    // The product owner's proposal: one fixed split for every selection.
    const fixedEdges = (val('--fixed', '49,99')).split(',').map(Number)
    const fixedBounds: [number, number][] = []
    let cursor = 0
    for (const edge of fixedEdges) {
      let to = cursor
      while (to < entries.length && entries[to].target <= edge) to++
      fixedBounds.push([cursor, to])
      cursor = to
    }
    fixedBounds.push([cursor, entries.length])
    const fixedCov = fixedBounds.map(([a, b]) => coverage(p, a, b, opIdx))
    const emptyBands = fixedCov.filter(c => c.size === 0).length
    const fixedMin = Math.min(...fixedCov.map(c => (c.size === 0 ? 0 : c.min)))

    // The same search, restricted to boundaries a player can read.
    const nice = niceCuts(entries)
    const bestNice = bestSplit(p, opIdx, recommendedNice(), MIN_BAND_SHARE, nice)
    function recommendedNice(): number { return recommended }

    // The availability-floor formulation: how many readable bands keep every
    // selected operator drawable, and what the most even such split is.
    const floor = Number(val('--floor', '4')) / 100
    let playerBands = 1
    let playerBest: ReturnType<typeof bandsForPlayer> = null
    for (const k of [1, 2, 3]) {
      const cand = bandsForPlayer(p, opIdx, k, floor, MIN_BAND_SHARE, nice)
      if (cand) { playerBands = k; playerBest = cand }
    }

    const maxTarget = entries[entries.length - 1].target
    const opsLabel = ops.map(o => GLYPH[o]).join('')
    const shippedLabel = shipped.map(([lo, hi]) => `[${lo},${hi}]`).join(' ')
    const best = bestFor[recommended]!
    const bestLabel = best.bounds.map(([a, b]) => label(p, a, b)).join(' ')
    const overlap = shippedSum - total

    const niceLabel = bestNice ? bestNice.bounds.map(([a, b]) => label(p, a, b)).join(' ') : 'none'
    console.log(
      `${numbers}  ${opsLabel.padEnd(4)}  pool ${String(total).padStart(5)}  max ${String(maxTarget).padStart(3)}  ` +
      `shipped ${shippedLabel.padEnd(26)} worst-op ${(shippedMin * 100).toFixed(0).padStart(3)}%` +
      `${overlap > 0 ? `  overlap ${overlap}` : ''}`,
    )
    console.log(
      `   ${' '.repeat(9)}  best ${recommended} band${recommended === 1 ? ' ' : 's'}  ${bestLabel.padEnd(29)} worst-op ${(best.min * 100).toFixed(0).padStart(3)}%  ` +
      `(3 bands ${bestFor[3] ? (bestFor[3]!.min * 100).toFixed(0) + '%' : 'n/a'}, 2 ${bestFor[2] ? (bestFor[2]!.min * 100).toFixed(0) + '%' : 'n/a'}, 1 ${bestFor[1] ? (bestFor[1]!.min * 100).toFixed(0) + '%' : 'n/a'})`,
    )
    const playerLabel = playerBest ? playerBest.bounds.map(([a, b]) => label(p, a, b)).join(' ') : 'none'
    const playerSizes = playerBest ? playerBest.bounds.map(([a, b]) => b - a).join('/') : '-'
    console.log(
      `   ${' '.repeat(9)}  round      ${niceLabel.padEnd(29)} worst-op ${bestNice ? (bestNice.min * 100).toFixed(0).padStart(3) + '%' : ' n/a'}   ` +
      `| fixed ${fixedEdges.join('/')}: worst-op ${(fixedMin * 100).toFixed(0).padStart(3)}%  ` +
      `sizes ${fixedCov.map(c => c.size).join('/')}${emptyBands ? `  EMPTY x${emptyBands}` : ''}`,
    )
    console.log(
      `   ${' '.repeat(9)}  PLAYER ${playerBands}   ${playerLabel.padEnd(29)} worst-op ${playerBest ? (playerBest.worst * 100).toFixed(0).padStart(3) + '%' : ' n/a'}   ` +
      `| sizes ${playerSizes}`,
    )

    results.push({
      numbers, ops: ops.join(''), pool: total, overlap,
      shipped: { bands: shipped, worstOp: Number((shippedMin * 100).toFixed(1)) },
      recommendedBands: recommended,
      maxTarget,
      nice: bestNice ? { bands: bestNice.bounds.map(([a, b]) => [entries[a].target, entries[b - 1].target]), worstOp: Number((bestNice.min * 100).toFixed(1)) } : null,
      fixed: { edges: fixedEdges, worstOp: Number((fixedMin * 100).toFixed(1)), sizes: fixedCov.map(c => c.size), empty: emptyBands },
      player: playerBest ? {
        bands: playerBest.bounds.map(([a, b]) => [entries[a].target, entries[b - 1].target]),
        count: playerBands,
        worstOp: Number((playerBest.worst * 100).toFixed(1)),
        sizes: playerBest.bounds.map(([a, b]) => b - a),
      } : null,
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
