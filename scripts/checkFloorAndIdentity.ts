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
// Imported from the shipped solver rather than kept as a private copy: these
// are the exact predicates puzzles.ts now filters on, so the self-test below
// checks production behaviour rather than a lookalike.
import { forEachArrangement, hasIdentityStep, staysWhole } from '../src/core/solver.ts'
import type { Operator } from '../src/core/expression.ts'
import { ALL_OPS, GLYPH, blocksOf, multisets, opSubsets, patternOf, selfTestModel } from './varietyModel.ts'





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
  allFraction: number  // no solution stays on whole numbers throughout
  repFraction: number  // the likely-found solution leaves the whole numbers
  // Has at least one solution that is both whole-number throughout and free
  // of wasted chips. This is the pool a generator would be left with if
  // both quality rules were made requirements rather than preferences, so
  // it is the number that decides whether they are affordable — the two
  // faults are correlated, so multiplying their separate rates would
  // overestimate what survives.
  cleanOk: number
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
  const cell: Cell = { total: 0, floorOk: 0, allIdentity: 0, repIdentity: 0, allFraction: 0, repFraction: 0, cleanOk: 0 }
  for (const nums of multisets(numbers)) {
    // per target: best distinct-op count, whether any solution is clean,
    // and whether the representative (fewest blocks, then first
    // alphabetically — the same rule shapesOf uses) is clean
    const acc = new Map<number, {
      minDistinct: number; anyClean: boolean; repClean: boolean
      anyWhole: boolean; repWhole: boolean; anyBoth: boolean; blocks: number; pattern: string
    }>()
    forEachArrangement(nums, ops, (perm, comp, opTuple, value) => {
      if (value < lo || value > hi) return
      const distinct = popcount(maskOf(opTuple))
      const clean = !hasIdentityStep(perm, comp, opTuple)
      const whole = staysWhole(perm, comp, opTuple)
      const blocks = blocksOf(comp)
      const pattern = patternOf(comp, opTuple, numbers)
      const prev = acc.get(value)
      if (!prev) {
        acc.set(value, { minDistinct: distinct, anyClean: clean, repClean: clean, anyWhole: whole, repWhole: whole, anyBoth: clean && whole, blocks, pattern })
        return
      }
      prev.minDistinct = Math.min(prev.minDistinct, distinct)
      prev.anyClean = prev.anyClean || clean
      prev.anyWhole = prev.anyWhole || whole
      prev.anyBoth = prev.anyBoth || (clean && whole)
      if (blocks < prev.blocks || (blocks === prev.blocks && pattern < prev.pattern)) {
        prev.blocks = blocks
        prev.pattern = pattern
        prev.repClean = clean
        prev.repWhole = whole
      }
    })
    for (const [, v] of acc) {
      cell.total++
      if (v.minDistinct >= 2) cell.floorOk++
      if (!v.anyClean) cell.allIdentity++
      if (!v.repClean) cell.repIdentity++
      if (!v.anyWhole) cell.allFraction++
      if (!v.repWhole) cell.repFraction++
      if (v.anyBoth) cell.cleanOk++
    }
  }
  return cell
}

function selfTest(): void {
  selfTestModel()
  const fail = (m: string) => { throw new Error(`checkFloorAndIdentity self-test: ${m}`) }
  const yes = (p: number[], c: number[], o: Operator[], why: string) => { if (!hasIdentityStep(p, c, o)) fail(why) }
  const no = (p: number[], c: number[], o: Operator[], why: string) => { if (hasIdentityStep(p, c, o)) fail(why) }

  yes([6, 5, 9, 1], [1, 1, 1, 1], ['+', '*', '*'], '6 + 5 × 9 × 1 wastes the 1')
  yes([1, 9, 6, 5], [1, 1, 2], ['*', '*', '+'], '1 × 9 × (6 + 5) wastes its leading 1')
  yes([9, 6, 6], [1, 1, 1], ['+', '/'], '9 + 6 ÷ 6 wastes both sixes')
  yes([8, 1, 4], [1, 1, 1], ['/', '+'], '8 ÷ 1 + 4 wastes the 1')
  no([6, 2, 9, 3], [2, 2], ['+', '*', '-'], '(6 + 2) × (9 − 3) is clean')
  no([1, 1, 9, 5], [2, 1, 1], ['+', '*', '*'], '(1 + 1) × 9 × 5 — the bracket is not a chip')
  no([9, 9], [1, 1], ['*'], '9 × 9 is clean')
  no([8, 8], [1, 1], ['/'], 'a ÷ a as the whole puzzle is clean — it is the only thing the puzzle can be')

  // The product owner's own example, and the reason this check exists.
  if (staysWhole([9, 1, 9, 9], [1, 3], ['/', '/', '/'])) fail('9 ÷ (1 ÷ 9 ÷ 9) leaves the whole numbers at 1/81')
  if (staysWhole([9, 5, 4, 8], [3, 1], ['+', '/', '*'])) fail('(9 + 5 ÷ 4) × 8 passes through 1.25')
  if (!staysWhole([6, 2, 9, 3], [2, 2], ['+', '*', '-'])) fail('(6 + 2) × (9 − 3) is whole throughout')
  if (!staysWhole([9, 6, 6], [1, 1, 1], ['+', '/'])) fail('9 + 6 ÷ 6 is whole (6 ÷ 6 = 1)')
  if (!staysWhole([9, 9], [1, 1], ['*'])) fail('9 × 9 is whole')

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
console.log('chip    = wastes a chip (× 1, ÷ 1, a ÷ a) · frac = leaves the whole numbers on the way')
console.log('all     = no solution avoids it · likely = the solution the player would find\n')
console.log('clean   = has a solution that is both whole-number and chip-free — the pool if both were required\n')
console.log('n ops     band          pool   floor-2   chip-all chip-likely   frac-all frac-likely      clean')

// Every selection the app can reach: concept 15.6 (revised) requires at
// least two operators, so single-operator selections are excluded.
for (const numbers of [2, 3, 4] as const) {
  for (const { ops } of opSubsets()) {
    if (ops.length < 2) continue
    const ranges = bandRanges(numbers, ops)
    for (let band = 0; band < 3; band++) {
      const [lo, hi] = ranges[band]
      const c = measure(numbers, ops, lo, hi)
      const flag = c.floorOk > 0 && c.floorOk < 200 ? '  <-- thin' : ''
      console.log(
        `${numbers} ${ops.map(o => GLYPH[o]).join('').padEnd(5)} ${BAND[band].padEnd(7)} ` +
        `${String(c.total).padStart(6)} ${(pctOf(c.floorOk, c.total) + '%').padStart(8)} ` +
        `${(pctOf(c.allIdentity, c.total) + '%').padStart(10)} ${(pctOf(c.repIdentity, c.total) + '%').padStart(11)} ` +
        `${(pctOf(c.allFraction, c.total) + '%').padStart(10)} ${(pctOf(c.repFraction, c.total) + '%').padStart(11)} ` +
        `${String(c.cleanOk).padStart(6)} ${(pctOf(c.cleanOk, c.total) + '%').padStart(4)}${flag}`,
      )
    }
  }
}
