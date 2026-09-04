import { describe, it, expect } from 'vitest'
import {
  createExpression, createTray, createOperatorLeaf, createEmptyGroup,
  insertOperand, fillGap, swapSlots, removeOperand, removeOperator,
  wrapGroup, dissolveGroup, dropZones,
  isGroupComplete, isExpressionComplete,
  type Group, type Slot, type NumberLeaf,
} from './expression'

// -------------------------------------------------------------- helpers

/** concept 2.1's invariant: even positions hold an operand, odd positions an operator. */
function checkInvariant(children: readonly Slot[]): void {
  children.forEach((slot, i) => {
    if (slot === null) return
    const expectedKind = i % 2 === 0 ? ['number', 'group'] : ['operator']
    expect(expectedKind).toContain(slot.kind)
    // A group can never contain another group — enforced by the type
    // itself (Group.children is (Leaf | null)[], no Group branch), so
    // there's nothing left to check here at runtime.
  })
}

function num(value: number, source: number): NumberLeaf {
  return { id: `t-num-${source}`, kind: 'number', value, source }
}

// build [3, +, 7] directly (root children), bypassing insertOperand so the
// fixture doesn't depend on the function under test in every case
function build(...slots: Slot[]): Slot[] {
  return slots
}

// ----------------------------------------------- concept 16/18's own list
// "First tests, in this order": wrap/dissolve are exact inverses, the
// invariant holds after each of the operations, and [6,6,9] stays
// distinguishable via `source`.

describe('wrap and dissolve are exact inverses (concept 6.9)', () => {
  it('span = 3: wrapping a pair then dissolving restores the original children', () => {
    const three = num(3, 0), plus = createOperatorLeaf('+'), seven = num(7, 1)
    const before = build(three, plus, seven)
    const wrapped = wrapGroup(before, 0, 3)
    expect(wrapped).toHaveLength(1)
    expect(wrapped[0]!.kind).toBe('group')
    const dissolved = dissolveGroup(wrapped, 0)
    expect(dissolved).toEqual(before)
  })

  it('span = 1: wrapping a lone number then dissolving restores it', () => {
    const six = num(6, 0)
    const before = build(six)
    const wrapped = wrapGroup(before, 0, 1)
    expect(wrapped[0]!.kind).toBe('group')
    expect((wrapped[0] as Group).children).toEqual([six])
    const dissolved = dissolveGroup(wrapped, 0)
    expect(dissolved).toEqual(before)
  })

  it('wrapping and dissolving in the middle of a longer expression leaves the rest untouched', () => {
    const [a, op1, b, op2, c] = [num(1, 0), createOperatorLeaf('+'), num(2, 1), createOperatorLeaf('*'), num(3, 2)]
    const before = build(a, op1, b, op2, c)
    const wrapped = wrapGroup(before, 0, 3) // wrap "1 + 2"
    expect(wrapped).toEqual([expect.objectContaining({ kind: 'group' }), op2, c])
    const dissolved = dissolveGroup(wrapped, 0)
    expect(dissolved).toEqual(before)
  })
})

describe('the invariant holds after every operation (concept 2.1, 18)', () => {
  it('building "3 + 7" step by step keeps the invariant at every step', () => {
    let children: Slot[] = []
    children = insertOperand(children, 0, num(3, 0))
    checkInvariant(children)
    expect(children).toEqual([num(3, 0)])

    children = insertOperand(children, 1, createOperatorLeaf('+'))
    checkInvariant(children)
    expect(children).toHaveLength(2)

    children = insertOperand(children, 2, num(7, 1))
    checkInvariant(children)
    expect(children).toHaveLength(3)
    expect(isExpressionComplete({ root: { id: 'root', kind: 'group', children } })).toBe(true)
  })

  it('inserting mid-sequence opens a fresh gap (concept 3: "3 + 5 ⬚ 7")', () => {
    const three = num(3, 0), plus = createOperatorLeaf('+'), seven = num(7, 1)
    const base: Slot[] = [three, plus, seven]
    const withFive = insertOperand(base, 2, num(5, 2))
    checkInvariant(withFive)
    expect(withFive).toEqual([three, plus, num(5, 2), null, seven])
    expect(isExpressionComplete({ root: { id: 'root', kind: 'group', children: withFive } })).toBe(false)
  })

  it('fillGap', () => {
    const plus = createOperatorLeaf('+')
    const base: Slot[] = [num(3, 0), null]
    const filled = fillGap(base, 1, plus)
    checkInvariant(filled)
    expect(filled).toEqual([num(3, 0), plus])
  })

  it('swapSlots', () => {
    const plus = createOperatorLeaf('+')
    const base: Slot[] = [num(3, 0), plus, num(7, 1)]
    const swapped = swapSlots(base, 0, 2)
    checkInvariant(swapped)
    expect(swapped).toEqual([num(7, 1), plus, num(3, 0)])
  })

  it('removeOperand — removing the last operand removes the preceding operator too (concept 3: "3+7 -> 3")', () => {
    const base: Slot[] = [num(3, 0), createOperatorLeaf('+'), num(7, 1)]
    const removed = removeOperand(base, 2)
    checkInvariant(removed)
    expect(removed).toEqual([num(3, 0)])
  })

  it('removeOperand — removing a non-last operand removes the following operator', () => {
    const base: Slot[] = [num(3, 0), createOperatorLeaf('+'), num(7, 1)]
    const removed = removeOperand(base, 0)
    checkInvariant(removed)
    expect(removed).toEqual([num(7, 1)])
  })

  it('removeOperator leaves a gap, not a shorter list', () => {
    const base: Slot[] = [num(3, 0), createOperatorLeaf('+'), num(7, 1)]
    const removed = removeOperator(base, 1)
    checkInvariant(removed)
    expect(removed).toEqual([num(3, 0), null, num(7, 1)])
    expect(isExpressionComplete({ root: { id: 'root', kind: 'group', children: removed } })).toBe(false)
  })

  it('wrapGroup / dissolveGroup', () => {
    const base: Slot[] = [num(3, 0), createOperatorLeaf('+'), num(7, 1)]
    const wrapped = wrapGroup(base, 0, 3)
    checkInvariant(wrapped)
    const dissolved = dissolveGroup(wrapped, 0)
    checkInvariant(dissolved)
  })
})

