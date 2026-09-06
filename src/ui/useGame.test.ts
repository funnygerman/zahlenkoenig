import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGame } from './useGame'
import type { Operator } from '../core/expression'

const ALL_OPS: Operator[] = ['+', '-', '*', '/']

function setup(numbers: number[], target: number, ops: Operator[] = ALL_OPS) {
  return renderHook(() => useGame({ numbers, target, ops }))
}

function idOf(result: ReturnType<typeof setup>['result']['current'], value: number, nth = 0) {
  const matches = result.trayNumbers.filter(n => n.value === value)
  return matches[nth].id
}

describe('useGame — initial state', () => {
  it('nothing placed, submit disabled, status idle', () => {
    const { result } = setup([6, 2, 9, 3], 48)
    expect(result.current.trayNumbers.every(n => !n.used)).toBe(true)
    expect(result.current.blockDisabled).toBe(false) // floor(4/2) = 2, none used yet
    expect(result.current.submitEnabled).toBe(false)
    expect(result.current.status).toBe('idle')
    expect(result.current.result).toBeNull()
  })

  it('block budget is floor(n/2): one for 2-3 numbers, two for four', () => {
    const two = setup([3, 7], 10)
    act(() => two.result.current.onTapBlock())
    expect(two.result.current.blockDisabled).toBe(true) // budget 1, now used up

    const three = setup([3, 7, 9], 10)
    act(() => three.result.current.onTapBlock())
    expect(three.result.current.blockDisabled).toBe(true) // budget 1, now used up

    const four = setup([1, 2, 3, 4], 10)
    act(() => four.result.current.onTapBlock())
    expect(four.result.current.blockDisabled).toBe(false) // budget 2, one still free
  })
})

describe('useGame — tap-to-place and tap-to-return (concept 5)', () => {
  it('tapping numbers and operators in order builds a flat expression', () => {
    const { result } = setup([3, 7], 10)
    act(() => result.current.onTapNumber(idOf(result.current, 3)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 7)))

    expect(result.current.submitEnabled).toBe(true)
    expect(result.current.result).toBe(10)
    expect(result.current.trayNumbers.every(n => n.used)).toBe(true)
  })

  it('tapping a placed number again returns it to the tray (concept 6.6)', () => {
    const { result } = setup([3, 7], 10)
    const id3 = idOf(result.current, 3)
    act(() => result.current.onTapNumber(id3))
    expect(result.current.trayNumbers.find(n => n.id === id3)!.used).toBe(true)

    act(() => result.current.onTapNumber(id3))
    expect(result.current.trayNumbers.find(n => n.id === id3)!.used).toBe(false)
    expect(result.current.submitEnabled).toBe(false)
  })

  it("returning the last operand via tap leaves its operator in place — an open gap, not a second removal (concept 6.6: tap is the exact inverse of placing)", () => {
    const { result } = setup([3, 7], 10)
    const id3 = idOf(result.current, 3), id7 = idOf(result.current, 7)
    act(() => result.current.onTapNumber(id3))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(id7))
    act(() => result.current.onTapLeaf(id7)) // Expression.tsx's return-to-tray path
    // only the 7 returns to the tray; the '+' stays exactly where it was
    expect(result.current.trayNumbers.find(n => n.id === id3)!.used).toBe(true)
    expect(result.current.trayNumbers.find(n => n.id === id7)!.used).toBe(false)
    expect(result.current.expr.root.children).toHaveLength(2) // "3 +", waiting for a second operand — not collapsed to just "3"
    expect(result.current.submitEnabled).toBe(false)
  })

  it('a single placed number with nothing else is a "complete" expression (root has no minimum length, concept 2.1)', () => {
    const { result } = setup([3, 7], 3)
    act(() => result.current.onTapNumber(idOf(result.current, 3)))
    expect(result.current.submitEnabled).toBe(true)
    expect(result.current.result).toBe(3)
  })
})

