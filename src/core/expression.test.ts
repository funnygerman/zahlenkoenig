import { describe, it, expect } from 'vitest'
import {
  createExpression, createTray, createOperatorLeaf, createEmptyGroup,
  insertOperand, placeAt, trimTrailingGaps, fillGap, swapSlots, removeOperand, removeOperator,
  wrapGroup, dissolveGroup, dropZones, nextOpenSurface, nextOpenRootSurface, resolveBlockDrop,
  tapBlockTarget, rootWidth, applyBlockDrop, absorbIntoGroup, connectingPair, absorbPairIntoGroup,
  insertLeafIntoGroup, moveGroup,
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

/** A readable summary of a Leaf|Group|null list — numbers and operator glyphs, groups spelled out recursively. Used where a test cares about content and order, not ids. */
function flat(children: readonly (Slot | null)[]): unknown[] {
  return children.map(c => {
    if (c === null) return null
    if (c.kind === 'group') return flat(c.children)
    return c.kind === 'number' ? c.value : c.value
  })
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

describe('placeAt: an open position can be anywhere, including past the end', () => {
  it('fills a gap inside the sequence without changing its length', () => {
    expect(placeAt([1, null, 3], 1, 2)).toEqual([1, 2, 3])
  })

  it('appends at the frontier', () => {
    expect(placeAt([1, 2], 2, 3)).toEqual([1, 2, 3])
  })

  it('opens every position in between when the target is past the end', () => {
    // The player dropped into the third scaffold slot of an empty field.
    // The two positions before it are now real, open gaps — not skipped,
    // and not silently collapsed to the front.
    expect(placeAt([], 4, 'x')).toEqual([null, null, null, null, 'x'])
  })

  it('displaces nothing — the node ends up at exactly the index asked for', () => {
    const out = placeAt([1, 2, 3], 6, 9)
    expect(out[6]).toBe(9)
    expect(out.slice(0, 3)).toEqual([1, 2, 3])
    expect(out).toHaveLength(7)
  })

  it('leaves the input untouched', () => {
    const input = [1, null, 3]
    placeAt(input, 5, 9)
    expect(input).toEqual([1, null, 3])
  })
})

describe('trimTrailingGaps', () => {
  it('drops open positions at the end', () => {
    expect(trimTrailingGaps([1, 2, 3, null, null])).toEqual([1, 2, 3])
  })

  it('keeps gaps that still have content behind them', () => {
    expect(trimTrailingGaps([1, null, 3])).toEqual([1, null, 3])
  })

  it('leaves a sequence with no trailing gap alone', () => {
    expect(trimTrailingGaps([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('collapses an all-gap sequence to empty', () => {
    expect(trimTrailingGaps([null, null])).toEqual([])
  })

  it('is what keeps a finished expression from looking unfinished', () => {
    // `3 + 7 ⬚` has an even length, so isFilledAndOdd says incomplete and
    // `=` would stay disabled on an expression that is in fact done.
    const children = [num(3, 0), createOperatorLeaf('+'), num(7, 1), null]
    expect(isExpressionComplete({ root: { id: 'root', kind: 'group', children } })).toBe(false)
    expect(isExpressionComplete({ root: { id: 'root', kind: 'group', children: trimTrailingGaps(children) } })).toBe(true)
  })
})

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

// ---------------------------------------------------------- next open surface

describe('nextOpenSurface (concept 3.1: document order, group interiors first)', () => {
  it('an empty root: the first operand surface is index 0', () => {
    expect(nextOpenSurface(createExpression(), 'operand')).toEqual({ groupId: null, index: 0, kind: 'operand' })
  })

  it('an empty root: the first operator surface is index 1, with the operand before it left open', () => {
    // Structural, not a judgement about whether starting with an operator
    // is sensible: index 1 IS where an operator goes. `placeAt` opens
    // index 0, and the field draws it as the gap it is.
    expect(nextOpenSurface(createExpression(), 'operator')).toEqual({ groupId: null, index: 1, kind: 'operator' })
  })

  it('after one number, a second number goes at index 2 — the operator between them stays open', () => {
    // The rule that makes tapping two numbers in a row work at all.
    const expr = createExpression()
    expr.root.children = [num(3, 0)]
    expect(nextOpenSurface(expr, 'operand')).toEqual({ groupId: null, index: 2, kind: 'operand' })
  })

  it('after one number, the next operator surface is the trailing frontier', () => {
    const expr = createExpression()
    expr.root.children = [num(3, 0)]
    expect(nextOpenSurface(expr, 'operator')).toEqual({ groupId: null, index: 1, kind: 'operator' })
  })

  it('a stored gap (from a mid-sequence insert or a removed operator) counts before the trailing frontier', () => {
    const expr = createExpression()
    expr.root.children = [num(3, 0), null, num(7, 1)] // e.g. after removeOperator
    expect(nextOpenSurface(expr, 'operator')).toEqual({ groupId: null, index: 1, kind: 'operator' })
  })

  it("a group's own interior comes before the surface behind the group (concept 3.1's own wording)", () => {
    const expr = createExpression()
    const g: Group = { id: 'g1', kind: 'group', children: [num(6, 0), null, num(2, 1)] }
    expr.root.children = [g] // root's own trailing frontier (index 1) would also be an operator surface
    expect(nextOpenSurface(expr, 'operator')).toEqual({ groupId: 'g1', index: 1, kind: 'operator' })
  })

  it('falls through to the root frontier once every group is complete', () => {
    const expr = createExpression()
    const g: Group = { id: 'g1', kind: 'group', children: [num(6, 0), createOperatorLeaf('+'), num(2, 1)] }
    expr.root.children = [g]
    expect(nextOpenSurface(expr, 'operator')).toEqual({ groupId: null, index: 1, kind: 'operator' })
  })

  it('names a position past the end even on a complete tree — the budget is the caller\'s job, not this function\'s', () => {
    // [3, +, 7] is complete and has no stored gap, but index 4 is still
    // where a fourth operand would structurally go. `useGame` is what
    // knows a 2-number puzzle has no fourth operand to put there.
    const expr = createExpression()
    expr.root.children = [num(3, 0), createOperatorLeaf('+'), num(7, 1)]
    expect(nextOpenSurface(expr, 'operand')).toEqual({ groupId: null, index: 4, kind: 'operand' })
  })

  it("is purely structural — the trailing frontier is 'open' regardless of whether the puzzle actually has another chip of that kind left; gating that is the caller's job", () => {
    const expr = createExpression()
    expr.root.children = [num(3, 0), createOperatorLeaf('+'), num(7, 1)] // already complete for a 2-number puzzle
    expect(nextOpenSurface(expr, 'operator')).toEqual({ groupId: null, index: 3, kind: 'operator' })
  })
})

describe('nextOpenRootSurface (a block only ever targets a root position)', () => {
  it('an empty root: the first operand surface is index 0, same as nextOpenSurface', () => {
    expect(nextOpenRootSurface(createExpression(), 'operand')).toEqual({ groupId: null, index: 0, kind: 'operand' })
  })

  it("does not descend into a group's interior, unlike nextOpenSurface", () => {
    const expr = createExpression()
    const g: Group = { id: 'g1', kind: 'group', children: [num(6, 0), null, num(2, 1)] }
    expr.root.children = [g]
    // nextOpenSurface would find the group's own open operator slot first
    // (index 1 inside g1) — a second block must skip straight past it to
    // the root's own trailing frontier instead.
    expect(nextOpenSurface(expr, 'operator')).toEqual({ groupId: 'g1', index: 1, kind: 'operator' })
    expect(nextOpenRootSurface(expr, 'operator')).toEqual({ groupId: null, index: 1, kind: 'operator' })
  })

  it("steps past a still-open group to the operand position beyond it, never into its interior", () => {
    // [g] is length 1, so the position right after it is an *operator* one
    // (concept 2.1's parity) and the next operand is index 2 — a second
    // block goes beside the first, with an open operator between them.
    // The point is what it must NOT do: wander into g's own still-open
    // interior the way nextOpenSurface would, and overwrite g.
    const expr = createExpression()
    const g: Group = { id: 'g1', kind: 'group', children: [null, null, null] } // freshly placed, nothing filled yet
    expr.root.children = [g]
    expect(nextOpenSurface(expr, 'operand')).toEqual({ groupId: 'g1', index: 0, kind: 'operand' })
    expect(nextOpenRootSurface(expr, 'operand')).toEqual({ groupId: null, index: 2, kind: 'operand' })
  })

  it('a second block goes after the first once an operator separates them', () => {
    const expr = createExpression()
    const g: Group = { id: 'g1', kind: 'group', children: [num(6, 0), createOperatorLeaf('+'), num(2, 1)] }
    expr.root.children = [g, createOperatorLeaf('*')]
    expect(nextOpenRootSurface(expr, 'operand')).toEqual({ groupId: null, index: 2, kind: 'operand' })
  })

  it('a stored root-level gap counts before the trailing frontier, same as nextOpenSurface', () => {
    const expr = createExpression()
    expr.root.children = [num(3, 0), null, num(7, 1)]
    expect(nextOpenRootSurface(expr, 'operator')).toEqual({ groupId: null, index: 1, kind: 'operator' })
  })

  it('names a position past the end, same as nextOpenSurface — the budget gate is the caller\'s', () => {
    const expr = createExpression()
    expr.root.children = [num(3, 0), createOperatorLeaf('+'), num(7, 1)]
    expect(nextOpenRootSurface(expr, 'operand')).toEqual({ groupId: null, index: 4, kind: 'operand' })
  })
})

// --------------------------------------------------------- block drop targeting

describe('resolveBlockDrop (concept 6.1 — a block always encloses three root positions)', () => {
  // `width` is the board's own root width: 2n−1 positions, less 2 for each
  // group already placed (`rootWidth`). Passed explicitly here so each case
  // says which puzzle it is about.

  it('an empty operand slot: the bracket lands exactly there', () => {
    const children: Slot[] = [null]
    expect(resolveBlockDrop(children, 0, 5)).toBe(0)
  })

  it('the trailing frontier of an empty (or not-yet-that-long) root is also just an open slot, not a crash', () => {
    expect(resolveBlockDrop([], 0, 5)).toBe(0)
    expect(resolveBlockDrop([num(3, 0), createOperatorLeaf('+')], 2, 5)).toBe(2)
  })

  it('an empty slot never slides sideways — it is where the player put the block, and the hint depends on it (`2 ×` needs a bracket at 2, not a wrap of the 2)', () => {
    const children: Slot[] = [num(2, 0), createOperatorLeaf('*')]
    expect(resolveBlockDrop(children, 2, 5)).toBe(2)
  })

  it('an operator position is never resolved in this pass', () => {
    const children: Slot[] = [num(6, 0), createOperatorLeaf('+'), num(2, 1)]
    expect(resolveBlockDrop(children, 1, 5)).toBeNull()
  })

  it('an existing group is not itself a valid target', () => {
    const g: Group = { id: 'g1', kind: 'group', children: [num(6, 0), createOperatorLeaf('+'), num(2, 1)] }
    expect(resolveBlockDrop([g], 0, 3)).toBeNull()
  })

  it('right-before-left: "6 + 2 × 9", targeting 6 wraps (6+2) — the pair to the right', () => {
    const children: Slot[] = [num(6, 0), createOperatorLeaf('+'), num(2, 1), createOperatorLeaf('*'), num(9, 2)]
    expect(resolveBlockDrop(children, 0, 5)).toBe(0)
  })

  it('targeting the middle number (2) also prefers the pair to its right: (2×9)', () => {
    const children: Slot[] = [num(6, 0), createOperatorLeaf('+'), num(2, 1), createOperatorLeaf('*'), num(9, 2)]
    expect(resolveBlockDrop(children, 2, 5)).toBe(2)
  })

  it('the last number has no pair to its right, so it falls back to the pair on its left', () => {
    const children: Slot[] = [num(6, 0), createOperatorLeaf('+'), num(2, 1), createOperatorLeaf('*'), num(9, 2)]
    expect(resolveBlockDrop(children, 4, 5)).toBe(2)
  })

  it('a placed operator to the right is enough on its own — "a +" wraps (a + ⬚), it does not fall back to wrapping the a alone (PO)', () => {
    const children: Slot[] = [num(6, 0), createOperatorLeaf('+')]
    expect(resolveBlockDrop(children, 0, 7)).toBe(0)
  })

  it('...and the same board one chip later: "a + b −" faces right again, because the − is there', () => {
    const children: Slot[] = [num(6, 0), createOperatorLeaf('+'), num(2, 1), createOperatorLeaf('-')]
    expect(resolveBlockDrop(children, 2, 7)).toBe(2)
  })

  it('...while "a + b" with nothing after it faces left and wraps all three', () => {
    const children: Slot[] = [num(6, 0), createOperatorLeaf('+'), num(2, 1)]
    expect(resolveBlockDrop(children, 2, 7)).toBe(0)
  })

  it('a lone number with nothing either side encloses itself and the two open positions after it', () => {
    const children: Slot[] = [num(5, 0)]
    expect(resolveBlockDrop(children, 0, 5)).toBe(0)
  })

  it('never reaches across an existing group — a neighboring group is treated as absent, not as a pairable leaf', () => {
    const g: Group = { id: 'g1', kind: 'group', children: [num(1, 0), createOperatorLeaf('+'), num(1, 1)] }
    // (1+1) × 9 on a four-number board. Targeting the 9 encloses it and the
    // two open positions after it — never the group on its left, which is
    // what "treated as absent" means: the answer is 2, not 0.
    const children: Slot[] = [g, createOperatorLeaf('*'), num(9, 2)]
    expect(resolveBlockDrop(children, 2, 5)).toBe(2)
  })

  it('an open operator gap between two numbers still pairs them — the gap travels into the group, it does not block the wrap', () => {
    // "6, ⬚, 2" (concept 3.1's two-numbers-in-a-row): a real operand two
    // positions along reads as a pair even with no operator tapped yet,
    // which is why the rightward test is an *or*, not just the operator.
    const children: Slot[] = [num(6, 0), null, num(2, 1)]
    expect(resolveBlockDrop(children, 0, 5)).toBe(0)
    expect(resolveBlockDrop(children, 2, 5)).toBe(0)
  })

  it('refuses rather than enclosing positions the puzzle does not have', () => {
    // Two numbers: three board positions in all, so a bracket can only ever
    // start at 0. Targeting the last number falls back to that one...
    const children: Slot[] = [num(6, 0), createOperatorLeaf('+'), num(2, 1)]
    expect(resolveBlockDrop(children, 2, 3)).toBe(0)
    // ...and once that one bracket is placed, the board is two positions
    // narrower and there is nowhere left at all.
    const g: Group = { id: 'g1', kind: 'group', children: [num(6, 0), createOperatorLeaf('+'), num(2, 1)] }
    expect(resolveBlockDrop([g], 0, 3)).toBeNull()
    expect(resolveBlockDrop([g], 2, 3)).toBeNull()
  })
})

describe('rootWidth (how many root positions a board has left to offer)', () => {
  it('a flat board: 2n−1', () => {
    expect(rootWidth([], 4)).toBe(7)
    expect(rootWidth([num(6, 0)], 3)).toBe(5)
  })

  it('each placed group costs two — it shows three board positions inside one root slot', () => {
    const g: Group = { id: 'g1', kind: 'group', children: [num(6, 0), createOperatorLeaf('+'), num(2, 1)] }
    expect(rootWidth([g], 4)).toBe(5)
    expect(rootWidth([g, createOperatorLeaf('*'), g], 4)).toBe(3)
  })
})

describe('tapBlockTarget (where a tapped block chip lands — it borrows the anchor, PO)', () => {
  it('an empty root with no anchor yet: the very first position', () => {
    expect(tapBlockTarget([], 0, 7)).toBe(0)
  })

  it('a number already placed: that same position, not past it — a tapped block wraps content, it does not skip it', () => {
    expect(tapBlockTarget([num(6, 0)], 0, 5)).toBe(0)
  })

  it('the anchor is what decides, not document order: the same flat board wraps the head or the tail depending on where the player last worked', () => {
    const children: Slot[] = [num(6, 0), createOperatorLeaf('+'), num(2, 1), createOperatorLeaf('*'), num(9, 2)]
    expect(tapBlockTarget(children, 0, 5)).toBe(0) // last worked on the 6 -> (6 + 2) × 9
    expect(tapBlockTarget(children, 4, 5)).toBe(2) // last worked on the 9 -> 6 + (2 × 9)
  })

  it('an existing group is never a target: the scan steps past it to the next spot that fits', () => {
    const g: Group = { id: 'g1', kind: 'group', children: [num(6, 0), createOperatorLeaf('+'), num(2, 1)] }
    expect(tapBlockTarget([g], 0, 5)).toBe(2)
  })

  it('a bracket on the right leaves only the left end, whatever the anchor says', () => {
    const g: Group = { id: 'g1', kind: 'group', children: [num(9, 2), createOperatorLeaf('+'), num(3, 3)] }
    const children: Slot[] = [num(6, 0), createOperatorLeaf('+'), num(2, 1), createOperatorLeaf('*'), g]
    expect(tapBlockTarget(children, 4, 5)).toBe(0)
    expect(tapBlockTarget(children, 0, 5)).toBe(0)
  })

  it('a bracket in the middle leaves nowhere for a second one, so the tap does nothing at all (PO)', () => {
    const g: Group = { id: 'g1', kind: 'group', children: [num(2, 1), createOperatorLeaf('+'), num(9, 2)] }
    const children: Slot[] = [num(6, 0), createOperatorLeaf('+'), g, createOperatorLeaf('*'), num(3, 3)]
    expect(tapBlockTarget(children, 0, 5)).toBeNull()
    expect(tapBlockTarget(children, 4, 5)).toBeNull()
  })
})

describe('applyBlockDrop (concept 6.1/6.3: resolve, then apply — one place for the minimum-shape rule)', () => {
  it('an empty target: places a bare group at that index, minimum-shaped', () => {
    const result = applyBlockDrop([], 0, 5)
    expect(result[0]).toMatchObject({ kind: 'group' })
    expect((result[0] as Group).children).toEqual([null, null, null])
  })

  it('pads the scaffold first, so a bracket lands at the position it resolved to and not at the end of the stored array', () => {
    // an empty field is stored as `[]`, but the scaffold draws five
    // positions — a block released on the third one means that position.
    const result = applyBlockDrop([], 4, 5)
    expect(result.slice(0, 4)).toEqual([null, null, null, null])
    expect(result[4]).toMatchObject({ kind: 'group' })
  })

  it('a lone number is padded to the minimum shape', () => {
    const children: Slot[] = [num(6, 0)]
    const result = applyBlockDrop(children, 0, 5)
    const group = result[0] as Group
    expect(group.children[0]).toMatchObject({ value: 6 })
    expect(group.children).toHaveLength(3)
  })

  it('a full pair needs no padding — it is already the minimum shape', () => {
    const children: Slot[] = [num(6, 0), createOperatorLeaf('+'), num(2, 1)]
    const result = applyBlockDrop(children, 0, 5)
    expect((result[0] as Group).children).toHaveLength(3)
  })

  it('a number with an operator after it and nothing yet beyond: the open position travels into the bracket (PO)', () => {
    const children: Slot[] = [num(6, 0), createOperatorLeaf('+')]
    const result = applyBlockDrop(children, 0, 7)
    const group = result[0] as Group
    expect(group.children[0]).toMatchObject({ value: 6 })
    expect(group.children[1]).toMatchObject({ value: '+' })
    expect(group.children[2]).toBeNull()
  })
})

describe('absorbIntoGroup (concept 6.2: growing a block past two numbers by absorbing a connected neighbor)', () => {
  it('before: absorbs the (operand, operator) pair in front of the group, in order', () => {
    const g: Group = { id: 'g1', kind: 'group', children: [num(2, 1), createOperatorLeaf('*'), num(9, 2)] }
    const children: Slot[] = [num(6, 0), createOperatorLeaf('+'), g]
    const result = absorbIntoGroup(children, 2, 'before')!
    expect(result).toHaveLength(1) // root shrinks to just the (now five-node) group
    expect(flat(result)).toEqual([[6, '+', 2, '*', 9]])
  })

  it('after: absorbs the (operator, operand) pair behind the group, in order', () => {
    const g: Group = { id: 'g1', kind: 'group', children: [num(6, 0), createOperatorLeaf('+'), num(2, 1)] }
    const children: Slot[] = [g, createOperatorLeaf('*'), num(9, 2)]
    const result = absorbIntoGroup(children, 0, 'after')!
    expect(result).toHaveLength(1)
    expect(flat(result)).toEqual([[6, '+', 2, '*', 9]])
  })

  it('keeps other root content in place around the shrunk root', () => {
    const g: Group = { id: 'g1', kind: 'group', children: [num(2, 1), createOperatorLeaf('*'), num(9, 2)] }
    const children: Slot[] = [num(6, 0), createOperatorLeaf('+'), g, createOperatorLeaf('-'), num(5, 3)]
    const result = absorbIntoGroup(children, 2, 'before')!
    expect(flat(result)).toEqual([[6, '+', 2, '*', 9], '-', 5])
  })

  it('returns null when the connecting operator is missing (an open gap instead)', () => {
    const g: Group = { id: 'g1', kind: 'group', children: [num(2, 1), createOperatorLeaf('*'), num(9, 2)] }
    const children: Slot[] = [num(6, 0), null, g]
    expect(absorbIntoGroup(children, 2, 'before')).toBeNull()
  })

  it('returns null when the far operand is missing (an open gap instead)', () => {
    const g: Group = { id: 'g1', kind: 'group', children: [num(2, 1), createOperatorLeaf('*'), num(9, 2)] }
    const children: Slot[] = [null, createOperatorLeaf('+'), g]
    expect(absorbIntoGroup(children, 2, 'before')).toBeNull()
  })

  it('returns null when the neighbor is itself a group — no nested groups (concept section 4)', () => {
    const g1: Group = { id: 'g1', kind: 'group', children: [num(2, 1), createOperatorLeaf('*'), num(9, 2)] }
    const g2: Group = { id: 'g2', kind: 'group', children: [num(4, 3), createOperatorLeaf('/'), num(1, 0)] }
    const children: Slot[] = [g2, createOperatorLeaf('+'), g1]
    expect(absorbIntoGroup(children, 2, 'before')).toBeNull()
  })

  it('returns null when there is nothing at all on that side (the group is at the very front)', () => {
    const g: Group = { id: 'g1', kind: 'group', children: [num(2, 1), createOperatorLeaf('*'), num(9, 2)] }
    expect(absorbIntoGroup([g], 0, 'before')).toBeNull()
  })

  it("absorbing a pair always adds exactly two — an odd (complete) shape stays odd, an even (mid-build) shape stays even", () => {
    const g: Group = { id: 'g1', kind: 'group', children: [num(2, 1), createOperatorLeaf('*'), num(9, 2), createOperatorLeaf('+')] } // grown to 4 already, mid-build
    const children: Slot[] = [num(6, 0), createOperatorLeaf('-'), g]
    const result = absorbIntoGroup(children, 2, 'before')!
    const group = result[0] as Group
    expect(group.children).toHaveLength(6) // 4 + 2
  })
})

// The fourth device round's report, in fixtures. Letters read better than
// digits for a structural test, so a=1, b=2, c=3, d=4 throughout, and the
// three shapes are exactly the ones the PO listed: a block at the front, in
// the middle and at the end of a four-number row.
const a = () => num(1, 0)
const b = () => num(2, 1)
const c = () => num(3, 2)
const d = () => num(4, 3)
function grp(...children: (Slot & object | null)[]): Group {
  return { id: 'g1', kind: 'group', children: children as Group['children'] }
}

describe('connectingPair (concept 6.1 seen from the other end: a leaf and the partner it brings along)', () => {
  it('an operand takes the operator on the side facing the block, not the one behind it', () => {
    // (a+b) × c − d: "c" faces the block leftwards, so it brings "×", not "−"
    const children: Slot[] = [grp(a(), createOperatorLeaf('+'), b()), createOperatorLeaf('*'), c(), createOperatorLeaf('-'), d()]
    expect(connectingPair(children, 2, 0)).toBe(1) // the pair sits at root 1..2
    expect(connectingPair(children, 4, 0)).toBe(3) // "d" brings "−"
  })

  it('an operator and its operand are the same pair — either half may be grabbed (concept 6.1)', () => {
    const children: Slot[] = [grp(a(), createOperatorLeaf('+'), b()), createOperatorLeaf('*'), c()]
    expect(connectingPair(children, 1, 0)).toBe(connectingPair(children, 2, 0))
  })

  it('on the block’s left, the operand is the outer half and the operator the inner one', () => {
    // a × (b+c): "a" brings "×", which stands between it and the block
    const children: Slot[] = [a(), createOperatorLeaf('*'), grp(b(), createOperatorLeaf('+'), c())]
    expect(connectingPair(children, 0, 2)).toBe(0)
    expect(connectingPair(children, 1, 2)).toBe(0)
  })

  it('an open gap is a valid half — that is how a block is prepared for a third number', () => {
    const children: Slot[] = [grp(a(), createOperatorLeaf('+'), b()), createOperatorLeaf('*'), null]
    expect(connectingPair(children, 1, 0)).toBe(1)
  })

  it('refuses to travel through a second block (concept section 4)', () => {
    const g2: Group = { id: 'g2', kind: 'group', children: [c(), createOperatorLeaf('-'), d()] }
    const children: Slot[] = [grp(a(), createOperatorLeaf('+'), b()), createOperatorLeaf('*'), g2, createOperatorLeaf('+'), num(5, 4)]
    expect(connectingPair(children, 4, 0)).toBeNull()
  })

  it('refuses the block itself, and anything that is not a root-level leaf', () => {
    const children: Slot[] = [grp(a(), createOperatorLeaf('+'), b()), createOperatorLeaf('*'), c()]
    expect(connectingPair(children, 0, 0)).toBeNull()
    expect(connectingPair(children, 9, 0)).toBeNull()
  })
})

describe('absorbPairIntoGroup (concept 6.2, PO 4th round: the drop decides the side, the leaf decides the pair)', () => {
  it('(a+b) × c − d: "× c" onto the block’s right end → (a + b × c) − d', () => {
    const children: Slot[] = [grp(a(), createOperatorLeaf('+'), b()), createOperatorLeaf('*'), c(), createOperatorLeaf('-'), d()]
    expect(flat(absorbPairIntoGroup(children, 0, 1, 'after')!)).toEqual([[1, '+', 2, '*', 3], '-', 4])
  })

  it('(a+b) × c − d: the same pair onto the block’s LEFT end → (c × a + b) − d', () => {
    const children: Slot[] = [grp(a(), createOperatorLeaf('+'), b()), createOperatorLeaf('*'), c(), createOperatorLeaf('-'), d()]
    expect(flat(absorbPairIntoGroup(children, 0, 1, 'before')!)).toEqual([[3, '*', 1, '+', 2], '-', 4])
  })

  it('grabbing the number instead of its operator is the same gesture', () => {
    const children: Slot[] = [grp(a(), createOperatorLeaf('+'), b()), createOperatorLeaf('*'), c(), createOperatorLeaf('-'), d()]
    expect(flat(absorbPairIntoGroup(children, 0, 2, 'after')!)).toEqual(flat(absorbPairIntoGroup(children, 0, 1, 'after')!))
  })

  it('(a+b) × c − d: "− d", two positions away, still joins → (a + b − d) × c', () => {
    const children: Slot[] = [grp(a(), createOperatorLeaf('+'), b()), createOperatorLeaf('*'), c(), createOperatorLeaf('-'), d()]
    expect(flat(absorbPairIntoGroup(children, 0, 4, 'after')!)).toEqual([[1, '+', 2, '-', 4], '*', 3])
    expect(flat(absorbPairIntoGroup(children, 0, 3, 'before')!)).toEqual([[4, '-', 1, '+', 2], '*', 3])
  })

  it('a × (b+c) − d: "a ×" onto the left end → (a × b + c) − d, onto the right end → (b + c × a) − d', () => {
    const children: Slot[] = [a(), createOperatorLeaf('*'), grp(b(), createOperatorLeaf('+'), c()), createOperatorLeaf('-'), d()]
    expect(flat(absorbPairIntoGroup(children, 2, 0, 'before')!)).toEqual([[1, '*', 2, '+', 3], '-', 4])
    expect(flat(absorbPairIntoGroup(children, 2, 0, 'after')!)).toEqual([[2, '+', 3, '*', 1], '-', 4])
  })

  it('a × (b+c) − d: "− d" joins from the far side → a × (b + c − d)', () => {
    const children: Slot[] = [a(), createOperatorLeaf('*'), grp(b(), createOperatorLeaf('+'), c()), createOperatorLeaf('-'), d()]
    expect(flat(absorbPairIntoGroup(children, 2, 4, 'after')!)).toEqual([1, '*', [2, '+', 3, '-', 4]])
  })

  it('a + b × (c−d): "b ×" onto the left end → a + (b × c − d), onto the right → a + (c − d × b)', () => {
    const children: Slot[] = [a(), createOperatorLeaf('+'), b(), createOperatorLeaf('*'), grp(c(), createOperatorLeaf('-'), d())]
    expect(flat(absorbPairIntoGroup(children, 4, 2, 'before')!)).toEqual([1, '+', [2, '*', 3, '-', 4]])
    expect(flat(absorbPairIntoGroup(children, 4, 2, 'after')!)).toEqual([1, '+', [3, '-', 4, '*', 2]])
  })

  it('a + b × (c−d): "a +" travels past "b ×" → b × (a + c − d)', () => {
    const children: Slot[] = [a(), createOperatorLeaf('+'), b(), createOperatorLeaf('*'), grp(c(), createOperatorLeaf('-'), d())]
    expect(flat(absorbPairIntoGroup(children, 4, 0, 'before')!)).toEqual([2, '*', [1, '+', 3, '-', 4]])
    expect(flat(absorbPairIntoGroup(children, 4, 0, 'after')!)).toEqual([2, '*', [3, '-', 4, '+', 1]])
  })

  it('an open gap travels along as a gap — the block is prepared, not filled', () => {
    const children: Slot[] = [grp(a(), createOperatorLeaf('+'), b()), createOperatorLeaf('*'), null]
    const result = absorbPairIntoGroup(children, 0, 1, 'after')!
    expect(flat(result)).toEqual([[1, '+', 2, '*', null]])
  })

  it('keeps the root alternating, whichever end and whichever direction', () => {
    const children: Slot[] = [grp(a(), createOperatorLeaf('+'), b()), createOperatorLeaf('*'), c(), createOperatorLeaf('-'), d()]
    for (const leafIndex of [1, 2, 3, 4]) {
      for (const side of ['before', 'after'] as const) {
        checkInvariant(absorbPairIntoGroup(children, 0, leafIndex, side)!)
      }
    }
  })
})

describe('insertLeafIntoGroup (concept 6.2: a tray chip joins a block with an open slot for its partner)', () => {
  it('a number arrives with an empty operator slot beside it, on the dropped side', () => {
    const children: Slot[] = [grp(a(), createOperatorLeaf('+'), b())]
    expect(flat(insertLeafIntoGroup(children, 0, 'after', c())!)).toEqual([[1, '+', 2, null, 3]])
    expect(flat(insertLeafIntoGroup(children, 0, 'before', c())!)).toEqual([[3, null, 1, '+', 2]])
  })

  it('an operator arrives with an empty number slot beside it', () => {
    const children: Slot[] = [grp(a(), createOperatorLeaf('+'), b())]
    expect(flat(insertLeafIntoGroup(children, 0, 'after', createOperatorLeaf('*'))!)).toEqual([[1, '+', 2, '*', null]])
    expect(flat(insertLeafIntoGroup(children, 0, 'before', createOperatorLeaf('*'))!)).toEqual([[null, '*', 1, '+', 2]])
  })

  it('returns null when there is no block at that index', () => {
    expect(insertLeafIntoGroup([a()], 0, 'after', c())).toBeNull()
  })
})

describe('moveGroup (concept 6.5, revised: the brackets slide, the content stays)', () => {
  const MAX = 7 // a four-number puzzle: 2n − 1 positions

  it('(a × b) + c − d → a × (b + c) − d, dropped on the block’s own second number', () => {
    const children: Slot[] = [grp(a(), createOperatorLeaf('*'), b()), createOperatorLeaf('+'), c(), createOperatorLeaf('-'), d()]
    expect(flat(moveGroup(children, 0, 2, MAX)!)).toEqual([1, '*', [2, '+', 3], '-', 4])
  })

  it('(a × b) + c − d → a × b + (c − d), dropped on "c"', () => {
    const children: Slot[] = [grp(a(), createOperatorLeaf('*'), b()), createOperatorLeaf('+'), c(), createOperatorLeaf('-'), d()]
    expect(flat(moveGroup(children, 0, 4, MAX)!)).toEqual([1, '*', 2, '+', [3, '-', 4]])
  })

  it('a × (b + c − d) → (a × b + c) − d: a three-number block keeps all three', () => {
    const children: Slot[] = [a(), createOperatorLeaf('*'), grp(b(), createOperatorLeaf('+'), c(), createOperatorLeaf('-'), d())]
    expect(flat(moveGroup(children, 2, 0, MAX)!)).toEqual([[1, '*', 2, '+', 3], '-', 4])
  })

  it('(a × b + c) − d → a × (b + c − d), the same move back', () => {
    const children: Slot[] = [grp(a(), createOperatorLeaf('*'), b(), createOperatorLeaf('+'), c()), createOperatorLeaf('-'), d()]
    expect(flat(moveGroup(children, 0, 2, MAX)!)).toEqual([1, '*', [2, '+', 3, '-', 4]])
  })

  it('an operator position anchors the pair it belongs to (concept 6.1’s "nützliche Überschneidung")', () => {
    const children: Slot[] = [grp(a(), createOperatorLeaf('*'), b()), createOperatorLeaf('+'), c(), createOperatorLeaf('-'), d()]
    expect(flat(moveGroup(children, 0, 3, MAX)!)).toEqual(flat(moveGroup(children, 0, 2, MAX)!))
  })

  it('opens the positions it reaches into, and never reaches past the puzzle’s own end', () => {
    // (a+b) × c, dropped on "c": the block wants two operands, and the
    // fourth number of a four-number puzzle is still to come.
    const children: Slot[] = [grp(a(), createOperatorLeaf('+'), b()), createOperatorLeaf('*'), c()]
    expect(flat(moveGroup(children, 0, 4, MAX)!)).toEqual([1, '+', 2, '*', [3, null, null]])
    // dropped far past the end: clamped to the last position the block fits
    expect(flat(moveGroup(children, 0, 40, MAX)!)).toEqual([1, '+', 2, '*', [3, null, null]])
  })

  it('never encloses a second block (concept section 4)', () => {
    const g2: Group = { id: 'g2', kind: 'group', children: [c(), createOperatorLeaf('-'), d()] }
    const children: Slot[] = [grp(a(), createOperatorLeaf('+'), b()), createOperatorLeaf('*'), g2]
    expect(moveGroup(children, 0, 2, MAX)).toBeNull()
  })

  it('returns null when the block would land exactly where it already is', () => {
    const children: Slot[] = [grp(a(), createOperatorLeaf('*'), b()), createOperatorLeaf('+'), c(), createOperatorLeaf('-'), d()]
    expect(moveGroup(children, 0, 0, MAX)).toBeNull()
  })

  it('keeps the row alternating wherever it lands', () => {
    const children: Slot[] = [grp(a(), createOperatorLeaf('*'), b()), createOperatorLeaf('+'), c(), createOperatorLeaf('-'), d()]
    for (const anchor of [0, 1, 2, 3, 4, 5, 6]) {
      const moved = moveGroup(children, 0, anchor, MAX)
      if (moved) checkInvariant(moved)
    }
  })
})