describe('[6,6,9]: equal-valued leaves stay distinguishable via `source` (concept 2, 17)', () => {
  it('through insert, swap, and dissolve', () => {
    const tray = createTray([6, 6, 9])
    expect(tray[0].source).toBe(0)
    expect(tray[1].source).toBe(1)
    expect(tray[0].value).toBe(tray[1].value)
    expect(tray[0].id).not.toBe(tray[1].id)

    let children: Slot[] = []
    children = insertOperand(children, 0, tray[0]) // first 6 (source 0)
    children = insertOperand(children, 1, createOperatorLeaf('+'))
    children = insertOperand(children, 2, tray[1]) // second 6 (source 1)

    // swap the two equal-valued leaves — still distinguishable afterwards
    children = swapSlots(children, 0, 2)
    expect((children[0] as NumberLeaf).source).toBe(1)
    expect((children[2] as NumberLeaf).source).toBe(0)

    // wrap them into a group and dissolve — source survives the round trip
    const wrapped = wrapGroup(children, 0, 3)
    const dissolved = dissolveGroup(wrapped, 0)
    expect((dissolved[0] as NumberLeaf).source).toBe(1)
    expect((dissolved[2] as NumberLeaf).source).toBe(0)
  })
})

// ------------------------------------------------------------- completeness

describe('isGroupComplete', () => {
  it('a freshly created empty group is incomplete and shows its minimum shape', () => {
    const g = createEmptyGroup()
    expect(g.children).toEqual([null, null, null])
    expect(isGroupComplete(g)).toBe(false)
  })

  it('needs at least two operands (length >= 3), unlike the root', () => {
    const g: Group = { id: 'g', kind: 'group', children: [num(3, 0)] } // length 1, filled, odd — but too short
    expect(isGroupComplete(g)).toBe(false)
  })

  it('is complete once every slot is filled and the length is odd', () => {
    const g: Group = { id: 'g', kind: 'group', children: [num(3, 0), createOperatorLeaf('+'), num(7, 1)] }
    expect(isGroupComplete(g)).toBe(true)
  })
})

describe('isExpressionComplete', () => {
  it('an empty root is incomplete', () => {
    expect(isExpressionComplete(createExpression())).toBe(false)
  })

  it('a root with a trailing gap is incomplete', () => {
    const expr = createExpression()
    expr.root.children = [num(3, 0), null]
    expect(isExpressionComplete(expr)).toBe(false)
  })

  it('a root containing an incomplete group is incomplete', () => {
    const expr = createExpression()
    expr.root.children = [createEmptyGroup()]
    expect(isExpressionComplete(expr)).toBe(false)
  })

  it('a root containing a complete group is complete', () => {
    const expr = createExpression()
    const g: Group = { id: 'g', kind: 'group', children: [num(6, 0), createOperatorLeaf('+'), num(2, 1)] }
    expr.root.children = [g, createOperatorLeaf('*'), num(9, 2)]
    expect(isExpressionComplete(expr)).toBe(true)
  })

  it('the root itself needs no minimum length unlike a group — a single number is "complete"', () => {
    const expr = createExpression()
    expr.root.children = [num(5, 0)]
    expect(isExpressionComplete(expr)).toBe(true)
  })
})

// ---------------------------------------------------------------- drop zones

describe('dropZones (concept 3.1)', () => {
  it('alternates operand/operator by position, plus one trailing frontier zone', () => {
    const children: Slot[] = [num(3, 0), createOperatorLeaf('+'), num(7, 1)]
    const zones = dropZones(children)
    expect(zones.map(z => z.kind)).toEqual(['operand', 'operator', 'operand', 'operator'])
    expect(zones).toHaveLength(children.length + 1)
  })

  it('marks filled positions as occupied (a swap target) and the trailing frontier as not occupied', () => {
    const children: Slot[] = [num(3, 0), null]
    const zones = dropZones(children)
    expect(zones[0].occupied).toBe(true)
    expect(zones[1].occupied).toBe(false) // the null gap itself
    expect(zones[2].occupied).toBe(false) // the trailing frontier
  })
})
