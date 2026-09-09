import { describe, it, expect } from 'vitest'
import { reachable, type Operator } from './solver'

function targetsOf(numbers: number[], ops: ('+' | '-' | '*' | '/')[]) {
  return new Map(reachable(numbers, ops).map(e => [e.target, e.uniqueSolution]))
}

describe('reachable — known depth-1 (un)solvability facts', () => {
  // Same facts checkDepth1.mjs's own self-check pins down, verified here
  // through solver.ts's own reachable() instead of a separate script copy.
  it('[1,1,1,1] cannot reach 1000 under any operator combination', () => {
    expect(targetsOf([1, 1, 1, 1], ['+', '-', '*', '/']).has(1000)).toBe(false)
  })

  it('[9,9,9,9] can reach 243', () => {
    expect(targetsOf([9, 9, 9, 9], ['+', '-', '*', '/']).has(243)).toBe(true)
  })

  it('two sibling groups reach values a flat chain cannot: (1+1)x(1+2)=6 from [1,1,1,2]', () => {
    expect(targetsOf([1, 1, 1, 2], ['+', '*']).has(6)).toBe(true)
  })

  it('a three-number group reaches values a flat chain cannot: (1+1+1)x3=9 from [1,1,1,3]', () => {
    expect(targetsOf([1, 1, 1, 3], ['+', '*']).has(9)).toBe(true)
  })
})

describe('reachable — uniqueSolution (concept 15.7)', () => {
  it('"5+6 und 6+5 sind dieselbe Lösung": a 2-number sum has exactly one canonical solution', () => {
    expect(targetsOf([5, 6], ['+']).get(11)).toBe(true)
  })

  it('every 2-number, single-operator puzzle is unique — no other arrangement can duplicate it', () => {
    const t = targetsOf([3, 7], ['+'])
    for (const unique of t.values()) expect(unique).toBe(true)
  })

  it('4 numbers, only "+": nothing is unique — sums commute freely with four terms', () => {
    const t = targetsOf([1, 2, 3, 4], ['+'])
    for (const unique of t.values()) expect(unique).toBe(false)
  })

  it('"4×2×3×1" and "(1+2+3)×4" both reach 24 from {1,2,3,4} but are different shapes, not the same solution', () => {
    // If the canonicalizer collapsed them, {1,2,3,4}->24 would still show up
    // as reachable but the module has no way to assert "at least two
    // solutions" directly — so this is checked indirectly: with only '+'
    // and '*', both 24 and 6 must be reachable (6 = 1+2+3, needed for the
    // grouped arrangement) and 24 itself is NOT unique, since both shapes
    // produce it independently of any commutative reordering.
    const t = targetsOf([1, 2, 3, 4], ['+', '*'])
    expect(t.has(24)).toBe(true)
    expect(t.get(24)).toBe(false)
  })
})

describe('reachable — basic arithmetic', () => {
  it('2 numbers, "+": every reachable target is a sum of the two numbers in some order', () => {
    const t = targetsOf([3, 4], ['+'])
    expect([...t.keys()]).toEqual([7])
  })

  it('2 numbers, "*": every reachable target is the product', () => {
    const t = targetsOf([3, 4], ['*'])
    expect([...t.keys()]).toEqual([12])
  })

  it('caps targets at 999 (concept 15.5)', () => {
    const t = targetsOf([9, 9, 9, 9], ['*'])
    for (const target of t.keys()) expect(target).toBeLessThanOrEqual(999)
  })

  it('never returns a target below 1', () => {
    const t = targetsOf([1, 1, 1, 1], ['+', '-', '*', '/'])
    for (const target of t.keys()) expect(target).toBeGreaterThanOrEqual(1)
  })
})

