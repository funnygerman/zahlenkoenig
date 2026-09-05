import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Expression, rootZoneId, groupZoneId, parseZoneId } from './Expression'
import { createExpression, createOperatorLeaf, type Group, type NumberLeaf, type Slot, type Expression as ExpressionTree } from '../core/expression'

function num(value: number, source: number): NumberLeaf {
  return { id: `num-${source}`, kind: 'number', value, source }
}

function exprOf(children: Slot[]): ExpressionTree {
  return { root: { id: 'root', kind: 'group', children } }
}

const noop = () => {}

describe('zone id helpers', () => {
  it('round-trip root ids', () => {
    expect(parseZoneId(rootZoneId(3))).toEqual({ groupId: null, index: 3 })
  })

  it('round-trip group ids, including group ids that contain dashes', () => {
    expect(parseZoneId(groupZoneId('group-7', 1))).toEqual({ groupId: 'group-7', index: 1 })
  })

  it('returns null for a foreign zone id (e.g. a tray zone)', () => {
    expect(parseZoneId('tray-op-+')).toBeNull()
  })
})

describe('Expression — rendering the tree (concept 2/12.2)', () => {
  it('renders numbers and operators in order', () => {
    const expr = exprOf([num(6, 0), createOperatorLeaf('+'), num(2, 1)])
    render(<Expression expr={expr} onTapLeaf={noop} onDissolveGroup={noop} />)
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('+')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders an open gap as a ghost, not a placeholder', () => {
    const expr = exprOf([num(3, 0), null])
    render(<Expression expr={expr} onTapLeaf={noop} onDissolveGroup={noop} />)
    expect(document.querySelectorAll('[class*="ghostSlot"]')).toHaveLength(1)
    expect(document.querySelectorAll('[class*="placeholder"]')).toHaveLength(0)
  })

  it('renders trailing scaffold ghosts beyond the real content (concept 6.4)', () => {
    const expr = exprOf([num(3, 0)])
    render(<Expression expr={expr} scaffoldOperands={1} scaffoldOperators={1} onTapLeaf={noop} onDissolveGroup={noop} />)
    // 1 real number chip + 2 scaffold ghosts (operator, then operand)
    expect(document.querySelectorAll('[class*="ghostSlot"]')).toHaveLength(2)
  })

  it('renders a group with its content inside a bracket, chips marked inGroup', () => {
    const g: Group = { id: 'g1', kind: 'group', children: [num(6, 0), createOperatorLeaf('+'), num(2, 1)] }
    const expr = exprOf([g])
    render(<Expression expr={expr} onTapLeaf={noop} onDissolveGroup={noop} />)
    expect(document.querySelector('[class*="group"]')).not.toBeNull()
    expect(document.querySelectorAll('[class*="inGroup"]')).toHaveLength(3) // 6, +, 2
  })

  it('the worst-case expression from concept 12.5 renders without throwing: (6+2)*(9-3)', () => {
    const g1: Group = { id: 'g1', kind: 'group', children: [num(6, 0), createOperatorLeaf('+'), num(2, 1)] }
    const g2: Group = { id: 'g2', kind: 'group', children: [num(9, 2), createOperatorLeaf('-'), num(3, 3)] }
    const expr = exprOf([g1, createOperatorLeaf('*'), g2])
    render(<Expression expr={expr} onTapLeaf={noop} onDissolveGroup={noop} />)
    expect(screen.getAllByText(/[0-9]/)).toHaveLength(4)
  })
})

describe('Expression — tapping a placed leaf returns it (concept 6.6)', () => {
  it('reports the leaf id, not its value', async () => {
    const onTapLeaf = vi.fn()
    const expr = exprOf([num(6, 0), createOperatorLeaf('+'), num(2, 1)])
    render(<Expression expr={expr} onTapLeaf={onTapLeaf} onDissolveGroup={noop} />)
    await userEvent.click(screen.getByText('6'))
    expect(onTapLeaf).toHaveBeenCalledWith('num-0')
  })

  it('works the same for a leaf inside a group', async () => {
    const onTapLeaf = vi.fn()
    const g: Group = { id: 'g1', kind: 'group', children: [num(6, 0), createOperatorLeaf('+'), num(2, 1)] }
    render(<Expression expr={exprOf([g])} onTapLeaf={onTapLeaf} onDissolveGroup={noop} />)
    await userEvent.click(screen.getByText('2'))
    expect(onTapLeaf).toHaveBeenCalledWith('num-1')
  })

  it("doesn't also attach a plain onClick once drag is wired — otherwise a real tap fires both the native click and useDrag's own tap detection", async () => {
    const onTapLeaf = vi.fn()
    const dragHandlers = vi.fn(() => ({ onPointerDown: vi.fn(), onPointerMove: vi.fn(), onPointerUp: vi.fn(), onPointerCancel: vi.fn() }))
    const expr = exprOf([num(6, 0), createOperatorLeaf('+'), num(2, 1)])
    render(<Expression expr={expr} onTapLeaf={onTapLeaf} onDissolveGroup={noop} dragHandlers={dragHandlers} />)
    await userEvent.click(screen.getByText('6'))
    expect(onTapLeaf).not.toHaveBeenCalled()
  })
})