describe('useGame — returning a placed number leaves everything else exactly where it was (concept 6.6)', () => {
  // Both reported as bugs: tapping either number in "6 + 2" took the '+'
  // with it, and tapping the *first* one additionally slid the second
  // number up to fill the gap — neither is the "exact inverse of placing"
  // concept 6.6 promises (placing only ever fills a slot, never touches a
  // neighbor).

  it('tapping the second number leaves the operator behind, not a collapsed single number', () => {
    const { result } = setup([6, 2], 10)
    act(() => result.current.onTapNumber(idOf(result.current, 6)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 2)))

    act(() => result.current.onTapLeaf(idOf(result.current, 2)))

    const children = result.current.expr.root.children
    expect(children).toHaveLength(2) // "6 +", not just "6"
    expect(children[0]).toMatchObject({ value: 6 })
    expect(children[1]).toMatchObject({ value: '+' })
    expect(result.current.trayNumbers.find(n => n.value === 2)!.used).toBe(false)
  })

  it('tapping the first number leaves a gap in front — the operator and second number do not slide up', () => {
    const { result } = setup([6, 2], 10)
    act(() => result.current.onTapNumber(idOf(result.current, 6)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 2)))

    act(() => result.current.onTapLeaf(idOf(result.current, 6)))

    const children = result.current.expr.root.children
    expect(children).toHaveLength(3) // "⬚ + 2", the shape is unchanged
    expect(children[0]).toBeNull()
    expect(children[1]).toMatchObject({ value: '+' })
    expect(children[2]).toMatchObject({ value: 2 }) // stayed put, did not slide into the gap
    expect(result.current.trayNumbers.find(n => n.value === 6)!.used).toBe(false)
  })
})

describe('useGame — blocks (concept 4/6)', () => {
  it('tapping the block chip places an empty group at the next operand surface, which then accepts numbers into its interior', () => {
    const { result } = setup([6, 2], 8)
    act(() => result.current.onTapBlock())
    expect(result.current.blockDisabled).toBe(true) // budget 1, now used up

    act(() => result.current.onTapNumber(idOf(result.current, 6)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 2)))
    expect(result.current.submitEnabled).toBe(true)
    expect(result.current.result).toBe(8)
  })

  it('cannot place more blocks than the budget allows', () => {
    const { result } = setup([3, 7], 10) // budget 1
    act(() => result.current.onTapBlock())
    expect(result.current.blockDisabled).toBe(true)

    act(() => result.current.onTapBlock()) // should no-op — the tray chip disables itself, but defend anyway
    expect(result.current.expr.root.children).toHaveLength(1)
  })

  it("tapping the block chip again puts a second block beside the first, never over it", () => {
    // Tap placement dives into a still-open group's own interior before
    // advancing past it (concept 3.1, document order) — so what must never
    // happen is the second tap finding that interior slot and overwriting
    // the first group with a fresh, empty one. `nextOpenRootSurface`
    // skips the interior; the operand position past the first block is
    // index 2, and tapping twice lays out concept 12.5's worst-case shape
    // (⬚○⬚) ○ (⬚○⬚) directly.
    const { result } = setup([1, 2, 3, 4], 10) // budget 2
    act(() => result.current.onTapBlock())
    const firstGroupId = (result.current.expr.root.children[0] as { id: string }).id

    act(() => result.current.onTapBlock())
    const children = result.current.expr.root.children
    expect(children).toHaveLength(3)
    const first = children[0] as { id: string; kind: string; children: unknown[] }
    const second = children[2] as { id: string; kind: string; children: unknown[] }
    expect(first.id).toBe(firstGroupId) // the first block is untouched...
    expect(first.children).toEqual([null, null, null])
    expect(second.kind).toBe('group') // ...and the second sits beside it
    expect(second.id).not.toBe(firstGroupId)
    expect(children[1]).toBeNull() // with an open operator position between them
    expect(result.current.blockDisabled).toBe(true) // both units of budget now used
  })

  it("taking a number back out of a block leaves the bracket at its minimum shape, not collapsed (concept 6.3)", () => {
    // removeOperand takes the operand's adjacent operator with it, which
    // for a 3-slot group means the bracket shrinks by two. `(6+2)` minus
    // its `+` and its `6` became `(2)`: no open slot inside, nothing to
    // drop into, dissolve-and-restart the only way out.
    const { result } = setup([6, 2, 9, 3], 48)
    act(() => result.current.onTapBlock())
    act(() => result.current.onTapNumber(idOf(result.current, 6)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 2)))
    const group = () => result.current.expr.root.children[0] as { kind: string; children: unknown[] }
    expect(group().children).toHaveLength(3)

    const plusId = (group().children[1] as { id: string }).id
    act(() => result.current.onTapLeaf(plusId))
    act(() => result.current.onTapLeaf(idOf(result.current, 6)))

    expect(group().kind).toBe('group')
    expect(group().children).toHaveLength(3) // still three slots, not the bare (2)
    // removeOperand closes up behind itself, so the 2 slides to the front
    // and the two open slots are the ones after it
    expect(group().children[0]).toMatchObject({ kind: 'number', value: 2 })
    expect(group().children[1]).toBeNull()
    expect(group().children[2]).toBeNull()
    // and it can be filled straight back in
    act(() => result.current.onTapNumber(idOf(result.current, 6)))
    act(() => result.current.onTapOperator('+'))
    expect(result.current.result).toBe(8)
  })

  it('emptying a block completely leaves it at its minimum shape too', () => {
    const { result } = setup([6, 2], 8)
    act(() => result.current.onTapBlock())
    act(() => result.current.onTapNumber(idOf(result.current, 6)))
    act(() => result.current.onTapLeaf(idOf(result.current, 6)))
    const group = result.current.expr.root.children[0] as { kind: string; children: unknown[] }
    expect(group.kind).toBe('group')
    expect(group.children).toEqual([null, null, null])
  })

  it('dissolving a group keeps its content in place (concept 6.5) and frees up the budget again', () => {
    const { result } = setup([6, 2], 8)
    act(() => result.current.onTapBlock())
    act(() => result.current.onTapNumber(idOf(result.current, 6)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 2)))
    expect(result.current.result).toBe(8)

    const groupId = (result.current.expr.root.children[0] as { id: string }).id
    act(() => result.current.onDissolveGroup(groupId))
    expect(result.current.expr.root.children).toHaveLength(3) // 6, +, 2 — flattened, nothing lost
    expect(result.current.result).toBe(8) // same value, no group needed for two numbers anyway
    expect(result.current.blockDisabled).toBe(false) // the block chip is available again
  })

  it("the full worst-case expression from concept 12.5 builds correctly via tap alone: (6+2)*(9-3) = 48", () => {
    const { result } = setup([6, 2, 9, 3], 48)

    act(() => result.current.onTapBlock())
    act(() => result.current.onTapNumber(idOf(result.current, 6)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 2)))
    act(() => result.current.onTapOperator('*'))
    act(() => result.current.onTapBlock())
    act(() => result.current.onTapNumber(idOf(result.current, 9)))
    act(() => result.current.onTapOperator('-'))
    act(() => result.current.onTapNumber(idOf(result.current, 3)))

    expect(result.current.submitEnabled).toBe(true)
    expect(result.current.result).toBe(48)
    act(() => result.current.onSubmit())
    expect(result.current.status).toBe('correct')
  })
})

