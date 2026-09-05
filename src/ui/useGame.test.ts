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

  it("removing the last operand also removes its operator, not just the number (concept 3: '3+7 -> 3')", () => {
    const { result } = setup([3, 7], 10)
    const id3 = idOf(result.current, 3), id7 = idOf(result.current, 7)
    act(() => result.current.onTapNumber(id3))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(id7))
    act(() => result.current.onTapLeaf(id7)) // Expression.tsx's return-to-tray path
    // only the 3 remains placed; the '+' went with the 7
    expect(result.current.trayNumbers.find(n => n.id === id3)!.used).toBe(true)
    expect(result.current.trayNumbers.find(n => n.id === id7)!.used).toBe(false)
    expect(result.current.expr.root.children).toHaveLength(1) // '+' is gone too, not just '7' — see the next test for why this alone is still "complete"
  })

  it('a single placed number with nothing else is a "complete" expression (root has no minimum length, concept 2.1)', () => {
    const { result } = setup([3, 7], 3)
    act(() => result.current.onTapNumber(idOf(result.current, 3)))
    expect(result.current.submitEnabled).toBe(true)
    expect(result.current.result).toBe(3)
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