describe('Expression — dissolving a group (concept 6.5: tap the bracket edge, content stays)', () => {
  it('tapping either bracket edge reports the group id', async () => {
    const onDissolveGroup = vi.fn()
    const g: Group = { id: 'g1', kind: 'group', children: [num(6, 0), createOperatorLeaf('+'), num(2, 1)] }
    render(<Expression expr={exprOf([g])} onTapLeaf={noop} onDissolveGroup={onDissolveGroup} />)
    const edges = screen.getAllByRole('button', { name: 'Klammer auflösen' })
    expect(edges).toHaveLength(2) // left and right (concept 6.6: two ways to hit it)
    await userEvent.click(edges[0])
    expect(onDissolveGroup).toHaveBeenCalledWith('g1')
  })
})

describe('Expression — drop zone registration (concept 3.1)', () => {
  it('registers a zone per position, including the trailing scaffold, with correct kind/occupied', () => {
    const registerZone = vi.fn()
    const expr = exprOf([num(3, 0), createOperatorLeaf('+')])
    render(<Expression expr={expr} scaffoldOperands={1} onTapLeaf={noop} onDissolveGroup={noop} registerZone={registerZone} />)

    const calls = new Map(registerZone.mock.calls.map(([zoneId, kind, occupied]) => [zoneId, { kind, occupied }]))
    expect(calls.get(rootZoneId(0))).toEqual({ kind: 'operand', occupied: true })
    expect(calls.get(rootZoneId(1))).toEqual({ kind: 'operator', occupied: true })
    expect(calls.get(rootZoneId(2))).toEqual({ kind: 'operand', occupied: false }) // the one scaffold slot
  })

  it('registers every scaffold slot, not just the first, at the root index it stands for', () => {
    // What makes dragging worth more than tapping: a chip can go into the
    // *third* free slot, not only the next one.
    const registerZone = vi.fn()
    render(
      <Expression
        expr={exprOf([])}
        scaffoldOperands={3}
        scaffoldOperators={2}
        onTapLeaf={noop}
        onDissolveGroup={noop}
        registerZone={registerZone}
      />
    )
    const calls = new Map(registerZone.mock.calls.map(([zoneId, kind, occupied]) => [zoneId, { kind, occupied }]))
    expect(calls.get(rootZoneId(0))).toEqual({ kind: 'operand', occupied: false })
    expect(calls.get(rootZoneId(1))).toEqual({ kind: 'operator', occupied: false })
    expect(calls.get(rootZoneId(2))).toEqual({ kind: 'operand', occupied: false })
    expect(calls.get(rootZoneId(3))).toEqual({ kind: 'operator', occupied: false })
    expect(calls.get(rootZoneId(4))).toEqual({ kind: 'operand', occupied: false })
  })

  it('registers nothing beyond what it draws — a full expression has no phantom trailing zone', () => {
    // The original drag bug in one line: the only zone in an empty field
    // was a frontier that rendered nothing, so it measured 0x0 and no
    // pointer could ever hit it. A position is a target exactly when the
    // player can see it.
    const registerZone = vi.fn()
    const expr = exprOf([num(3, 0), createOperatorLeaf('+'), num(7, 1)])
    render(<Expression expr={expr} onTapLeaf={noop} onDissolveGroup={noop} registerZone={registerZone} />)
    const ids = registerZone.mock.calls.filter(([, , , el]) => el !== null).map(([zoneId]) => zoneId)
    expect(ids).not.toContain(rootZoneId(3))
  })

  it('registers zones inside a group under group-<id>-<index>', () => {
    const registerZone = vi.fn()
    const g: Group = { id: 'g1', kind: 'group', children: [num(6, 0), null, num(2, 1)] }
    render(<Expression expr={exprOf([g])} onTapLeaf={noop} onDissolveGroup={noop} registerZone={registerZone} />)
    const ids = registerZone.mock.calls.map(([zoneId]) => zoneId)
    expect(ids).toContain(groupZoneId('g1', 0))
    expect(ids).toContain(groupZoneId('g1', 1))
    expect(ids).toContain(groupZoneId('g1', 2))
  })

  it("registers a group's own trailing frontier, so a third number can join it via drag (concept 6.2)", () => {
    const registerZone = vi.fn()
    const g: Group = { id: 'g1', kind: 'group', children: [num(6, 0), createOperatorLeaf('+'), num(2, 1)] }
    render(<Expression expr={exprOf([g])} onTapLeaf={noop} onDissolveGroup={noop} registerZone={registerZone} />)
    const calls = new Map(registerZone.mock.calls.map(([zoneId, kind, occupied]) => [zoneId, { kind, occupied }]))
    expect(calls.get(groupZoneId('g1', 3))).toEqual({ kind: 'operator', occupied: false })
  })
})

describe('Expression — active zone highlighting (concept 3.1)', () => {
  it('marks the currently hit zone, and only that one', () => {
    const expr = exprOf([num(3, 0), createOperatorLeaf('+')])
    render(<Expression expr={expr} scaffoldOperands={1} onTapLeaf={noop} onDissolveGroup={noop} activeZoneId={rootZoneId(2)} />)
    expect(document.querySelectorAll('[class*="activeZone"]')).toHaveLength(1)
  })
})