describe('useGame — tapping the block chip wraps content already on the board (concept 6.1), not just an open slot', () => {
  // Tapping used to always target the next *open* root surface
  // (`nextOpenRootSurface`), so tapping the block chip after numbers were
  // already placed skipped right over them and opened a fresh empty group
  // past everything instead of wrapping what's there — even though concept
  // section 3 ("Ziehen und Tippen", PO) says tapping is dragging's own
  // resolution with a different trigger, and dragging already wraps
  // existing content (`resolveBlockDrop`).

  it('one number placed, then the block chip: wraps that number alone (span 1)', () => {
    const { result } = setup([6, 2, 9, 3], 48) // budget 2
    act(() => result.current.onTapNumber(idOf(result.current, 6)))
    act(() => result.current.onTapBlock())

    const children = result.current.expr.root.children
    expect(children).toHaveLength(1)
    const group = children[0] as { kind: string; children: ({ id: string; value?: number } | null)[] }
    expect(group.kind).toBe('group')
    expect(group.children[0]).toMatchObject({ value: 6 })
    expect(group.children[1]).toBeNull()
    expect(group.children[2]).toBeNull()

    // tapping the block chip again must not touch that group — it targets
    // the next root position past it, not the group's own open interior.
    act(() => result.current.onTapBlock())
    const after = result.current.expr.root.children
    expect(after).toHaveLength(3)
    expect(after[0]).toBe(children[0]) // the first group, untouched
    expect(after[1]).toBeNull()
    expect((after[2] as { kind: string }).kind).toBe('group')
  })

  it('a full pair (number, operator, number) placed, then the block chip: wraps all three', () => {
    const { result } = setup([6, 2, 9, 3], 48) // budget 2
    act(() => result.current.onTapNumber(idOf(result.current, 6)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 2)))
    act(() => result.current.onTapBlock())

    const children = result.current.expr.root.children
    expect(children).toHaveLength(1)
    const group = children[0] as { kind: string; children: ({ id: string; value?: number; operator?: string } | null)[] }
    expect(group.kind).toBe('group')
    expect(group.children).toMatchObject([{ value: 6 }, { value: '+' }, { value: 2 }])

    // second tap: nothing left to wrap but the group itself, so it opens a
    // fresh one past it instead of reaching into the first.
    act(() => result.current.onTapBlock())
    const after = result.current.expr.root.children
    expect(after).toHaveLength(3)
    expect(after[0]).toBe(children[0])
    expect(after[1]).toBeNull()
    expect((after[2] as { kind: string }).kind).toBe('group')
  })

  it('two numbers placed without an operator between them, then the block dragged onto the first: both wrap, the open operator slot travels in with them', () => {
    // "6, ⬚, 2" — concept 3.1's two-numbers-in-a-row tap: the first number
    // takes root-0, the second skips the still-open operator gap and lands
    // on root-2 rather than being silently dropped.
    const { result } = setup([6, 2, 9, 3], 48) // budget 2
    act(() => result.current.onTapNumber(idOf(result.current, 6)))
    act(() => result.current.onTapNumber(idOf(result.current, 2)))
    expect(result.current.expr.root.children).toMatchObject([{ value: 6 }, null, { value: 2 }])

    act(() => result.current.onDrop({ id: 'tray-block', kind: 'operand', data: { role: 'block' } }, { zoneId: 'root-0', occupied: true }))

    const children = result.current.expr.root.children
    expect(children).toHaveLength(1)
    const group = children[0] as { kind: string; children: ({ value?: number } | null)[] }
    expect(group.kind).toBe('group')
    expect(group.children).toMatchObject([{ value: 6 }, null, { value: 2 }]) // the gap stayed a gap, just moved inside

    // and tapping the block chip a second time still doesn't reach into it
    act(() => result.current.onTapBlock())
    const after = result.current.expr.root.children
    expect(after).toHaveLength(3)
    expect(after[0]).toBe(children[0])
    expect((after[2] as { kind: string }).kind).toBe('group')
  })

  it('the whole flat expression placed, then the block chip twice: wraps the first pair, then the next one — the full bracketed shape, without ever dissolving anything', () => {
    const { result } = setup([6, 2, 9, 3], 48) // budget 2
    act(() => result.current.onTapNumber(idOf(result.current, 6)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 2)))
    act(() => result.current.onTapOperator('*'))
    act(() => result.current.onTapNumber(idOf(result.current, 9)))
    act(() => result.current.onTapOperator('-'))
    act(() => result.current.onTapNumber(idOf(result.current, 3)))
    expect(result.current.expr.root.children).toHaveLength(7) // 6 + 2 * 9 - 3, no groups yet

    act(() => result.current.onTapBlock())
    const afterFirst = result.current.expr.root.children
    expect(afterFirst).toHaveLength(5) // (6+2), *, 9, -, 3
    expect((afterFirst[0] as { kind: string; children: unknown[] }).children).toMatchObject([{ value: 6 }, { value: '+' }, { value: 2 }])

    act(() => result.current.onTapBlock())
    const afterSecond = result.current.expr.root.children
    expect(afterSecond).toHaveLength(3) // (6+2), *, (9-3) — concept 12.5's worst case, reached from flat content
    expect((afterSecond[0] as { id: string }).id).toBe((afterFirst[0] as { id: string }).id) // first group untouched
    expect((afterSecond[2] as { kind: string; children: unknown[] }).children).toMatchObject([{ value: 9 }, { value: '-' }, { value: 3 }])
    expect(result.current.blockDisabled).toBe(true) // both units of budget now used
    expect(result.current.result).toBe(48)
  })
})

