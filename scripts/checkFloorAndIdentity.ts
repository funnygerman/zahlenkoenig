// Two checks on the UX review's recommendation, before anyone builds it.
//
// The review proposes replacing puzzles.ts's *maximum* distinct-operator
// demand with a permanent *floor* of two, and separately penalising
// "identity steps" — a chip that changes nothing, `× 1`, `÷ 1`, `6 ÷ 6`.
// Both are plausible; neither was measured. CLAUDE.md already records one
// near-miss in this exact area ("4 Zahlen, +−÷, mittel would go from 3405
// puzzles to 30"), which is what a floor could repeat if it starves a
// band's pool.
//
//   1. Floor feasibility — what share of each band's pool has a solution
//      needing >= 2 distinct operators. A band where that share is tiny is
//      a band where the floor trades the pattern bug for the repeat bug.
//   2. Identity steps — how often a puzzle's *every* solution wastes a
//      chip, and how often merely the likely-found one does.
//
// Run with: npx tsx scripts/checkFloorAndIdentity.ts

import { bandRanges } from '../src/core/puzzles.ts'
import { forEachArrangement } from '../src/core/solver.ts'
import type { Operator } from '../src/core/expression.ts'
import { ALL_OPS, GLYPH, blocksOf, multisets, opSubsets, patternOf, selfTestModel } from './varietyModel.ts'

/**
 * Does this arrangement contain a step that changes nothing? Covers the two
 * shapes the review names: a `×` or `÷` whose right operand is 1, and a `÷`
 * by the number immediately to its left (`6 ÷ 6`). Both are read off the
 * flat operand order, which is where the player sees them.
 *
 * Deliberately narrow: `(1 + 1) × 9 × 5` is *not* counted, because `1 + 1`
 * does change something. Undercounting keeps the figures a floor rather
 * than a guess.
 */
function hasIdentityStep(perm: number[], opTuple: Operator[]): boolean {
  for (let i = 0; i < opTuple.length; i++) {
    const op = opTuple[i]
    const right = perm[i + 1]
    if ((op === '*' || op === '/') && right === 1) return true
    // `a ÷ a` collapses to a constant 1 whatever the digit — cheap when
    // there is something else in the expression, but `8 ÷ 8 = 1` as a whole
    // two-number puzzle is not a wasted chip: drop either 8 and it breaks.
    if (op === '/' && perm[i] === right && perm.length > 2) return true
  }
  return false
}

interface Cell {
  total: number
  // Cannot be solved with a single operator repeated — `minDistinctOps >= 2`,
  // the same quantity reachable() reports. The weaker reading ("some
  // solution happens to use two") barely filters anything and would not
  // deliver what the floor is for: that the player's operator choice is
  // forced to matter.
  floorOk: number
  allIdentity: number  // every solution wastes a chip
  repIdentity: number  // the likely-found solution wastes a chip
}

function popcount(mask: number): number {
  let c = 0
  for (let m = mask; m; m >>= 1) c += m & 1
  return c
}
function maskOf(t: Operator[]): number {
  let m = 0
  for (const op of t) m |= 1 << ALL_OPS.indexOf(op)
  return m
}

function measure(numbers: 2 | 3 | 4, ops: Operator[], lo: number, hi: number): Cell {
  const cell: Cell = { total: 0, floorOk: 0, allIdentity: 0, repIdentity: 0 }
  for (const nums of multisets(numbers)) {
    // per target: best distinct-op count, whether any solution is clean,
    // and whether the representative (fewest blocks, then first
    // alphabetically — the same rule shapesOf uses) is clean
    const acc = new Map<number, { minDistinct: number; anyClean: boolean; repClean: boolean; blocks: number; pattern: string }>()
    forEachArrangement(nums, ops, (perm, comp, opTuple, value) => {
      if (value < lo || value > hi) return
      const distinct = popcount(maskOf(opTuple))
      const clean = !hasIdentityStep(perm, opTuple)
      const blocks = blocksOf(comp)
      const pattern = patternOf(comp, opTuple, numbers)
      const prev = acc.get(value)
      if (!prev) {
        acc.set(value, { minDistinct: distinct, anyClean: clean, repClean: clean, blocks, pattern })
        return
      }
      prev.minDistinct = Math.min(prev.minDistinct, distinct)
      prev.anyClean = prev.anyClean || clean
      if (blocks < prev.blocks || (blocks === prev.blocks && pattern < prev.pattern)) {
        prev.blocks = blocks
        prev.pattern = pattern
        prev.repClean = clean
      }
    })
    for (const [, v] of acc) {
      cell.total++
      if (v.minDistinct >= 2) cell.floorOk++
      if (!v.anyClean) cell.allIdentity++
      if (!v.repClean) cell.repIdentity++
    }
  }
  return cell
}

