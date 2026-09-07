import { describe, it, expect } from 'vitest'
import { computeHint, isStuck, type HintMove } from './hints'
import {
  createExpression, createTray, createOperatorLeaf,
  nextOpenSurface, nextBlockTarget, resolveBlockDrop, applyBlockDrop, placeAt, trimTrailingGaps, withMinimumShape,
  type Expression, type Group, type NumberLeaf, type Operator,
} from './expression'
import { evaluate } from './evaluate'

// Re-plays a hint's moves with the same primitives useGame.ts's tap
// handlers use (nextOpenSurface for numbers/operators, nextBlockTarget +
// resolveBlockDrop + applyBlockDrop for the block chip) — a lightweight
// stand-in for useGame's own tree edits, just enough to prove the moves a
// hint hands back are ones a real tap sequence could actually make.
function applyMove(expr: Expression, move: HintMove, tray: readonly NumberLeaf[]): Expression {
  if (move.kind === 'block') {
    const index = nextBlockTarget(expr.root.children)
    const resolved = resolveBlockDrop(expr.root.children, index)
    if (!resolved) throw new Error('hint proposed an unresolvable block tap')
    const children = applyBlockDrop(expr.root.children, index, resolved)
    return { root: { ...expr.root, children: trimTrailingGaps(children) } }
  }

  const leaf = move.kind === 'number' ? tray.find(t => t.id === move.leafId)! : createOperatorLeaf(move.op)
  const surface = nextOpenSurface(expr, move.kind === 'number' ? 'operand' : 'operator')
  if (surface.groupId === null) {
    return { root: { ...expr.root, children: trimTrailingGaps(placeAt(expr.root.children, surface.index, leaf)) } }
  }
  const group = expr.root.children.find(c => c !== null && c.kind === 'group' && c.id === surface.groupId) as Group
  const filled = withMinimumShape(placeAt(group.children, surface.index, leaf))
  const children = expr.root.children.map(c => (c === group ? { ...group, children: filled } : c))
  return { root: { ...expr.root, children: trimTrailingGaps(children) } }
}

function playOut(expr: Expression, moves: readonly HintMove[], tray: readonly NumberLeaf[]): Expression {
  return moves.reduce((e, m) => applyMove(e, m, tray), expr)
}

const ALL_OPS: Operator[] = ['+', '-', '*', '/']

describe('computeHint — reachability (concept 10.1)', () => {
  it('finds a continuation for the canonical worst case, (6+2)×(9−3)=48, from an empty board', () => {
    const tray = createTray([6, 2, 9, 3])
    const hint = computeHint(createExpression(), tray, 48, ALL_OPS, 4)
    expect(hint).not.toBeNull()
    const solved = playOut(createExpression(), hint!.moves, tray)
    expect(evaluate(solved)).toBe(48)
  })

  it('[1,1,1,1] cannot reach 1000 under any operator — a dead end from the very first press (matches solver.test.ts)', () => {
    const tray = createTray([1, 1, 1, 1])
    expect(computeHint(createExpression(), tray, 1000, ALL_OPS, 4)).toBeNull()
    expect(isStuck(createExpression(), tray, 1000, ALL_OPS, 4)).toBe(true)
  })

  it('isStuck is false once the expression is already complete — nothing left to hint about', () => {
    const tray = createTray([3, 4])
    let expr = createExpression()
    expr = { root: { ...expr.root, children: placeAt(placeAt(placeAt(expr.root.children, 0, tray[0]), 1, createOperatorLeaf('+')), 2, tray[1]) } }
    expect(isStuck(expr, tray, 7, ['+'], 2)).toBe(false)
  })
})

describe('computeHint — continues the built tree, never contradicts it (concept 10.2)', () => {
  it('keeps an already-placed leaf exactly where it is', () => {
    const tray = createTray([6, 2, 9, 3])
    // 6 already placed at the root's first position
    const expr: Expression = { root: { id: 'root', kind: 'group', children: placeAt([], 0, tray[0]) } }
    const hint = computeHint(expr, tray, 48, ALL_OPS, 4)
    expect(hint).not.toBeNull()
    const solved = playOut(expr, hint!.moves, tray)
    expect(solved.root.children[0]).toEqual(tray[0])
    expect(evaluate(solved)).toBe(48)
  })

  it('a plain 2-number, single-operator puzzle never introduces a block', () => {
    const tray = createTray([3, 4])
    const hint = computeHint(createExpression(), tray, 7, ['+'], 2)
    expect(hint).not.toBeNull()
    expect(hint!.moves.some(m => m.kind === 'block')).toBe(false)
  })

  it('a hint-introduced block never grows past its two-number minimum (a hint press is a tap, not a drag)', () => {
    // solver.test.ts's own fact: "(1+1+1)×3=9 from [1,1,1,3]" — reachable()
    // finds it because it doesn't care how a group's shape gets built. A
    // hint press does: 6.2's "grow past minimum" is drag-only, so a block
    // the hint proposes can only ever be 2 numbers. Exhaustively checking
    // every size<=2-piece arrangement of {1,1,1,3} under +/* by hand turns
    // up nothing that reaches 9 either (max is 7, via `1+1×3×2`-style
    // groupings) — so this hint must report a dead end even though the
    // puzzle is, in the generator's own sense, solvable.
    const tray = createTray([1, 1, 1, 3])
    const hint = computeHint(createExpression(), tray, 9, ['+', '*'], 4)
    expect(hint).toBeNull()
  })
})

describe('computeHint — pulseIds (concept 10.3)', () => {
  it('pulses the two operands of the continuation\'s first new block', () => {
    const tray = createTray([6, 2, 9, 3])
    const hint = computeHint(createExpression(), tray, 48, ALL_OPS, 4)!
    expect(hint.pulseIds).not.toBeNull()
    const [a, b] = hint.pulseIds!
    expect([tray.map(t => t.id).includes(a), tray.map(t => t.id).includes(b)]).toEqual([true, true])
  })

  it('falls back to the first two numbers when the continuation opens no block', () => {
    const tray = createTray([3, 4])
    const hint = computeHint(createExpression(), tray, 7, ['+'], 2)!
    expect(hint.pulseIds).toEqual([tray[0].id, tray[1].id])
  })
})

describe('computeHint — performance sanity (concept 10.1: "der Suchraum winzig")', () => {
  it('answers a fresh 4-number, all-operator board quickly', () => {
    const tray = createTray([6, 2, 9, 3])
    const start = performance.now()
    computeHint(createExpression(), tray, 48, ALL_OPS, 4)
    expect(performance.now() - start).toBeLessThan(2000)
  })
})