describe('useGame — the trailing scaffold (concept 6.4)', () => {
  // The field has to show how many chips are still to come — and, until it
  // does, the trailing frontier renders nothing at all and there is no
  // drop target with any size to aim a finger at.
  it('an untouched 4-number puzzle scaffolds all four operands and all three operators', () => {
    const { result } = setup([6, 2, 9, 3], 48)
    expect(result.current.scaffoldOperands).toBe(4)
    expect(result.current.scaffoldOperators).toBe(3)
  })

  it('shrinks as chips are placed', () => {
    const { result } = setup([6, 2, 9, 3], 48)
    act(() => result.current.onTapNumber(idOf(result.current, 6)))
    expect(result.current.scaffoldOperands).toBe(3)
    expect(result.current.scaffoldOperators).toBe(3)
    act(() => result.current.onTapOperator('+'))
    expect(result.current.scaffoldOperators).toBe(2)
    expect(result.current.scaffoldOperands).toBe(3) // placing an operator costs no number slot
  })

  it('always adds up to n operand slots and n-1 operator slots, whatever is placed', () => {
    // The field's whole promise (concept 6.4): it is right in the *number*
    // of chips even when it cannot know the arrangement.
    const { result } = setup([6, 2, 9, 3], 48)
    const total = () => {
      const children = result.current.expr.root.children
      const drawn = { operand: 0, operator: 0 }
      children.forEach((c, i) => {
        if (c !== null && c.kind === 'group') { drawn.operand += 1; return }
        drawn[i % 2 === 0 ? 'operand' : 'operator'] += 1
      })
      return {
        operands: drawn.operand + result.current.scaffoldOperands,
        operators: drawn.operator + result.current.scaffoldOperators,
      }
    }
    expect(total()).toEqual({ operands: 4, operators: 3 })
    act(() => result.current.onTapNumber(idOf(result.current, 6)))
    expect(total()).toEqual({ operands: 4, operators: 3 })
    act(() => result.current.onTapOperator('+'))
    expect(total()).toEqual({ operands: 4, operators: 3 })
    act(() => result.current.onTapNumber(idOf(result.current, 2)))
    act(() => result.current.onTapOperator('*'))
    expect(total()).toEqual({ operands: 4, operators: 3 })
  })

  it('is empty once everything is placed — concept 12.5 measures the worst case with no scaffold at all', () => {
    const { result } = setup([3, 7], 10)
    act(() => result.current.onTapNumber(idOf(result.current, 3)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 7)))
    expect(result.current.scaffoldOperands).toBe(0)
    expect(result.current.scaffoldOperators).toBe(0)
  })

  it("does not count a block's own open slots twice — those are already drawn inside the brackets (concept 6.3)", () => {
    const { result } = setup([6, 2, 9, 3], 48)
    act(() => result.current.onTapBlock()) // an empty group: [null, null, null]
    // two of the four operands and one of the three operators are now on
    // screen as the group's own slots
    expect(result.current.scaffoldOperands).toBe(2)
    expect(result.current.scaffoldOperators).toBe(2)
  })
})

