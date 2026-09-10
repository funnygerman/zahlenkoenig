// Drives the hint button (concept 10.3) on top of core/hints.ts's pure
// Restlöser. Recomputing the hint fresh on every press (rather than
// indexing into a plan captured once) means a player who places a chip by
// hand between two hint presses still gets the right next move — the plan
// is never stale, because there never is a stored plan, only "the hint for
// the board as it is right now".
//
// Three PO decisions from the hint round shape what a press does, and each
// one replaces something concept 10.3 originally asked for:
//
// 1. **Every press places a chip.** 10.3's first press used to pulse two
//    tray chips and place nothing. It was dropped for two reasons. It read
//    as a dead button ("sometimes nothing happens when I press hint" — the
//    pulse is also invisible whenever fewer than two numbers are left to
//    place, which is most of a half-built board), and the two chips it
//    pulsed were routinely not the chips the following presses went on to
//    place: the pulse named the operands of the continuation's first
//    block, while the presses after it walked a *freshly recomputed*
//    continuation, and recomputing after the block landed can pick a
//    different — equally correct — filling of it. Nothing pulses now.
//
// 2. **Two hints per puzzle, counted in chips, not presses.** A hint is
//    spent while the chip it contributed is on the board; take that chip
//    off again and the hint comes back (PO: "count chips, not presses").
//    Which chips those are is read off the tree rather than predicted:
//    `placeOperator`/`placeBlockAt` mint their own ids inside `useGame`, so
//    a press records the board's ids first and attributes whatever appears
//    next to the hint.
//
// 3. **A dead-end board is marked, never repaired.** Pressing hint on a
//    board that can no longer reach the target used to do literally
//    nothing (`computeHint` returns null, and the press returned early) —
//    the other half of the "nothing happens" report. It marks the chips in
//    the way now (`findBlockers`) and still refuses to touch them: taking
//    them back is the player's own move (PO), and it costs no hint.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { computeHint, findBlockers, type HintMove } from '../core/hints'
import { createExpression, type Expression, type Group, type Leaf, type NumberLeaf, type Operator, type Slot } from '../core/expression'

/**
 * How many hints one puzzle gives (concept 10.3, revised twice by the PO):
 * **half the chips it takes to solve, rounded up in the player's favour** —
 * seven chips (four numbers, three operators) give four hints, nine (the
 * same plus two blocks) give five.
 *
 * `chipsNeeded` is the length of the canonical continuation from an *empty*
 * field, which is exactly "how many chips finish this puzzle" and is what
 * makes the two counts differ: a puzzle whose own solution needs no bracket
 * costs seven chips, one that needs two costs nine. It is read once per
 * puzzle rather than recomputed as the board fills, so the budget a player
 * starts with is the budget they keep.
 *
 * **Two numbers gives none at all** (PO), rather than the two the formula
 * would otherwise hand out: three chips is the whole puzzle, and a hint
 * there is most of the answer. `offered` is false for those, and the header
 * hides the icon instead of showing one that can never do anything.
 */
export function hintBudget(numbersCount: number, chipsNeeded: number): number {
  if (numbersCount <= 2) return 0
  return Math.ceil(chipsNeeded / 2)
}

export interface UseHintOptions {
  expr: Expression
  tray: readonly NumberLeaf[]
  target: number
  opsAllowed: Operator[]
  numbersCount: number
  onApplyMove: (move: HintMove) => void
}

/**
 * What a hint gave the board, in terms that survive the chip being taken
 * off and put back by hand.
 *
 * A number is its leaf id: `useGame`'s tray mints one id per number for the
 * puzzle's whole life, so removing and re-placing the *same* number is the
 * same chip. An operator and a block have no such identity —
 * `placeOperator` and `placeBlockAt` mint a fresh id every time — so
 * matching them by id let a player launder a hint: take the operator off,
 * put an identical one back by hand, and the budget saw the hint's chip
 * leave and never return. They are matched by *what they are* instead, once
 * each, against what the board actually holds.
 */
type Contribution =
  | { kind: 'number'; id: string }
  | { kind: 'operator'; op: Operator }
  | { kind: 'block' }

interface BoardIndex {
  /** every id on the board — what a press diffs against to see what it added */
  ids: Set<string>
  nodes: Map<string, Leaf | Group>
  operators: Operator[]
  groups: number
}

function indexBoard(children: readonly Slot[]): BoardIndex {
  const index: BoardIndex = { ids: new Set(), nodes: new Map(), operators: [], groups: 0 }
  const visit = (list: readonly Slot[]) => {
    for (const slot of list) {
      if (slot === null) continue
      index.ids.add(slot.id)
      index.nodes.set(slot.id, slot)
      if (slot.kind === 'group') { index.groups += 1; visit(slot.children) }
      else if (slot.kind === 'operator') index.operators.push(slot.value)
    }
  }
  visit(children)
  return index
}

