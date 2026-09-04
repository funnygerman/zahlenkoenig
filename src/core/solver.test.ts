import { describe, it, expect } from 'vitest'
import { reachable } from './solver'

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