describe('useGame — submit (concept 9.1)', () => {
  it('does nothing while incomplete', () => {
    const { result } = setup([3, 7], 10)
    // "3" alone is already complete (concept 2.1: root has no minimum
    // length) — so an incomplete state needs an even count instead:
    // "3 +" is length 2, missing its second operand.
    act(() => result.current.onTapNumber(idOf(result.current, 3)))
    act(() => result.current.onTapOperator('+'))
    expect(result.current.submitEnabled).toBe(false)
    act(() => result.current.onSubmit())
    expect(result.current.status).toBe('idle')
  })

  it('marks correct when the result matches the target', () => {
    const { result } = setup([3, 7], 10)
    act(() => result.current.onTapNumber(idOf(result.current, 3)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 7)))
    act(() => result.current.onSubmit())
    expect(result.current.status).toBe('correct')
  })

  it('marks wrong but keeps the chips and lets the player resubmit (concept 9.1: "=" stays active)', () => {
    const { result } = setup([3, 7], 99)
    act(() => result.current.onTapNumber(idOf(result.current, 3)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 7)))
    act(() => result.current.onSubmit())
    expect(result.current.status).toBe('wrong')
    expect(result.current.result).toBe(10) // the player's own (wrong) result, for the notation line
    expect(result.current.submitEnabled).toBe(true)

    act(() => result.current.onSubmit())
    expect(result.current.status).toBe('wrong')
  })
})

