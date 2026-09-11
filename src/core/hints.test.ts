import { describe, it, expect } from 'vitest'
import { computeHint, findBlockers, isStuck, type HintMove } from './hints'
import {
  createExpression, createTray, createOperatorLeaf,
  nextOpenSurface, resolveBlockDrop, applyBlockDrop, dissolveGroup, insertLeafIntoGroup, placeAt, trimTrailingGaps, withMinimumShape,
  type Expression, type Group, type Leaf, type NumberLeaf, type Operator, type Slot,
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

  if (move.kind === 'grow') {
    // concept 6.2's drag-only growth, mirroring useGame's `growGroupAt`:
    // a tray number onto the block's right bracket edge, which splices in
    // the number *and* an open slot for the operator that will join it.
    const grown = insertLeafIntoGroup(expr.root.children, move.index, 'after', tray.find(t => t.id === move.leafId)!)
    if (!grown) throw new Error('hint proposed a grow onto something that is not a block')
    return { root: { ...expr.root, children: trimTrailingGaps(grown) } }
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

  it('a hint-introduced block grows to a third number, and says so with a `grow` move', () => {
    // **This assertion used to be `toBeNull()`**, and the reversal is the
    // whole point of the three-number-group round. `(1+1+1)×3 = 9` from
    // `[1,1,1,3]` is `solver.test.ts`'s own worked example of a value a flat
    // chain cannot reach; `reachable()` always found it, because it does not
    // care how a group's shape gets built. `completions` could not, because
    // every move it proposed had to be a tap and concept 6.2 makes growing a
    // group past two numbers drag-only.
    //
    // That was not the edge case this test's old comment implied.
    // `scripts/checkHintReachable.ts` measured it at **39.8% of four-number
    // draws**, with two selections walled end to end. `HintMove` gained a
    // `grow` kind — the drag onto a bracket edge, applied through the same
    // `insertLeafIntoGroup` the board's own drop handler calls — and the
    // search can now propose the shape.
    const tray = createTray([1, 1, 1, 3])
    const hint = computeHint(createExpression(), tray, 9, ['+', '*'], 4)
    expect(hint).not.toBeNull()
    expect(hint!.moves.some(m => m.kind === 'grow')).toBe(true)

    // …and the moves really do build it: replayed through the same
    // primitives a tap and a drag call, the board reaches 9.
    expect(evaluate(playOut(createExpression(), hint!.moves, tray))).toBe(9)
  })

  it('still prefers a flat continuation when one exists — fewest blocks first (10.2)', () => {
    // The guard on the round above: a search that *can* reach for a
    // three-number group must not start reaching when it has no need to.
    // 48 is flat-reachable from 6,2,9,3 (`6×9−2×3`), so no bracket at all.
    const tray = createTray([6, 2, 9, 3])
    const hint = computeHint(createExpression(), tray, 48, ['+', '-', '*', '/'], 4)
    expect(hint!.moves.some(m => m.kind === 'block' || m.kind === 'grow')).toBe(false)
  })
})

describe('computeHint — a bracket may enclose chips that are already down', () => {
  // PO report: "(9 − 2) × 4 × 2 marks as wrong", against the puzzle whose
  // hinted solution is (4 + 2) × 9 + 2 — both reach 56 from 4, 2, 9, 2.
  // The player had started flat, meaning to bracket the 9 − 2 afterwards,
  // which is a gesture the game has (a tapped block chip wraps an adjacent
  // pair — `resolveBlockDrop`'s `wrap`, span 3). The search could only
  // imagine a bracket over positions nobody had touched, so it called the
  // board a dead end and `findBlockers` marked the operator.
  const PO_NUMBERS = [4, 2, 9, 2]
  const PO_TARGET = 56

  const board = (children: (Leaf | Group | null)[]): Expression => ({ root: { id: 'root', kind: 'group', children } })

  it('a lone number and operator on the way to a bracketed solution is not a dead end', () => {
    const tray = createTray(PO_NUMBERS)
    const expr = board([tray[2], createOperatorLeaf('-')]) // "9 −"
    expect(computeHint(expr, tray, PO_TARGET, ALL_OPS, 4)).not.toBeNull()
    expect(findBlockers(expr, tray, PO_TARGET, ALL_OPS, 4)).toEqual([]) // and nothing is marked
  })

  it('the pair itself, still unbracketed, is not a dead end either', () => {
    const tray = createTray(PO_NUMBERS)
    const expr = board([tray[2], createOperatorLeaf('-'), tray[1]]) // "9 − 2"
    const hint = computeHint(expr, tray, PO_TARGET, ALL_OPS, 4)
    expect(hint).not.toBeNull()
    // and the continuation it hands back really does finish the puzzle
    expect(evaluate(playOut(expr, hint!.moves, tray))).toBe(PO_TARGET)
  })

  it('the block move comes last when it wraps chips already on the board', () => {
    // `resolveBlockDrop` only reports `wrap` once both operands are real
    // leaves, so the chips have to go down before the bracket does.
    const tray = createTray(PO_NUMBERS)
    const expr = board([tray[2], createOperatorLeaf('-')])
    const hint = computeHint(expr, tray, PO_TARGET, ALL_OPS, 4)!
    const blockAt = hint.moves.findIndex(m => m.kind === 'block')
    if (blockAt !== -1) expect(blockAt).toBeGreaterThan(0)
    expect(evaluate(playOut(expr, hint.moves, tray))).toBe(PO_TARGET)
  })

  it('still places an empty bracket first when it wraps nothing', () => {
    // The other ordering, unchanged: over three untouched positions the
    // block lands first and is filled afterwards, so the player is never
    // shown a complete-but-wrong row waiting for its bracket.
    const tray = createTray([2, 1, 3])
    const expr = board([tray[0], createOperatorLeaf('*')]) // "2 ×", solution 2 × (1 + 3)
    const hint = computeHint(expr, tray, 8, ALL_OPS, 3)!
    expect(hint.moves[0]).toEqual({ kind: 'block', index: 2 })
  })
})

