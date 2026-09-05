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
    expect(result.current.blockSlots).toHaveLength(2) // floor(4/2)
    expect(result.current.blockSlots.every(b => !b.used)).toBe(true)
    expect(result.current.submitEnabled).toBe(false)
    expect(result.current.status).toBe('idle')
    expect(result.current.result).toBeNull()
  })

  it('block budget is floor(n/2): one for 2-3 numbers, two for four', () => {
    expect(setup([3, 7], 10).result.current.blockSlots).toHaveLength(1)
    expect(setup([3, 7, 9], 10).result.current.blockSlots).toHaveLength(1)
    expect(setup([1, 2, 3, 4], 10).result.current.blockSlots).toHaveLength(2)
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
    act(() => result.current.onTapBlock('block-0'))
    expect(result.current.blockSlots[0].used).toBe(true)

    act(() => result.current.onTapNumber(idOf(result.current, 6)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 2)))
    expect(result.current.submitEnabled).toBe(true)
    expect(result.current.result).toBe(8)
  })

  it('cannot place more blocks than the budget allows, and tapping a used slot dissolves it', () => {
    const { result } = setup([3, 7], 10) // budget 1
    act(() => result.current.onTapBlock('block-0'))
    expect(result.current.blockSlots).toHaveLength(1)
    expect(result.current.blockSlots[0].used).toBe(true)

    // 'block-1' isn't a slot Tray would ever render at this budget —
    // defensive no-op, not reachable from a real tap.
    act(() => result.current.onTapBlock('block-1'))
    expect(result.current.expr.root.children).toHaveLength(1)

    // Tapping the tray's own (now-used) placeholder is symmetric with a
    // number's — it returns the block instead of trying to place another
    // one (concept 12.3: "Platzhalter in der Ablage sind antippbar").
    act(() => result.current.onTapBlock('block-0'))
    expect(result.current.blockSlots[0].used).toBe(false)
  })

  it('dissolving a group keeps its content in place (concept 6.5)', () => {
    const { result } = setup([6, 2], 8)
    act(() => result.current.onTapBlock('block-0'))
    act(() => result.current.onTapNumber(idOf(result.current, 6)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 2)))
    expect(result.current.result).toBe(8)

    const groupId = (result.current.expr.root.children[0] as { id: string }).id
    act(() => result.current.onDissolveGroup(groupId))
    expect(result.current.expr.root.children).toHaveLength(3) // 6, +, 2 — flattened, nothing lost
    expect(result.current.result).toBe(8) // same value, no group needed for two numbers anyway
    expect(result.current.blockSlots[0].used).toBe(false) // the block chip returns to the tray
  })

  it("the full worst-case expression from concept 12.5 builds correctly via tap alone: (6+2)*(9-3) = 48", () => {
    const { result } = setup([6, 2, 9, 3], 48)

    act(() => result.current.onTapBlock('block-0'))
    act(() => result.current.onTapNumber(idOf(result.current, 6)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 2)))
    act(() => result.current.onTapOperator('*'))
    act(() => result.current.onTapBlock('block-1'))
    act(() => result.current.onTapNumber(idOf(result.current, 9)))
    act(() => result.current.onTapOperator('-'))
    act(() => result.current.onTapNumber(idOf(result.current, 3)))

    expect(result.current.submitEnabled).toBe(true)
    expect(result.current.result).toBe(48)
    act(() => result.current.onSubmit())
    expect(result.current.status).toBe('correct')
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
    act(() => result.current.onDrop({ id: 'block-0', kind: 'operand', data: { role: 'block' } }, { zoneId: 'root-0', occupied: true }))
    const wrapped = result.current.expr.root.children[0] as { kind: string }
    expect(wrapped.kind).toBe('group')
    expect(result.current.result).toBe(8) // (6+2), still complete and correct
  })

  it('a block dropped on an empty zone places a bare empty group, not a wrap', () => {
    const { result } = setup([6, 2], 8)
    act(() => result.current.onDrop({ id: 'block-0', kind: 'operand', data: { role: 'block' } }, { zoneId: 'root-0', occupied: false }))
    const group = result.current.expr.root.children[0] as { kind: string; children: unknown[] }
    expect(group.kind).toBe('group')
    expect(group.children).toEqual([null, null, null])
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
    act(() => result.current.onTapBlock('block-0'))
    act(() => result.current.onTapNumber(idOf(result.current, 1)))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(idOf(result.current, 2)))
    // root frontier is now operator-kind: "*", then a second empty group.
    act(() => result.current.onTapOperator('*'))
    act(() => result.current.onTapBlock('block-1'))
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