/** How many of the hint's contributions the board still holds — each one matched at most once, so two `×` chips never pay for one hinted `×` twice. */
function stillOnBoard(contributed: readonly Contribution[], board: BoardIndex): number {
  const operators = [...board.operators]
  let groups = board.groups
  let held = 0
  for (const c of contributed) {
    if (c.kind === 'number') { if (board.ids.has(c.id)) held += 1; continue }
    if (c.kind === 'block') { if (groups > 0) { groups -= 1; held += 1 } continue }
    const at = operators.indexOf(c.op)
    if (at !== -1) { operators.splice(at, 1); held += 1 }
  }
  return held
}

export function useHint({ expr, tray, target, opsAllowed, numbersCount, onApplyMove }: UseHintOptions) {
  // concept 10.3's "kostenlos, dauerhaft" dead-end border reads this too —
  // computed on every board change, not just on a hint press. Not gated on
  // isExpressionComplete: concept 2.1 gives the root no minimum length, so
  // a single placed number is already "complete" in that tree-shape sense
  // long before the puzzle is actually solved — computeHint itself already
  // accounts for whatever's still unplaced in the tray, and an already
  // fully (and correctly) built expression just comes back with an empty,
  // harmless move list.
  const hint = useMemo(
    () => computeHint(expr, tray, target, opsAllowed, numbersCount),
    [expr, tray, target, opsAllowed, numbersCount]
  )
  const deadEnd = hint === null

  const board = useMemo(() => indexBoard(expr.root.children), [expr])

  // ------------------------------------------------------------- budget
  // Read from the *empty* field, not the current one, so the budget is a
  // property of the puzzle rather than of how far the player has got: the
  // same search `computeHint` already runs, asked once about a board with
  // nothing on it. `tray`/`target`/`opsAllowed`/`numbersCount` never change
  // within one Board instance (a new puzzle remounts it), so this runs once
  // per puzzle despite being a memo rather than an initializer.
  const budget = useMemo(
    () => hintBudget(numbersCount, computeHint(createExpression(), tray, target, opsAllowed, numbersCount)?.moves.length ?? 0),
    [tray, target, opsAllowed, numbersCount]
  )

  const [contributed, setContributed] = useState<readonly Contribution[]>([])
  const beforePressRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    const before = beforePressRef.current
    if (!before) return
    beforePressRef.current = null
    const added = [...board.ids]
      .filter(id => !before.has(id))
      .map((id): Contribution | null => {
        const node = board.nodes.get(id)
        if (!node) return null
        if (node.kind === 'number') return { kind: 'number', id }
        if (node.kind === 'operator') return { kind: 'operator', op: node.value }
        return { kind: 'block' }
      })
      .filter((c): c is Contribution => c !== null)
    if (added.length > 0) setContributed(prev => [...prev, ...added])
  }, [board])

  const hintsLeft = Math.max(0, budget - stillOnBoard(contributed, board))

  // ------------------------------------------------------------- marking
  // Held against the exact tree it was computed for, so the marks clear
  // themselves the moment the player moves anything — no effect, and no
  // way for a stale mark to outlive the board it was about.
  const [marked, setMarked] = useState<{ expr: Expression; ids: string[] } | null>(null)
  const blockingIds = marked !== null && marked.expr === expr ? marked.ids : null

  /** Whether this puzzle has hints at all — false only for two numbers, where the header hides the icon rather than muting it (PO). */
  const offered = budget > 0

  /**
   * The hint never places either of the puzzle's **last two chips** (PO).
   * `hint.moves.length` is exactly how many chips still finish this board,
   * so the rule is one comparison — but it is the load-bearing one: the
   * budget alone only guarantees the player finishes the puzzle themselves
   * while the *accounting* holds, and the accounting has already been
   * laundered once (take a hinted operator off, put an identical one back
   * by hand, and its freshly minted id is not the one the hint recorded —
   * see `Contribution`). That hole is closed, but this rule is what makes
   * it not matter: whatever a player does to the budget, the last two chips
   * are theirs.
   */
  const LAST_CHIPS_ARE_THE_PLAYERS = 2
  const canPlace = hint !== null && hint.moves.length > LAST_CHIPS_ARE_THE_PLAYERS && hintsLeft > 0
  /** Whether a press would do anything at all — what mutes the header's hint button. */
  const available = offered && (deadEnd || canPlace)

  const onPressHint = useCallback(() => {
    if (budget === 0) return
    if (hint === null) {
      setMarked({ expr, ids: findBlockers(expr, tray, target, opsAllowed, numbersCount) })
      return
    }
    if (!canPlace) return
    beforePressRef.current = board.ids
    onApplyMove(hint.moves[0])
  }, [budget, canPlace, hint, expr, tray, target, opsAllowed, numbersCount, board, onApplyMove])

  return { deadEnd, blockingIds, hintsLeft, offered, available, onPressHint }
}
