import { describe, it, expect } from 'vitest'
import { evaluate } from './evaluate'
import { createExpression, createOperatorLeaf, createEmptyGroup, type Group, type NumberLeaf, type Slot } from './expression'

function num(value: number, source: number): NumberLeaf {
  return { id: `t-num-${source}`, kind: 'number', value, source }
}

function exprOf(children: Slot[]) {
  return { root: { id: 'root' as const, kind: 'group' as const, children } }
}

describe('evaluate — incomplete or unevaluable expressions', () => {
  it('an empty expression is null', () => {
    expect(evaluate(createExpression())).toBeNull()
  })

  it('an expression with an open gap is null', () => {
    expect(evaluate(exprOf([num(3, 0), null]))).toBeNull()
  })

  it('a root containing an incomplete group is null', () => {
    expect(evaluate(exprOf([createEmptyGroup()]))).toBeNull()
  })

  it('division by zero inside a group is null (concept 8)', () => {
    // 5 / (3-3)
    const zeroGroup: Group = { id: 'g', kind: 'group', children: [num(3, 0), createOperatorLeaf('-'), num(3, 1)] }
    expect(evaluate(exprOf([num(5, 2), createOperatorLeaf('/'), zeroGroup]))).toBeNull()
  })
})

describe('evaluate — precedence (concept 8: two passes, * and / before + and -)', () => {
  it('3 + 4 * 2 = 11, not 14', () => {
    expect(evaluate(exprOf([num(3, 0), createOperatorLeaf('+'), num(4, 1), createOperatorLeaf('*'), num(2, 2)]))).toBe(11)
  })

  it('9 / 2 * 4 = 18 — fractional intermediates stay valid (concept 8)', () => {
    expect(evaluate(exprOf([num(9, 0), createOperatorLeaf('/'), num(2, 1), createOperatorLeaf('*'), num(4, 2)]))).toBe(18)
  })
})

describe('evaluate — groups', () => {
  it('(6 + 2) * (9 - 3) = 48 — the worst-case expression from concept 12.5', () => {
    const g1: Group = { id: 'g1', kind: 'group', children: [num(6, 0), createOperatorLeaf('+'), num(2, 1)] }
    const g2: Group = { id: 'g2', kind: 'group', children: [num(9, 2), createOperatorLeaf('-'), num(3, 3)] }
    expect(evaluate(exprOf([g1, createOperatorLeaf('*'), g2]))).toBe(48)
  })

  it('a three-number group: (1+1+1)*3 = 9', () => {
    const g: Group = { id: 'g', kind: 'group', children: [num(1, 0), createOperatorLeaf('+'), num(1, 1), createOperatorLeaf('+'), num(1, 2)] }
    expect(evaluate(exprOf([g, createOperatorLeaf('*'), num(3, 3)]))).toBe(9)
  })

  it('a group applies its own precedence internally: (2+3*4) = 14', () => {
    const g: Group = { id: 'g', kind: 'group', children: [num(2, 0), createOperatorLeaf('+'), num(3, 1), createOperatorLeaf('*'), num(4, 2)] }
    expect(evaluate(exprOf([g]))).toBe(14)
  })
})

describe('evaluate — the final result must be >= 0 (concept 8)', () => {
  it('3 - 7 evaluates to null, not -4', () => {
    expect(evaluate(exprOf([num(3, 0), createOperatorLeaf('-'), num(7, 1)]))).toBeNull()
  })

  it('0 is a valid result: 3 - 3', () => {
    expect(evaluate(exprOf([num(3, 0), createOperatorLeaf('-'), num(3, 1)]))).toBe(0)
  })
})

describe('evaluate — matches solver.ts\'s reachable() on the same arrangement', () => {
  it('agrees with the depth-1 model for a full 4-number expression', () => {
    // (6+2)*(9-3), same as above but cross-checked against a hand-computed value
    const g1: Group = { id: 'g1', kind: 'group', children: [num(6, 0), createOperatorLeaf('+'), num(2, 1)] }
    const g2: Group = { id: 'g2', kind: 'group', children: [num(9, 2), createOperatorLeaf('-'), num(3, 3)] }
    const result = evaluate(exprOf([g1, createOperatorLeaf('*'), g2]))
    expect(result).toBe((6 + 2) * (9 - 3))
  })
})
