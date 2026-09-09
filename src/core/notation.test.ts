import { describe, it, expect } from 'vitest'
import { createExpression, createOperatorLeaf, wrapGroup, placeAt, type NumberLeaf } from './expression'
import { formatResult, notate } from './notation'

function num(value: number, source: number): NumberLeaf {
  return { id: `t-num-${source}`, kind: 'number', value, source }
}

describe('notate (concept 9.2)', () => {
  it('renders the concept\'s own worst case: (6 + 2) × (9 − 3)', () => {
    let children = wrapGroup([num(6, 0), createOperatorLeaf('+'), num(2, 1)], 0, 3)
    children = placeAt(children, 1, createOperatorLeaf('*'))
    let right = wrapGroup([num(9, 2), createOperatorLeaf('-'), num(3, 3)], 0, 3)
    children = placeAt(children, 2, right[0])
    expect(notate({ root: { id: 'root', kind: 'group', children } })).toBe('(6 + 2) × (9 − 3)')
  })

  it('grows while building: open gaps are skipped, not shown', () => {
    const expr = createExpression()
    expect(notate(expr)).toBe('')
    const withSix = { root: { ...expr.root, children: placeAt(expr.root.children, 0, num(6, 0)) } }
    expect(notate(withSix)).toBe('6')
    const withPlus = { root: { ...withSix.root, children: placeAt(withSix.root.children, 1, createOperatorLeaf('+')) } }
    expect(notate(withPlus)).toBe('6 +')
  })

  it('uses the typographic glyphs, not the raw operator characters', () => {
    const children = [num(9, 0), createOperatorLeaf('-'), num(2, 1), createOperatorLeaf('/'), num(1, 2)]
    expect(notate({ root: { id: 'root', kind: 'group', children } })).toBe('9 − 2 ÷ 1')
  })

  it('a flat run needs no parens of its own — nothing here reorders it', () => {
    const children = [num(2, 0), createOperatorLeaf('+'), num(3, 1), createOperatorLeaf('*'), num(4, 2)]
    expect(notate({ root: { id: 'root', kind: 'group', children } })).toBe('2 + 3 × 4')
  })
})

describe('formatResult (result-on-submit round: a wrong attempt shows its own negative result)', () => {
  it('a non-negative result prints as a plain number', () => {
    expect(formatResult(48)).toBe('48')
    expect(formatResult(0)).toBe('0')
  })

  it('a negative result uses the typographic minus, not JS\'s plain "-"', () => {
    expect(formatResult(-3)).toBe('−3')
  })
})
