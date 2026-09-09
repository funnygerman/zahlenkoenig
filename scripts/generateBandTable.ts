// Emits puzzles.ts's BAND_TABLE and its two uniqueOnly exception lists as
// TS source. Regenerate and paste in after any change to the depth-1 model
// or to the rules below.
//
// Replaces the old generateBandTable.mjs, which kept its own copy of the
// evaluator: this one imports solver.ts, so the table can never describe a
// model the game does not run (concept 15.3, "ein Modell für Generator und
// Löser").
//
// Two rules changed with this generation, both product-owner decisions:
//
//  1. The pool is the *whole-number* pool. A target whose every route
//     leaves the whole numbers — `9 ÷ (1 ÷ 9 ÷ 9) = 729`, whose bracket is
//     1/81 — is not a puzzle for an audience that starts in the first year
//     of school. Excluding them empties some bands outright (`3 Zahlen,
//     nur ÷, groß` was entirely fractional), which is why the bands have to
//     be re-derived rather than merely re-filtered.
//
//  2. A selection carries as many bands as it can without starving an
//     operator, not always three. A band is a tertile of target magnitude
//     and magnitude is a proxy for operator: with two single digits
//     a − b ≤ 8 and a ÷ b ≤ 9, so a "großes Ziel" band starting at 12
//     cannot contain either, and no boundary placement fixes it. Where
//     three bands would starve an operator the selection gets two, or one.
//     Boundaries are also restricted to numbers a player can read off a
//     chip — measured cost of that restriction: under a point of coverage.
//
// Run with: npx tsx scripts/generateBandTable.ts
import { reachable } from '../src/core/solver.ts'
import type { Operator } from '../src/core/expression.ts'

const ALL_OPS: Operator[] = ['+', '-', '*', '/']
const GLYPHS = ['+', '−', '×', '÷']

/** Every selected operator must be the likely solution's in at least this share of a band. */
const OP_FLOOR = 0.04
/** No band smaller than this share of the selection's pool. */
const MIN_BAND_SHARE = 0.12
/** Boundaries a player can read off a chip. */
const NICE = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100, 120, 150, 200, 250, 300, 400, 500, 750]

function multisets(n: number): number[][] {
  const out: number[][] = []
  const rec = (start: number, arr: number[]) => {
    if (arr.length === n) { out.push(arr.slice()); return }
    for (let v = start; v <= 9; v++) { arr.push(v); rec(v, arr); arr.pop() }
  }
  rec(1, [])
  return out
}

function opSubsets(): { mask: number; ops: Operator[] }[] {
  const out = []
  for (let mask = 1; mask < 16; mask++) out.push({ mask, ops: ALL_OPS.filter((_, i) => mask & (1 << i)) })
  return out
}

/** Which operators the likely solution uses, read back off the pattern's glyphs. */
function maskOfPattern(pattern: string): number {
  let m = 0
  for (const ch of pattern) {
    const i = GLYPHS.indexOf(ch)
    if (i >= 0) m |= 1 << i
  }
  return m
}

interface Entry { target: number; repMask: number; unique: boolean }

function poolOf(numbers: number, ops: Operator[]): { entries: Entry[]; unique: number } {
  const entries: Entry[] = []
  let unique = 0
  for (const nums of multisets(numbers)) {
    for (const e of reachable(nums, ops)) {
      if (!e.wholeSolution) continue
      entries.push({ target: e.target, repMask: maskOfPattern(e.pattern), unique: e.uniqueSolution })
      if (e.uniqueSolution) unique++
    }
  }
  entries.sort((a, b) => a.target - b.target)
  return { entries, unique }
}

/** Cut positions that land on a nice boundary, and never inside a run of equal targets. */
function niceCuts(entries: Entry[]): number[] {
  const out = new Set<number>()
  for (const v of NICE) {
    const i = entries.findIndex(e => e.target > v)
    if (i > 0 && i < entries.length) out.add(i)
  }
  return [...out].sort((a, b) => a - b)
}

function shareOf(entries: Entry[], from: number, to: number, opIdx: number[]): number {
  const size = to - from
  if (size === 0) return 0
  let worst = 1
  for (const o of opIdx) {
    let c = 0
    for (let i = from; i < to; i++) if (entries[i].repMask & (1 << o)) c++
    worst = Math.min(worst, c / size)
  }
  return worst
}

