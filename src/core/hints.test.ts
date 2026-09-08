import { describe, it, expect } from 'vitest'
import { computeHint, isStuck, type HintMove } from './hints'
import {
  createExpression, createTray, createOperatorLeaf,
  nextOpenSurface, resolveBlockDrop, applyBlockDrop, placeAt, trimTrailingGaps, withMinimumShape,
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
    // the position the hint named, not nextBlockTarget's tap position —
    // mirroring useGame's `placeBlockAt`.
    const index = move.index
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

// Three findings from a browser QA pass, all of them cases where the
// Restlöser looked at a board it had itself half-built and reported a dead
// end (or walked into one).
describe('computeHint — a continuation that keeps the whole board, not just its first operand', () => {
  function rootOf(children: (NumberLeaf | Group | ReturnType<typeof createOperatorLeaf> | null)[]): Expression {
    return { root: { id: 'root', kind: 'group', children } }
  }

  it('an open gap in front of placed content is not a dead end', () => {
    // 5 ÷ 5 + 7 = 8, with the leading 5 taken back out: the board reads
    // "⬚ ÷ 5 + 7" and putting that 5 back is the whole solution. The
    // Restlöser stopped as soon as the tray ran out and only ever
    // considered the candidate "5", which evaluates to 5, not 8 — so it
    // called a one-tap-from-solved board unsolvable.
    const tray = createTray([5, 5, 7])
    const expr = rootOf([null, createOperatorLeaf('/'), tray[1], createOperatorLeaf('+'), tray[2]])
    const hint = computeHint(expr, tray, 8, ALL_OPS, 3)
    expect(hint).not.toBeNull()
    expect(hint!.moves).toEqual([{ kind: 'number', leafId: tray[0].id }])
    expect(isStuck(expr, tray, 8, ALL_OPS, 3)).toBe(false)
  })

  it('a finished, correct expression is not a dead end either', () => {
    // Same cause seen from the other end: with the tray empty the search
    // returned the first operand alone as the only candidate, so every
    // completed expression — the correct one included — was reported as
    // "target no longer reachable" and drew the dead-end border around a
    // right answer.
    const tray = createTray([9, 1, 5])
    const expr = rootOf([tray[0], createOperatorLeaf('+'), tray[1], createOperatorLeaf('-'), tray[2]])
    const hint = computeHint(expr, tray, 5, ALL_OPS, 3)
    expect(hint).not.toBeNull()
    expect(hint!.moves).toEqual([]) // nothing left to place
  })

  it('a finished but wrong expression still is one — nothing can be added to fix it', () => {
    const tray = createTray([9, 1, 5])
    const expr = rootOf([tray[0], createOperatorLeaf('+'), tray[1], createOperatorLeaf('-'), tray[2]])
    expect(computeHint(expr, tray, 7, ALL_OPS, 3)).toBeNull()
  })

  it('an open gap that nothing in the tray can fill is a dead end', () => {
    const tray = createTray([9, 1, 5])
    const expr = rootOf([null, createOperatorLeaf('+'), tray[1], createOperatorLeaf('-'), tray[2], createOperatorLeaf('+'), tray[0]])
    // every number is placed except the one the gap needs — and it isn't
    // one: the gap can never be filled, whatever the target.
    expect(computeHint(expr, tray, 5, ALL_OPS, 3)).toBeNull()
  })
})

describe('computeHint — the block goes where the continuation needs it (concept 10.3)', () => {
  it('names the position, so a block that belongs at the end does not wrap the front', () => {
    // 2 × (1 + 3) = 8, from a board that already reads "2 ×". The block
    // move carried no position and was applied wherever a *tap* would land
    // it — the first eligible root position, i.e. around the 2 — leaving
    // "(2) ×" and a board the hint could then never finish.
    const tray = createTray([2, 1, 3])
    const expr: Expression = { root: { id: 'root', kind: 'group', children: [tray[0], createOperatorLeaf('*')] } }
    const hint = computeHint(expr, tray, 8, ALL_OPS, 3)
    expect(hint).not.toBeNull()
    expect(hint!.moves[0]).toEqual({ kind: 'block', index: 2 })

    const solved = playOut(expr, hint!.moves, tray)
    expect(evaluate(solved)).toBe(8)
  })

  it('names a position that really holds the block once the move is applied', () => {
    // 9 × (6+2) = 72 — the search tries a bare leaf before a block at each
    // position, so the block lands second here, not first. Whatever
    // position it names, that is where the group must end up.
    const tray = createTray([6, 2, 9])
    const hint = computeHint(createExpression(), tray, 72, ALL_OPS, 3)
    expect(hint).not.toBeNull()

    let expr = createExpression()
    for (const move of hint!.moves) {
      expr = applyMove(expr, move, tray)
      if (move.kind === 'block') {
        const slot = expr.root.children[move.index]
        expect(slot).not.toBeNull()
        expect(slot!.kind).toBe('group')
      }
    }
    expect(evaluate(expr)).toBe(72)
  })
})