describe('findBlockers — what a hint press marks on a dead-end board (PO, hint round)', () => {
  // Replaces the pulse this round removed: a press on a board that can no
  // longer reach the target marks the chips in the way and stops there —
  // taking them back stays the player's own move.

  it('marks nothing while the target is still reachable — there is nothing in the way', () => {
    const tray = createTray([6, 2, 9, 3])
    expect(findBlockers(createExpression(), tray, 48, ALL_OPS, 4)).toEqual([])
  })

  it('marks the one chip in the way, and taking just that one back reaches the target again', () => {
    // 3 + 4 is 7, not 12 — but 3 × 4 is, so the `+` is the whole problem
    // and neither the 3 nor the (still unplaced) 4 is to blame.
    const tray = createTray([3, 4])
    const plus = createOperatorLeaf('+')
    const expr: Expression = { root: { id: 'root', kind: 'group', children: [tray[0], plus] } }

    expect(findBlockers(expr, tray, 12, ['+', '*'], 2)).toEqual([plus.id])
  })

  it('marks nothing when the puzzle itself is unreachable — the board is not what is wrong', () => {
    // [1,1,1,1] can't reach 1000 from an empty field either (solver.test.ts
    // pins that down), so blaming the one chip the player did place would
    // be saying something untrue about it. The dead-end border, which is
    // free and always on, has already said the puzzle is over.
    const tray = createTray([1, 1, 1, 1])
    const expr: Expression = { root: { id: 'root', kind: 'group', children: [tray[0]] } }

    expect(computeHint(expr, tray, 1000, ALL_OPS, 4)).toBeNull()
    expect(findBlockers(expr, tray, 1000, ALL_OPS, 4)).toEqual([])
  })

  it('whatever it marks always rescues the board once removed — over several dead ends', () => {
    // The contract, stated as the property rather than as one expected
    // answer: `findBlockers` never marks a set that leaves the board stuck.
    const cases: { numbers: number[]; target: number; ops: Operator[]; build: (t: NumberLeaf[]) => Slot[] }[] = [
      // 6 + 2 + 9 + 3 = 20, complete and wrong — 48 is still reachable from these four numbers
      { numbers: [6, 2, 9, 3], target: 48, ops: ALL_OPS, build: t => [t[0], createOperatorLeaf('+'), t[1], createOperatorLeaf('+'), t[2], createOperatorLeaf('+'), t[3]] },
      // a bracket in the wrong place: (6 + 2) leads nowhere at this target, flat 6 × 9 − 2 × 3 does
      { numbers: [6, 2, 9, 3], target: 48, ops: ALL_OPS, build: t => [{ id: 'g1', kind: 'group', children: [t[0], createOperatorLeaf('/'), t[1]] }, createOperatorLeaf('/'), t[2]] },
      // a single wrong operator early on
      { numbers: [2, 1, 3], target: 8, ops: ALL_OPS, build: t => [t[0], createOperatorLeaf('-')] },
    ]

    for (const { numbers, target, ops, build } of cases) {
      const tray = createTray(numbers)
      const expr: Expression = { root: { id: 'root', kind: 'group', children: build(tray) } }
      expect(computeHint(expr, tray, target, ops, numbers.length)).toBeNull() // the case really is a dead end

      const marked = findBlockers(expr, tray, target, ops, numbers.length)
      expect(marked.length).toBeGreaterThan(0)

      // every marked id is really on the board, and removing exactly them frees it
      const onBoard = new Set<string>()
      for (const slot of expr.root.children) {
        if (slot === null) continue
        onBoard.add(slot.id)
        if (slot.kind === 'group') for (const c of slot.children) if (c !== null) onBoard.add(c.id)
      }
      for (const id of marked) expect(onBoard.has(id)).toBe(true)

      // Removed the way the game removes — a leaf's position stays open
      // (nulled in place, so the row's operand/operator parity survives),
      // a block is dissolved and its contents stay put (concept 6.5).
      // Same mirroring `applyMove` above does for the placement side.
      let children: Slot[] = expr.root.children.slice()
      for (const id of marked) {
        const at = children.findIndex(slot => slot !== null && slot.id === id)
        if (at !== -1) {
          const slot = children[at]!
          children = slot.kind === 'group' ? trimTrailingGaps(dissolveGroup(children, at)) : trimTrailingGaps(children.map((s, i) => (i === at ? null : s)))
          continue
        }
        children = children.map(slot => (slot === null || slot.kind !== 'group' ? slot : { ...slot, children: slot.children.map(c => (c !== null && c.id === id ? null : c)) }))
      }
      expect(computeHint({ root: { ...expr.root, children } }, tray, target, ops, numbers.length)).not.toBeNull()
    }
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
