// Emits puzzles.ts's BAND_TABLE and its two uniqueOnly exception lists as
// TS source. Regenerate and paste in after any change to the depth-1 model
// or to the rules below.
//
// Replaces the old generateBandTable.mjs, which kept its own copy of the
// evaluator: this one imports solver.ts, so the table can never describe a
// model the game does not run (concept 15.3, "ein Modell für Generator und
// Löser").
//
// The pool is the *whole-number* pool. A target whose every route leaves
// the whole numbers — `9 ÷ (1 ÷ 9 ÷ 9) = 729`, whose bracket is 1/81 — is
// not a puzzle for an audience that starts in the first year of school.
// Excluding them empties some bands outright (`3 Zahlen, nur ÷, groß` was
// entirely fractional), which is why the bands have to be re-derived
// rather than merely re-filtered.
//
// The band boundaries themselves are a PO decision (target-ranges-display
// round), replacing the earlier tertile/operator-floor search entirely:
// magnitude only tracks × among the four operators (− and ÷ on single
// digits never reach far past the low end regardless of how the pool is
// cut, so slicing by size bought them nothing), so only a × selection is
// worth slicing by magnitude at all.
//
//  - 2 numbers: always one band, the pool's own [min, max] — with a single
//    digit pair there is no magnitude range worth offering a choice over.
//  - 3 or 4 numbers, × not selected: also one band, [min, max] — same
//    reasoning; +, − and ÷ don't spread a pool wide enough to want slicing.
//  - 4 numbers, × selected: fixed cut points at 50, 100 and 250 —
//    "M" 1–50, "L" 51–100, "XL" 101–250, "XXL" 251–max.
//  - 3 numbers, × selected: only three bands, "M" 1–50, "L" 51–100,
//    "XL" 101–150 — no XXL (negative-result-display round's sibling,
//    the target-ranges-display follow-up: measured, everything a
//    3-number pool holds above 150 is 96-100% pure-× with 0-2 unique
//    solutions per selection, i.e. exactly the "boring, multiplication
//    only" slice the PO judged not worth a band. The pool is capped at
//    150 rather than merely displayed that way — targets above it are
//    never drawn — which is why `total`/`unique` below come from the
//    capped pool, not the full one. 4 numbers keeps its XXL: the same
//    measurement above 300 there still needs + or − 65-90% of the time
//    with hundreds of unique solutions, so it isn't filler.
//
// Run with: npx tsx scripts/generateBandTable.ts
import { reachable } from '../src/core/solver.ts'
import type { Operator } from '../src/core/expression.ts'

const ALL_OPS: Operator[] = ['+', '-', '*', '/']
const GLYPHS = ['+', '−', '×', '÷']

/** Fixed × band cut points (target-ranges-display round, PO decision): M/L/XL/XXL. */
const MULT_CUTS = [50, 100, 250]
/** 3 numbers' own cut points (PO decision, follow-up round): M/L/XL only, XL capped at 150. */
const MULT_CUTS_3 = [50, 100]
const CAP_3 = 150

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

/**
 * One band spanning the whole pool — the 2-number and non-× policy.
 * `entries` must be non-empty (every reachable selection has at least one
 * whole-number puzzle).
 */
function wholePoolBand(entries: Entry[]): [number, number][] {
  return [[0, entries.length]]
}

/**
 * The fixed M/L/XL(/XXL) split for a × selection: index bounds at the first
 * entry past each cut point, dropping any trailing band the pool never
 * reaches. A cut point that lands inside a run of equal targets still cuts
 * cleanly, since it's defined by value (`target > cut`), not by position.
 */
function multBands(entries: Entry[], cuts: number[]): [number, number][] {
  const edges = [0]
  for (const cut of cuts) {
    const i = entries.findIndex(e => e.target > cut)
    const idx = i === -1 ? entries.length : i
    if (idx > edges[edges.length - 1] && idx < entries.length) edges.push(idx)
  }
  edges.push(entries.length)
  const bounds: [number, number][] = []
  for (let i = 0; i < edges.length - 1; i++) bounds.push([edges[i], edges[i + 1]])
  return bounds
}

const rows: string[] = []
for (const numbers of [2, 3, 4] as const) {
  for (const { mask, ops } of opSubsets()) {
    const usesMult = numbers !== 2 && ops.includes('*')
    // 3 numbers' × pool is capped at 150 before anything else runs — the
    // targets above it are never drawn, so total/unique/bands all have to
    // come from the capped pool, not the full one (see the header note).
    const full = poolOf(numbers, ops)
    const { entries, unique } = usesMult && numbers === 3
      ? { entries: full.entries.filter(e => e.target <= CAP_3), unique: full.entries.filter(e => e.target <= CAP_3 && e.unique).length }
      : full
    const cuts = numbers === 3 ? MULT_CUTS_3 : MULT_CUTS
    const bounds = usesMult ? multBands(entries, cuts) : wholePoolBand(entries)
    // 4 numbers' top band is genuinely open-ended (its pool really does run
    // up to 980) and shows the pool's own max; 3 numbers' top band is a
    // closed cap (the pool was truncated to it above, at CAP_3), so it
    // shows that literal number like every other cut, the same as M and L.
    const topHi = numbers === 4 ? entries[entries.length - 1].target : CAP_3
    // Displayed range: a × band's own low/high are the fixed cut values
    // (1–50, 51–100, 101–250 for 4 numbers; 101–150 caps 3 numbers'
    // instead) — the whole point of naming them M/L/XL is that a player
    // sees the same numbers regardless of selection. A non-× selection
    // still shows its pool's actual [min, max].
    const lowOf = (i: number) => (usesMult ? (i === 0 ? 1 : cuts[i - 1] + 1) : entries[bounds[i][0]].target)
    const hiOf = (i: number, b: number) => (!usesMult ? entries[b - 1].target : i === bounds.length - 1 ? topHi : cuts[i])
    const bands = bounds.map(([a, b], i) => `[${lowOf(i)}, ${hiOf(i, b)}]`).join(', ')
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