/** The most even k-band split that starves no operator, on readable boundaries. */
function split(entries: Entry[], opIdx: number[], k: number): [number, number][] | null {
  const n = entries.length
  const minSize = Math.floor(n * MIN_BAND_SHARE)
  const cuts = niceCuts(entries)
  let best: { bounds: [number, number][]; score: number } | null = null
  const consider = (edges: number[]) => {
    const bounds: [number, number][] = []
    for (let i = 0; i < edges.length - 1; i++) bounds.push([edges[i], edges[i + 1]])
    for (const [a, b] of bounds) {
      if (b - a < minSize) return
      if (shareOf(entries, a, b, opIdx) < OP_FLOOR) return
    }
    const want = n / bounds.length
    const score = bounds.reduce((acc, [a, b]) => acc + ((b - a) - want) ** 2, 0)
    if (!best || score < best.score) best = { bounds, score }
  }
  if (k === 1) consider([0, n])
  else if (k === 2) for (const c of cuts) consider([0, c, n])
  else for (let i = 0; i < cuts.length; i++) for (let j = i + 1; j < cuts.length; j++) consider([0, cuts[i], cuts[j], n])
  return best ? best.bounds : null
}

const rows: string[] = []
for (const numbers of [2, 3, 4] as const) {
  for (const { mask, ops } of opSubsets()) {
    const { entries, unique } = poolOf(numbers, ops)
    const opIdx = ops.map(o => ALL_OPS.indexOf(o))
    let bounds: [number, number][] | null = null
    for (const k of [3, 2, 1]) {
      bounds = split(entries, opIdx, k)
      if (bounds) break
    }
    // One band is always representable, even where the floor cannot be met.
    if (!bounds) bounds = [[0, entries.length]]
    const bands = bounds.map(([a, b]) => `[${entries[a].target}, ${entries[b - 1].target}]`).join(', ')
    // Per band, because concept 15.6's switch has to turn itself off when the
    // *current* band has no unique-solution puzzle, not merely when the whole
    // selection has none: `3 Zahlen, +÷` has 74 of them and none in groß.
    const perBand = bounds.map(([a, b]) => entries.slice(a, b).filter(e => e.unique).length).join(', ')
    rows.push(`  '${numbers}-${mask}': { total: ${entries.length}, unique: ${unique}, uniqueBands: [${perBand}], bands: [${bands}] },`)
  }
}

console.log(`// Generated by scripts/generateBandTable.ts — do not hand-edit. ${rows.length} rows.`)
console.log('const BAND_TABLE: Record<string, BandRow> = {')
for (const r of rows) console.log(r)
console.log('}')

// Selections whose uniqueOnly pool is thin enough to ship exhaustively
// rather than draw for (concept 15.11). The whole-number rule made this
// mechanism matter more, not less: `3 Zahlen, +÷, groß` went from a pool
// blind redraw could find to one it cannot — measured, it threw on 40 of 40
// attempts — and the old `4 Zahlen, nur ÷` list turned out to be entirely
// fractional, so it is gone. The 150 threshold is chosen with margin over
// the two selections actually observed to fail.
const UNIQUE_SHIP_LIMIT = 150
const lists: string[] = []
for (const numbers of [3, 4] as const) {
  for (const { mask, ops } of opSubsets()) {
    const found: string[] = []
    for (const nums of multisets(numbers)) {
      for (const e of reachable(nums, ops)) {
        if (e.wholeSolution && e.uniqueSolution) found.push(`[[${nums.join(', ')}], ${e.target}]`)
      }
    }
    if (found.length === 0 || found.length > UNIQUE_SHIP_LIMIT) continue
    const body: string[] = []
    for (let i = 0; i < found.length; i += 4) body.push('    ' + found.slice(i, i + 4).join(', ') + ',')
    lists.push(`  // ${numbers} Zahlen, ${ops.join('')} — ${found.length} entries\n  '${numbers}-${mask}': [\n${body.join('\n')}\n  ],`)
  }
}
console.log(`\n// Generated by scripts/generateBandTable.ts — do not hand-edit. ${lists.length} selections.`)
console.log('const UNIQUE_EXCEPTIONS: Record<string, Exception[]> = {')
for (const l of lists) console.log(l)
console.log('}')