describe('useGame — drag: placing from the tray (concept 5.1)', () => {
  it('a number dropped on an empty zone is placed there', () => {
    const { result } = setup([3, 7], 10)
    const id3 = idOf(result.current, 3)
    act(() => result.current.onDrop({ id: id3, kind: 'operand', data: { role: 'number' } }, { zoneId: 'root-0', occupied: false }))
    expect(result.current.trayNumbers.find(n => n.id === id3)!.used).toBe(true)
  })

  it('an operator dropped on an empty zone is placed with the correct value', () => {
    const { result } = setup([3, 7], 10)
    act(() => result.current.onDrop({ id: idOf(result.current, 3), kind: 'operand', data: { role: 'number' } }, { zoneId: 'root-0', occupied: false }))
    act(() => result.current.onDrop({ id: 'tray-op-+', kind: 'operator', data: { role: 'operator', operator: '+' } }, { zoneId: 'root-1', occupied: false }))
    act(() => result.current.onDrop({ id: idOf(result.current, 7), kind: 'operand', data: { role: 'number' } }, { zoneId: 'root-2', occupied: false }))
    expect(result.current.result).toBe(10)
  })

  it('a block dropped on an existing pair wraps it (concept 6.1)', () => {
    const { result } = setup([6, 2, 9], 8)
    act(() => result.current.onDrop({ id: idOf(result.current, 6), kind: 'operand', data: { role: 'number' } }, { zoneId: 'root-0', occupied: false }))
    act(() => result.current.onDrop({ id: 'tray-op-+', kind: 'operator', data: { role: 'operator', operator: '+' } }, { zoneId: 'root-1', occupied: false }))
    act(() => result.current.onDrop({ id: idOf(result.current, 2), kind: 'operand', data: { role: 'number' } }, { zoneId: 'root-2', occupied: false }))
    // now [6, +, 2] — drop the block onto the 6 (an occupied operand position)
    act(() => result.current.onDrop({ id: 'tray-block', kind: 'operand', data: { role: 'block' } }, { zoneId: 'root-0', occupied: true }))
    const wrapped = result.current.expr.root.children[0] as { kind: string }
    expect(wrapped.kind).toBe('group')
    expect(result.current.result).toBe(8) // (6+2), still complete and correct
  })

  it('a block dropped on a lone number wraps it at the minimum shape, not as a bare (6)', () => {
    // concept 6.1's span-1 wrap, held to concept 6.3: the bracket has to
    // show what it still needs. `(6)` has no slot inside it, so the only
    // way on from there is to dissolve it again.
    const { result } = setup([6, 2, 9, 3], 48)
    act(() => result.current.onDrop({ id: idOf(result.current, 6), kind: 'operand', data: { role: 'number' } }, { zoneId: 'root-0', occupied: false }))
    act(() => result.current.onDrop({ id: 'tray-block', kind: 'operand', data: { role: 'block' } }, { zoneId: 'root-0', occupied: true }))

    const group = result.current.expr.root.children[0] as { kind: string; children: unknown[] }
    expect(group.kind).toBe('group')
    expect(group.children).toHaveLength(3)
    expect(group.children[0]).toMatchObject({ kind: 'number', value: 6 })
    expect(group.children[1]).toBeNull()
    expect(group.children[2]).toBeNull()

    // and it takes the rest without any dissolve-and-retry
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 2)))
    expect(result.current.result).toBe(8)
  })

  it('a block dropped on an empty zone places a bare empty group, not a wrap', () => {
    const { result } = setup([6, 2], 8)
    act(() => result.current.onDrop({ id: 'tray-block', kind: 'operand', data: { role: 'block' } }, { zoneId: 'root-0', occupied: false }))
    const group = result.current.expr.root.children[0] as { kind: string; children: unknown[] }
    expect(group.kind).toBe('group')
    expect(group.children).toEqual([null, null, null])
  })

  it('a number dropped on a slot that already holds one replaces it, and the displaced number returns to the tray', () => {
    const { result } = setup([3, 7], 10)
    const id3 = idOf(result.current, 3), id7 = idOf(result.current, 7)
    act(() => result.current.onDrop({ id: id3, kind: 'operand', data: { role: 'number' } }, { zoneId: 'root-0', occupied: false }))
    act(() => result.current.onDrop({ id: id7, kind: 'operand', data: { role: 'number' } }, { zoneId: 'root-0', occupied: true }))
    expect(result.current.trayNumbers.find(n => n.id === id7)!.used).toBe(true)
    expect(result.current.trayNumbers.find(n => n.id === id3)!.used).toBe(false) // back in the tray, not lost
    expect(result.current.expr.root.children).toHaveLength(1)
  })

  it('an operator dropped on a slot that already holds one replaces it', () => {
    const { result } = setup([3, 7], 10)
    act(() => result.current.onDrop({ id: idOf(result.current, 3), kind: 'operand', data: { role: 'number' } }, { zoneId: 'root-0', occupied: false }))
    act(() => result.current.onDrop({ id: 'tray-op-+', kind: 'operator', data: { role: 'operator', operator: '+' } }, { zoneId: 'root-1', occupied: false }))
    act(() => result.current.onDrop({ id: idOf(result.current, 7), kind: 'operand', data: { role: 'number' } }, { zoneId: 'root-2', occupied: false }))
    expect(result.current.result).toBe(10)
    act(() => result.current.onDrop({ id: 'tray-op-*', kind: 'operator', data: { role: 'operator', operator: '*' } }, { zoneId: 'root-1', occupied: true }))
    expect(result.current.result).toBe(21)
  })

  it('dragging a block in cannot exceed the budget either — same cap the tray chip disables itself for', () => {
    const { result } = setup([3, 7], 10) // budget 1
    act(() => result.current.onTapBlock()) // budget now used up via a tap
    act(() => result.current.onDrop({ id: 'tray-block', kind: 'operand', data: { role: 'block' } }, { zoneId: 'root-1', occupied: false }))
    expect(result.current.expr.root.children).toHaveLength(1) // still just the one group — the drop was a no-op
  })
})