function selfTest(): void {
  selfTestModel()
  const fail = (m: string) => { throw new Error(`checkFloorAndIdentity self-test: ${m}`) }
  const yes = (p: number[], o: Operator[], why: string) => { if (!hasIdentityStep(p, o)) fail(why) }
  const no = (p: number[], o: Operator[], why: string) => { if (hasIdentityStep(p, o)) fail(why) }

  yes([6, 5, 9, 1], ['+', '*', '*'], '6 + 5 × 9 × 1 wastes the 1')
  yes([9, 6, 6], ['+', '/'], '9 + 6 ÷ 6 wastes both sixes')
  yes([8, 1, 4], ['/', '+'], '8 ÷ 1 + 4 wastes the 1')
  no([6, 2, 9, 3], ['+', '*', '-'], '6 + 2 × 9 − 3 is clean')
  no([1, 1, 9, 5], ['+', '*', '*'], '(1 + 1) × 9 × 5 — 1 + 1 does change something')
  no([9, 9], ['*'], '9 × 9 is clean')
  no([8, 8], ['/'], 'a ÷ a as the whole puzzle is clean — it is the only thing the puzzle can be')

  // Known-good against the facts CLAUDE.md already records: with {+,−} the
  // bracket turns one operator into the other, so no puzzle can ever need
  // two — a floor of 2 must be measured as infeasible there.
  const plusMinus = measure(3, ['+', '-'], 1, 999)
  if (plusMinus.floorOk !== 0) fail(`{+,−} at 3 numbers should never need two operators, got ${plusMinus.floorOk}`)
  const timesDiv = measure(3, ['*', '/'], 1, 999)
  if (timesDiv.floorOk !== 0) fail(`{×,÷} at 3 numbers should never need two operators, got ${timesDiv.floorOk}`)

  console.log('self-test: all checks passed\n')
}

selfTest()

const BAND = ['klein', 'mittel', 'groß']
const pctOf = (a: number, b: number) => (b === 0 ? 0 : Math.round((100 * a) / b))

console.log('floor-2 = share of the band pool that CANNOT be solved with one operator (minDistinctOps >= 2)')
console.log('dead    = every solution wastes a chip · likely = the solution the player would find does\n')
console.log('n ops     band          pool    floor-2 pool    floor-2   dead  likely')

for (const numbers of [3, 4] as const) {
  for (const { ops } of opSubsets()) {
    if (ops.length < 2) continue
    const spansBoth = ops.some(o => o === '+' || o === '-') && ops.some(o => o === '*' || o === '/')
    if (!spansBoth) continue
    const ranges = bandRanges(numbers, ops)
    for (let band = 0; band < 3; band++) {
      const [lo, hi] = ranges[band]
      const c = measure(numbers, ops, lo, hi)
      const flag = c.floorOk < 200 || pctOf(c.floorOk, c.total) < 25 ? '  <-- thin' : ''
      console.log(
        `${numbers} ${ops.map(o => GLYPH[o]).join('').padEnd(5)} ${BAND[band].padEnd(7)} ` +
        `${String(c.total).padStart(7)} ${String(c.floorOk).padStart(14)} ` +
        `${(pctOf(c.floorOk, c.total) + '%').padStart(8)} ` +
        `${(pctOf(c.allIdentity, c.total) + '%').padStart(6)} ${(pctOf(c.repIdentity, c.total) + '%').padStart(6)}${flag}`,
      )
    }
  }
}