// The fewest distinct operators any one solution needs. Every case below
// is checked by hand in its own comment — the point of the field is that a
// player who selects several operators is not handed puzzles that one
// operator alone solves (PO).
describe('reachable — minDistinctOps', () => {
  const entry = (numbers: number[], ops: Operator[], target: number) =>
    reachable(numbers, ops).find(e => e.target === target)

  it('is 1 when one operator, repeated, reaches the target', () => {
    // 5+5+5+5 = 20 — the '×' in the selection is never needed.
    expect(entry([5, 5, 5, 5], ['+', '*'], 20)?.minDistinctOps).toBe(1)
  })

  it('is 2 when every solution mixes two operators', () => {
    // [1,2,3] under {+,×}: 6 = 1+2+3 = 1×2×3 (one operator), while
    // 5 = 1×2+3, 7 = 1+2×3, 8 = (1+3)×2 and 9 = (1+2)×3 each need both.
    const all = reachable([1, 2, 3], ['+', '*'])
    expect(all.map(e => [e.target, e.minDistinctOps]).sort((a, b) => a[0] - b[0]))
      .toEqual([[5, 2], [6, 1], [7, 2], [8, 2], [9, 2]])
  })

  it('is 2 for concept 12.5’s own worst case, whose textbook solution uses three', () => {
    // (6+2)×(9−3) = 48 uses +, − and ×, but 6×9 − 2×3 = 48 uses only two,
    // and the minimum is what this reports.
    expect(entry([6, 2, 9, 3], ['+', '-', '*', '/'], 48)?.minDistinctOps).toBe(2)
  })

  it('is 1 for two numbers, whatever is selected — there is only one operator slot', () => {
    for (const e of reachable([3, 7], ['+', '-', '*', '/'])) expect(e.minDistinctOps).toBe(1)
  })

  it('is 1 throughout when only one operator is selected', () => {
    for (const e of reachable([6, 2, 9, 3], ['*'])) expect(e.minDistinctOps).toBe(1)
  })

  it('never exceeds n − 1, and is never below 1', () => {
    for (const numbers of [[3, 7], [1, 2, 3], [6, 2, 9, 3]]) {
      for (const e of reachable(numbers, ['+', '-', '*', '/'])) {
        expect(e.minDistinctOps).toBeGreaterThanOrEqual(1)
        expect(e.minDistinctOps).toBeLessThanOrEqual(numbers.length - 1)
      }
    }
  })
})

describe('reachable — whole-number paths, wasted chips, and shapes', () => {
  const find = (numbers: number[], ops: Operator[], target: number) =>
    reachable(numbers, ops).find(e => e.target === target)

  it('reports a target only a fraction can reach', () => {
    // The product owner's own example. 9 ÷ (1 ÷ 9 ÷ 9): the bracket is 1/81
    // and dividing by it multiplies, so 729 is reachable but never on whole
    // numbers. puzzles.ts refuses these outright.
    const e = find([9, 1, 9, 9], ['/'], 729)
    expect(e).toBeDefined()
    expect(e!.wholeSolution).toBe(false)
    expect(e!.cleanSolution).toBe(false)
  })

  it('reports a target that stays whole', () => {
    // Concept 12.5's worst case, which also has the bracket-free 6×9 − 2×3.
    const e = find([6, 2, 9, 3], ['+', '-', '*', '/'], 48)
    expect(e!.wholeSolution).toBe(true)
    expect(e!.cleanSolution).toBe(true)
  })

  it('separates "stays whole" from "wastes no chip"', () => {
    // 9 + 6 ÷ 6 = 10 is whole throughout — 6 ÷ 6 is exactly 1 — but the two
    // sixes only ever produce that 1, so the puzzle is 9 + 1 in a costume.
    const e = find([9, 6, 6], ['+', '/'], 10)
    expect(e!.wholeSolution).toBe(true)
    expect(e!.cleanSolution).toBe(false)
  })

  it('counts × 1 as a wasted chip', () => {
    const e = find([6, 5, 9, 1], ['+', '*'], 99)
    expect(e!.wholeSolution).toBe(true)
    expect(e!.cleanSolution).toBe(false)
  })

  it('does not count 1 + 1 as wasted — it changes something', () => {
    // (1 + 1) × 9 × 5 = 90 uses both ones to make a 2. Narrow on purpose:
    // over-counting here would refuse puzzles that are perfectly good.
    const e = find([1, 1, 9, 5], ['+', '*'], 90)
    expect(e!.cleanSolution).toBe(true)
  })

  it('does not count 8 ÷ 8 as wasted when it is the whole puzzle', () => {
    // Drop either 8 and it breaks, so no chip is spare.
    expect(find([8, 8], ['+', '-', '*', '/'], 1)!.cleanSolution).toBe(true)
  })

  it('names the shape a player would find, brackets and all', () => {
    expect(find([9, 9], ['+', '-', '*', '/'], 81)!.pattern).toBe('n×n')
    // 1,1,1,3 → 9 under {+,×} needs a three-number group (solver's own
    // example above), so the representative shape must carry the bracket.
    expect(find([1, 1, 1, 3], ['+', '*'], 9)!.pattern).toBe('(n+n+n)×n')
  })

  it('counts minDistinctOps over the whole-number solutions', () => {
    // The only routes to 729 here are fractional, so the figure falls back
    // to those rather than reporting Infinity.
    expect(find([9, 1, 9, 9], ['/'], 729)!.minDistinctOps).toBe(1)
    expect(find([9, 9], ['+', '-', '*', '/'], 81)!.minDistinctOps).toBe(1)
  })
})