describe('useGame — drag: any free slot, not just the next one', () => {
  // The point of dragging over tapping. Tapping always fills the next open
  // surface; dropping fills the surface you dropped on, and opens the ones
  // before it.
  it('a number dropped on the last free operand slot lands there, leaving the earlier ones open', () => {
    const { result } = setup([6, 2, 9, 3], 48)
    // an untouched 4-number puzzle scaffolds root-0,2,4,6 (operands) and root-1,3,5 (operators)
    act(() => result.current.onDrop({ id: idOf(result.current, 3), kind: 'operand', data: { role: 'number' } }, { zoneId: 'root-6', occupied: false }))
    const children = result.current.expr.root.children
    expect(children).toHaveLength(7)
    expect(children[6]).toMatchObject({ kind: 'number', value: 3 })
    expect(children.slice(0, 6)).toEqual([null, null, null, null, null, null])
  })

  it('the scaffold shrinks to match, so the field still shows exactly n and n-1', () => {
    const { result } = setup([6, 2, 9, 3], 48)
    act(() => result.current.onDrop({ id: idOf(result.current, 3), kind: 'operand', data: { role: 'number' } }, { zoneId: 'root-6', occupied: false }))
    // all four operand and all three operator positions are now drawn by
    // the tree itself; nothing is left to append behind it
    expect(result.current.scaffoldOperands).toBe(0)
    expect(result.current.scaffoldOperators).toBe(0)
  })

  it('an operator can be dropped into a middle slot before either of its operands exists', () => {
    const { result } = setup([6, 2, 9, 3], 48)
    act(() => result.current.onDrop({ id: 'tray-op-*', kind: 'operator', data: { role: 'operator', operator: '*' } }, { zoneId: 'root-3', occupied: false }))
    expect(result.current.expr.root.children[3]).toMatchObject({ kind: 'operator', value: '*' })
    expect(result.current.expr.root.children.slice(0, 3)).toEqual([null, null, null])
  })

  it('filling the opened gaps afterwards completes the expression normally', () => {
    const { result } = setup([3, 7], 10)
    // build it back to front: 7 into the last slot, then + , then 3
    act(() => result.current.onDrop({ id: idOf(result.current, 7), kind: 'operand', data: { role: 'number' } }, { zoneId: 'root-2', occupied: false }))
    act(() => result.current.onDrop({ id: 'tray-op-+', kind: 'operator', data: { role: 'operator', operator: '+' } }, { zoneId: 'root-1', occupied: false }))
    expect(result.current.submitEnabled).toBe(false) // still a hole at root-0
    act(() => result.current.onDrop({ id: idOf(result.current, 3), kind: 'operand', data: { role: 'number' } }, { zoneId: 'root-0', occupied: false }))
    expect(result.current.result).toBe(10)
    expect(result.current.submitEnabled).toBe(true)
  })

  it('taking the last chip back out leaves no trailing gaps behind', () => {
    const { result } = setup([6, 2, 9, 3], 48)
    const id3 = idOf(result.current, 3)
    act(() => result.current.onDrop({ id: id3, kind: 'operand', data: { role: 'number' } }, { zoneId: 'root-6', occupied: false }))
    act(() => result.current.onDrop({ id: id3, kind: 'operand', data: { role: 'number' } }, null))
    expect(result.current.expr.root.children).toEqual([])
    expect(result.current.scaffoldOperands).toBe(4)
    expect(result.current.scaffoldOperators).toBe(3)
  })

  it('removing an operator from the end does not leave a finished expression looking unfinished', () => {
    const { result } = setup([3, 7], 10)
    act(() => result.current.onTapNumber(idOf(result.current, 3)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 7)))
    // an extra operator dropped past the end, then taken back out
    act(() => result.current.onDrop({ id: 'tray-op-*', kind: 'operator', data: { role: 'operator', operator: '*' } }, { zoneId: 'root-3', occupied: false }))
    const placed = result.current.expr.root.children[3] as { id: string }
    act(() => result.current.onDrop({ id: placed.id, kind: 'operator', data: { role: 'operator' } }, null))
    expect(result.current.result).toBe(10)
    expect(result.current.submitEnabled).toBe(true)
  })
})

