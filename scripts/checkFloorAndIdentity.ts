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

/**
 * Does every step of this arrangement land on a whole number?
 *
 * The evaluator only requires the *final* result to be a whole number in
 * 1..999 (solver.ts's TARGET_MAX check), so `9 ÷ (1 ÷ 9 ÷ 9) = 729` is a
 * legal puzzle: the bracket evaluates to 1/81 and the division by it
 * multiplies. For an audience that starts at first grade that is not a
 * taste question, so it gets counted rather than assumed.
 *
 * Mirrors evalFlat exactly — × and ÷ collapse left to right first, then +
 * and − — and checks every partial result, including each group's own
 * value, which is where the fraction hides in the example above.
 */
const WHOLE_EPS = 1e-9
function isWhole(x: number): boolean {
  return Number.isFinite(x) && Math.abs(x - Math.round(x)) < WHOLE_EPS
}

/** The flat value, or null if any intermediate leaves the whole numbers. */
function wholeFlat(nums: number[], ops: Operator[]): number | null {
  const terms = [nums[0]]
  const joins: Operator[] = []
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]
    if (op === '*' || op === '/') {
      const a = terms[terms.length - 1]
      const b = nums[i + 1]
      const v = op === '*' ? a * b : (b === 0 ? NaN : a / b)
      if (!isWhole(v)) return null
      terms[terms.length - 1] = v
    } else {
      joins.push(op)
      terms.push(nums[i + 1])
    }
  }
  let acc = terms[0]
  for (let i = 0; i < joins.length; i++) {
    acc = joins[i] === '+' ? acc + terms[i + 1] : acc - terms[i + 1]
    if (!isWhole(acc)) return null
  }
  return acc
}

/** Whether a whole arrangement — groups included — stays on whole numbers throughout. */
function staysWhole(perm: number[], comp: number[], opTuple: Operator[]): boolean {
  const n = perm.length
  const operands: number[] = []
  let numIdx = 0
  let opIdx = 0
  for (const size of comp) {
    if (size === 1) {
      operands.push(perm[numIdx++])
    } else {
      const v = wholeFlat(perm.slice(numIdx, numIdx + size), opTuple.slice(opIdx, opIdx + size - 1))
      if (v === null) return false
      operands.push(v)
      numIdx += size
      opIdx += size - 1
    }
    if (numIdx < n) opIdx++
  }
  const joins: Operator[] = []
  let cursor = 0
  for (let i = 0; i < comp.length - 1; i++) {
    cursor += comp[i] - 1
    joins.push(opTuple[cursor])
    cursor += 1
  }
  return wholeFlat(operands, joins) !== null
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
      const clean = !hasIdentityStep(perm, opTuple)
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
  const yes = (p: number[], o: Operator[], why: string) => { if (!hasIdentityStep(p, o)) fail(why) }
  const no = (p: number[], o: Operator[], why: string) => { if (hasIdentityStep(p, o)) fail(why) }

  yes([6, 5, 9, 1], ['+', '*', '*'], '6 + 5 × 9 × 1 wastes the 1')
  yes([9, 6, 6], ['+', '/'], '9 + 6 ÷ 6 wastes both sixes')
  yes([8, 1, 4], ['/', '+'], '8 ÷ 1 + 4 wastes the 1')
  no([6, 2, 9, 3], ['+', '*', '-'], '6 + 2 × 9 − 3 is clean')
  no([1, 1, 9, 5], ['+', '*', '*'], '(1 + 1) × 9 × 5 — 1 + 1 does change something')
  no([9, 9], ['*'], '9 × 9 is clean')
  no([8, 8], ['/'], 'a ÷ a as the whole puzzle is clean — it is the only thing the puzzle can be')

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