describe('useGame — drag: moving and removing placed chips', () => {
  it('dropped outside every zone removes the chip (concept 5: "herausziehen")', () => {
    const { result } = setup([3, 7], 10)
    const id3 = idOf(result.current, 3)
    act(() => result.current.onTapNumber(id3))
    act(() => result.current.onDrop({ id: id3, kind: 'operand', data: { role: 'number' } }, null))
    expect(result.current.trayNumbers.find(n => n.id === id3)!.used).toBe(false)
  })

  it('dropping a tray-origin item nowhere is a harmless no-op', () => {
    const { result } = setup([3, 7], 10)
    const before = result.current.expr
    act(() => result.current.onDrop({ id: idOf(result.current, 3), kind: 'operand', data: { role: 'number' } }, null))
    expect(result.current.expr).toBe(before)
  })

  it('swaps two placed numbers on the board (concept 6.5)', () => {
    const { result } = setup([3, 7], 10)
    const id3 = idOf(result.current, 3), id7 = idOf(result.current, 7)
    act(() => result.current.onTapNumber(id3))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(id7))
    // [3, +, 7] at root-0/1/2 — swap 3 and 7
    act(() => result.current.onDrop({ id: id3, kind: 'operand', data: { role: 'number' } }, { zoneId: 'root-2', occupied: true }))
    const [a, , b] = result.current.expr.root.children as { id: string }[]
    expect(a.id).toBe(id7)
    expect(b.id).toBe(id3)
  })

  it("moving a placed number into another group's empty slot leaves a gap behind, without deleting its old neighbor operator", () => {
    const { result } = setup([1, 2, 9, 5], 999) // 4 numbers -> block budget 2 (concept 4); target is irrelevant to this structural test
    // group1 = (1+2): place block, fill both operands and the operator.
    act(() => result.current.onTapBlock())
    act(() => result.current.onTapNumber(idOf(result.current, 1)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 2)))
    // root frontier is now operator-kind: "*", then a second empty group.
    act(() => result.current.onTapOperator('*'))
    act(() => result.current.onTapBlock())
    // group2 gets one operand filled (9), leaving its other operand null.
    act(() => result.current.onTapNumber(idOf(result.current, 9)))

    const [group1, , group2] = result.current.expr.root.children as { id: string; children: { id: string }[] }[]
    expect(group1.children.map(c => c?.id ?? null)).toEqual([idOf(result.current, 1), expect.any(String), idOf(result.current, 2)])

    // drag "1" out of group1 into group2's remaining empty operand slot
    act(() => result.current.onDrop(
      { id: idOf(result.current, 1), kind: 'operand', data: { role: 'number' } },
      { zoneId: `group-${group2.id}-2`, occupied: false }
    ))

    const [g1After, , g2After] = result.current.expr.root.children as { children: (({ id: string } | null))[] }[]
    expect(g1After.children[0]).toBeNull() // the gap left behind
    expect(g1After.children[1]).not.toBeNull() // the '+' is still there — not deleted
    expect(g2After.children[2]?.id).toBe(idOf(result.current, 1)) // "1" arrived at its new spot
  })
})
