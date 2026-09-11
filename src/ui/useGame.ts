// Game state (concept 14: "useGame.ts — Spielzustand") for a single, fixed
// puzzle — v2 step 2's actual goal ("ein fest verdrahtetes Rätsel ist
// spielbar"). No settings, no bank/generator wiring, no hints yet; those
// come with later steps. Owns the Expression tree and derives everything
// else (which tray chips are used, how many blocks remain, whether the
// expression is complete, its result) rather than tracking them
// separately — a second source of truth for "is this number used" is
// exactly the kind of drift concept 15.1 blamed v1's generator/validator
// split on.

import { useCallback, useMemo, useState } from 'react'
import {
  createExpression, createTray, createOperatorLeaf,
  placeAt, trimTrailingGaps, fillGap, swapSlots, removeOperand, removeOperator,
  dissolveGroup, nextOpenSurface, resolveBlockDrop, nextBlockTarget, applyBlockDrop, withMinimumShape, isExpressionComplete,
  absorbIntoGroup, absorbPairIntoGroup, insertLeafIntoGroup, moveGroup,
  type Expression as ExpressionTree, type Leaf, type Group, type Slot, type Surface, type Operator,
} from '../core/expression'
import { evaluateAttempt } from '../core/evaluate'
import type { HintMove } from '../core/hints'
import type { TrayNumberSlot } from './Tray'
import { parseZoneId } from './Expression'

export interface UseGameOptions {
  numbers: number[]
  target: number
  ops: Operator[]
}

export type GameStatus = 'idle' | 'correct' | 'wrong'

interface DragPayload {
  role: 'number' | 'operator' | 'block'
  operator?: Operator
  /** which half of the board a chip was picked up from — Game.tsx's own DragPayload has the full account of why this is needed. Only a placed block's origin actually distinguishes anything here: a number/operator's is already recoverable from whether its id is in the tree. */
  origin?: 'tray' | 'field'
}

export interface GameDropItem {
  id: string
  kind: 'operand' | 'operator'
  data: DragPayload
}

export interface GameDropTarget {
  zoneId: string
  occupied: boolean
}

// -------------------------------------------------------------- tree lookups
// Small local helpers, not exported from core/expression.ts: they're about
// *finding things by id*, one level above the four pure operations, and
// only useGame.ts needs them.

function collectPlacedIds(children: readonly Slot[]): Set<string> {
  const ids = new Set<string>()
  for (const c of children) {
    if (c === null) continue
    if (c.kind === 'group') { for (const gc of c.children) if (gc) ids.add(gc.id) }
    else ids.add(c.id)
  }
  return ids
}

function countGroups(children: readonly Slot[]): number {
  return children.filter(c => c !== null && c.kind === 'group').length
}

/** Open (null) positions of one kind, root level and group interiors alike — the slots already drawn on the board, which the trailing scaffold must not count a second time. */
function countOpenSlots(children: readonly Slot[], kind: 'operand' | 'operator'): number {
  let open = 0
  for (let i = 0; i < children.length; i++) {
    const c = children[i]
    if (c !== null && c.kind === 'group') {
      for (let j = 0; j < c.children.length; j++) {
        if (c.children[j] === null && (j % 2 === 0 ? 'operand' : 'operator') === kind) open += 1
      }
      continue
    }
    if (c === null && (i % 2 === 0 ? 'operand' : 'operator') === kind) open += 1
  }
  return open
}

/** Operator leaves already placed, root level and group interiors alike. */
function countPlacedOperators(children: readonly Slot[]): number {
  let placed = 0
  for (const c of children) {
    if (c === null) continue
    if (c.kind === 'group') { for (const gc of c.children) if (gc?.kind === 'operator') placed += 1 }
    else if (c.kind === 'operator') placed += 1
  }
  return placed
}

/**
 * Whether a candidate tree still fits the puzzle: n operand positions and
 * n − 1 operator positions is everything an n-number puzzle can ever hold
 * (concept 6.4), placed and open alike. Only the gestures that *create* an
 * open slot need to ask — dropping a lone tray chip into a block brings an
 * empty partner slot in with it (concept 6.2), and one slot too many is a
 * position nothing could ever fill.
 */
function withinBudget(children: readonly Slot[], numbersCount: number): boolean {
  let operands = 0
  let operators = 0
  for (let i = 0; i < children.length; i++) {
    const c = children[i]
    if (c !== null && c.kind === 'group') {
      operands += Math.ceil(c.children.length / 2)
      operators += Math.floor(c.children.length / 2)
      continue
    }
    if (i % 2 === 0) operands += 1
    else operators += 1
  }
  return operands <= numbersCount && operators <= numbersCount - 1
}

interface Location {
  groupId: string | null
  index: number
}

function findLocation(children: readonly Slot[], id: string): Location | null {
  for (let i = 0; i < children.length; i++) {
    const c = children[i]
    if (c === null) continue
    if (c.kind === 'group') {
      for (let j = 0; j < c.children.length; j++) {
        if (c.children[j]?.id === id) return { groupId: c.id, index: j }
      }
      continue
    }
    if (c.id === id) return { groupId: null, index: i }
  }
  return null
}

function findLeaf(children: readonly Slot[], id: string): Leaf | null {
  for (const c of children) {
    if (c === null) continue
    if (c.kind === 'group') {
      for (const gc of c.children) if (gc?.id === id) return gc
      continue
    }
    if (c.id === id) return c
  }
  return null
}

function groupAt(children: readonly Slot[], groupId: string): Group | null {
  for (const c of children) if (c !== null && c.kind === 'group' && c.id === groupId) return c
  return null
}

/** The root index of the group with this id, or -1 if there is none. */
function findGroupIndex(children: readonly Slot[], id: string): number {
  return children.findIndex(c => c !== null && c.kind === 'group' && c.id === id)
}

/** Which side of the group (if either) a root-level leaf at `leafIndex` is close enough to absorb into — see `absorbIntoGroup`'s own note on why this only ever looks at the immediate connecting pair. */
function sideOf(leafIndex: number, groupIndex: number): 'before' | 'after' | null {
  if (leafIndex === groupIndex - 1 || leafIndex === groupIndex - 2) return 'before'
  if (leafIndex === groupIndex + 1 || leafIndex === groupIndex + 2) return 'after'
  return null
}

/**
 * Whether clearing a moved leaf's old position would leave a gap nothing
 * could ever fill again — the leaf itself is the only thing that could
 * plug that exact spot, and it's the one thing that just left (see the
 * call site's own note). A root-level *trailing* position doesn't count:
 * `withRootChildren`'s `trimTrailingGaps` removes it outright, so there's
 * no gap left behind at all.
 */
function wouldStrandAGap(
  expr: ExpressionTree,
  originLoc: Location,
  leafKind: 'number' | 'operator',
  tray: readonly Leaf[],
  numbersCount: number
): boolean {
  if (originLoc.groupId === null && originLoc.index === expr.root.children.length - 1) return false
  if (leafKind === 'number') {
    const placedIds = collectPlacedIds(expr.root.children)
    return tray.every(n => placedIds.has(n.id)) // no unplaced number left to fill the gap
  }
  return countPlacedOperators(expr.root.children) >= numbersCount - 1 // operator budget already spent
}

// ------------------------------------------------------------- tree edits
// Each takes the current tree and returns a new one — same pure-update
// style as core/expression.ts's own operations, one level up (these know
// about *root vs. inside a specific group*, which the four operations
// themselves don't).

function withRootChildren(expr: ExpressionTree, children: Slot[]): ExpressionTree {
  // Trailing gaps are never stored — see `trimTrailingGaps`. Doing it here,
  // once, covers every edit rather than asking each of them to remember.
  // A *group's* trailing slots are different and stay: its minimum shape is
  // part of what a block means (concept 6.3).
  return { root: { ...expr.root, children: trimTrailingGaps(children) } }
}

// `withMinimumShape` itself now lives in core/expression.ts (concept 6.3
// applies to a freshly wrapped group exactly as much as a freshly placed
// empty one, and both paths need it) — this file just keeps using it: taking
// a number back out of a block used to shrink the bracket with it
// (`removeOperand` splices out the operand *and* its operator), so `(6+2)`
// minus its `+` and `6` left `(2)`: a bracket with no open slot inside it
// and no visible way to refill it, only dissolve and start over. The
// bracket keeps its shape instead and shows the gaps.

function withGroupChildren(expr: ExpressionTree, groupId: string, groupChildren: (Leaf | null)[]): ExpressionTree {
  const children = withMinimumShape(groupChildren)
  return withRootChildren(expr, expr.root.children.map(c => (c !== null && c.kind === 'group' && c.id === groupId ? { ...c, children } : c)))
}

/**
 * Places a leaf at an already-located open surface (concept 3.1).
 * `placeAt` covers all three positions a surface can be in — an existing
 * gap, the frontier, or a scaffold position past it that the field draws
 * but the tree hasn't reached yet.
 */
function placeLeafAt(expr: ExpressionTree, surface: Surface, leaf: Leaf): ExpressionTree {
  if (surface.groupId === null) {
    return withRootChildren(expr, placeAt(expr.root.children, surface.index, leaf))
  }
  const group = groupAt(expr.root.children, surface.groupId)
  if (!group) return expr
  return withGroupChildren(expr, surface.groupId, placeAt(group.children, surface.index, leaf))
}

/**
 * Removes the leaf with this id from wherever it is. At the root, this just
 * clears its slot — concept 6.6: "Tippen auf einen platzierten Chip ist
 * zugleich die exakte Umkehrung des Platzierens" (tapping/pulling a placed
 * chip out is the *exact* inverse of placing it), and placing one (`placeAt`)
 * never touches a neighbor either. Coupling an operand's removal to an
 * adjacent operator's — `6, +, 2`, tap `2`, and the `+` vanished too, or tap
 * `6` and `2` slid up to take its place — was concept 3's original worry
 * about a "dangling" operator, from before `placeAt` made every root
 * position independently addressable; a leftover open operator slot is now
 * exactly as normal as any other gap the scaffold already shows, not
 * something to avoid. `trimTrailingGaps` (via `withRootChildren`) still
 * closes it up when the cleared slot was the trailing one, same as it
 * always has.
 *
 * A *group's* interior keeps the old coupled behavior on purpose: concept
 * 6.3 (`withMinimumShape`, in `withGroupChildren`) always closes a block's
 * content up to its front and keeps the open slots at the end, so `(6+2)`
 * minus `6` becomes `(2 ⬚ ⬚)`, not a hole in the middle of the bracket.
 */
function removeLeafById(expr: ExpressionTree, id: string): ExpressionTree {
  const loc = findLocation(expr.root.children, id)
  if (!loc) return expr
  if (loc.groupId === null) {
    return withRootChildren(expr, fillGap(expr.root.children, loc.index, null))
  }
  const isOperand = loc.index % 2 === 0
  const group = groupAt(expr.root.children, loc.groupId)
  if (!group) return expr
  const next = isOperand ? removeOperand(group.children, loc.index) : removeOperator(group.children, loc.index)
  return withGroupChildren(expr, loc.groupId, next)
}

export function useGame({ numbers, target, ops }: UseGameOptions) {
  const tray = useMemo(() => createTray(numbers), [numbers])
  const blockBudget = Math.floor(numbers.length / 2)

  const [expr, setExprState] = useState<ExpressionTree>(createExpression)
  const [status, setStatus] = useState<GameStatus>('idle')

  /**
   * Every change to the tree goes through here so that a "wrong" verdict
   * doesn't outlive the expression it was about: the readout turns red on
   * a wrong submit (concept 9.2) and stayed red while the player took the
   * chips apart and rebuilt them, marking an expression that was never
   * submitted. Only 'wrong' is cleared — a 'correct' one has Board's own
   * 1200ms timer (concept 12.8) hanging off it, and clearing that on the
   * next tap would strand the player on a solved board with no next
   * puzzle.
   */
  const setExpr = useCallback((updater: (current: ExpressionTree) => ExpressionTree) => {
    setExprState(updater)
    setStatus(s => (s === 'wrong' ? 'idle' : s))
  }, [])

  const placedIds = useMemo(() => collectPlacedIds(expr.root.children), [expr])
  const blocksUsed = useMemo(() => countGroups(expr.root.children), [expr])
  const complete = useMemo(() => isExpressionComplete(expr), [expr])
  // evaluateAttempt, not evaluate: a submitted attempt's own notation line
  // (concept 9.2, result-on-submit round) shows a negative result rather
  // than hiding it, unlike a puzzle's own generated/hinted target — the
  // target comparison below still only ever matches a non-negative target,
  // so a negative attempt compares unequal exactly as it did before.
  const result = useMemo(() => (complete ? evaluateAttempt(expr) : null), [expr, complete])

  const trayNumbers: TrayNumberSlot[] = useMemo(
    () => tray.map(leaf => ({ id: leaf.id, value: leaf.value, used: placedIds.has(leaf.id) })),
    [tray, placedIds]
  )
  const blockDisabled = blocksUsed >= blockBudget

  // concept 9.1: `=` stays dimmed "solange nicht alle Zahlen gesetzt sind
  // oder noch eine Lücke offen ist" — two conditions, and only the second
  // one was being asked. A structurally complete expression can leave
  // numbers in the tray (a single placed chip is complete, concept 2.1
  // gives the root no minimum length), so a puzzle whose target happens to
  // equal one of its own numbers — measured at about one in four of the
  // three-number puzzles drawn — could be "solved" by tapping that one
  // chip and pressing `=`. The dimmed button is also the only place the
  // rule "jede Zahl genau einmal" is stated at all (concept 11's table:
  // "Alle Zahlen müssen verwendet werden | entfällt – `=` bleibt
  // gedimmt").
  const allNumbersPlaced = trayNumbers.every(n => n.used)
  const submittable = complete && allNumbersPlaced

  // The same fact from the operator's side: n numbers take exactly n − 1
  // operators, so once they are all placed a tap on a tray operator has
  // nowhere to go and `placeOperator` returns the tree unchanged. The chip
  // said nothing about that and looked exactly as it had a moment before —
  // a chip that does nothing when tapped, which is the block chip's own
  // case (concept 4: "Ist das Kontingent ausgeschöpft, deaktiviert sich
  // der Chip"). It is *muted*, not `disabled`, because dragging one onto a
  // placed operator to replace it stays possible and a disabled button
  // receives no pointer events at all.
  const operatorsMuted = countPlacedOperators(expr.root.children) >= numbers.length - 1

  // concept 6.4: the field shows, from the start, how many chips this
  // puzzle still needs — "ein Gerüst ist damit in der Anzahl immer
  // richtig". Derived, not tracked: what's left in the tray minus the open
  // slots already drawn on the board. n numbers always need n-1 operators,
  // whatever shape the expression ends up in, so the operator count follows
  // from the same one fact.
  //
  // This is also what makes the field droppable at all: with no scaffold
  // the trailing frontier renders nothing, and a zero-width element can't
  // be hit by a finger (useDrag's `tolerance` covers the rest).
  // `trayNumbers`, not `placedIds`: the latter holds every placed id,
  // operators included, so subtracting its size from the number count made
  // the field lose an operand slot for each operator placed.
  const numbersLeft = trayNumbers.filter(n => !n.used).length
  const scaffoldOperands = Math.max(0, numbersLeft - countOpenSlots(expr.root.children, 'operand'))
  const scaffoldOperators = Math.max(
    0,
    (numbers.length - 1) - countPlacedOperators(expr.root.children) - countOpenSlots(expr.root.children, 'operator')
  )

  // ------------------------------------------------------------- placing

  const placeNumber = useCallback((leaf: Leaf) => {
    setExpr(e => placeLeafAt(e, nextOpenSurface(e, 'operand'), leaf))
  }, [])

  // `nextOpenSurface` is purely structural and always names a position,
  // including one past the end — the puzzle's own budget is this layer's
  // job. n numbers take exactly n − 1 operators, and a tap past that does
  // nothing rather than growing the expression, the same cap the block
  // chip enforces by disabling itself.
  const placeOperator = useCallback((op: Operator) => {
    setExpr(e => {
      if (countPlacedOperators(e.root.children) >= numbers.length - 1) return e
      return placeLeafAt(e, nextOpenSurface(e, 'operator'), createOperatorLeaf(op))
    })
  }, [numbers.length])

  // Tapping is dragging's own resolution, just found without a hover
  // position: `nextBlockTarget` finds the first eligible root position in
  // document order, and `resolveBlockDrop` resolves it exactly as it would
  // for a drag released there — wrapping an existing pair, not just landing
  // on an empty slot (concept: "Tippen ist dieselbe Operation mit anderem
  // Auslöser", PO).
  const placeBlock = useCallback(() => {
    setExpr(e => {
      const index = nextBlockTarget(e.root.children)
      const resolved = resolveBlockDrop(e.root.children, index)
      if (!resolved) return e
      return withRootChildren(e, applyBlockDrop(e.root.children, index, resolved))
    })
  }, [])

  /**
   * The same placement at a *named* root position — what a block dragged
   * there does (concept 6.1), and what the hint needs: its continuation
   * decides where the block belongs, and `nextBlockTarget`'s "first
   * eligible position" is only right for a tap (see HintMove's own note).
   */
  const placeBlockAt = useCallback((index: number) => {
    setExpr(e => {
      const resolved = resolveBlockDrop(e.root.children, index)
      if (!resolved) return e
      return withRootChildren(e, applyBlockDrop(e.root.children, index, resolved))
    })
  }, [setExpr])

  /**
   * A tray number dropped on the *right* bracket edge of the block at
   * `index` — concept 6.2's drag-only "grow past the minimum shape", and
   * the only placement in this file with no tap equivalent at all.
   *
   * Deliberately the same three lines as `onDrop`'s own tray-onto-a-
   * bracket-edge branch, `withinBudget` included: a hint move must be a
   * gesture the player has, so it has to be refused wherever the gesture
   * would be. (It never is, from a hint — `completions` only proposes a
   * third number where the puzzle's own operator budget covers the slot it
   * opens — but the guard costs nothing and keeps the two paths honest.)
   */
  const growGroupAt = useCallback((index: number, leaf: Leaf) => {
    setExpr(e => {
      const inserted = insertLeafIntoGroup(e.root.children, index, 'after', leaf)
      if (!inserted) return e
      const next = withRootChildren(e, inserted)
      return withinBudget(next.root.children, numbers.length) ? next : e
    })
  }, [numbers.length])

  // -------------------------------------------------------- tap handlers

  const onTapNumber = useCallback((id: string) => {
    if (placedIds.has(id)) {
      setExpr(e => removeLeafById(e, id))
      return
    }
    const leaf = tray.find(n => n.id === id)
    if (leaf) placeNumber(leaf)
  }, [placedIds, tray, placeNumber])

  const onTapOperator = useCallback((op: Operator) => {
    placeOperator(op)
  }, [placeOperator])

  /**
   * The tray's block chip is a single, permanent button, like an operator's
   * — not one placeholder per unit of budget (Tray.tsx's own note on why).
   * Once the budget (concept 4: ⌊n/2⌋) is used up the chip disables itself
   * (`blockDisabled`); this only needs to place, never to dissolve.
   */
  const onTapBlock = useCallback(() => {
    if (blocksUsed >= blockBudget) return
    placeBlock()
  }, [blocksUsed, blockBudget, placeBlock])

  /** Expression.tsx's callback: tapping a placed leaf returns it (concept 6.6). */
  const onTapLeaf = useCallback((id: string) => {
    setExpr(e => removeLeafById(e, id))
  }, [])

  /** Tapping a bracket edge dissolves that group; content stays (concept 6.5). */
  const onDissolveGroup = useCallback((groupId: string) => {
    setExpr(e => {
      const index = e.root.children.findIndex(c => c !== null && c.kind === 'group' && c.id === groupId)
      return index === -1 ? e : withRootChildren(e, dissolveGroup(e.root.children, index))
    })
  }, [])

  // -------------------------------------------------------------- drag/drop
  // Origin (tray vs. already on the board) isn't tagged explicitly for a
  // number or operator — it's derivable from the tree itself: a number's id
  // never changes between tray and board (same NumberLeaf throughout its
  // life), and a tray-origin operator's id is synthetic (`tray-op-+`) and
  // never matches a real placed leaf id. A dragged *block*, though, carries
  // its origin explicitly (`item.data.origin`): a tray-origin block is
  // always the same synthetic `tray-block` id (concept section 4's single,
  // permanent chip — there's no per-occurrence id to derive an origin
  // from), and a field-origin one carries the id of the actual placed
  // Group, which never collides with `tray-block`.

  const onDrop = useCallback((item: GameDropItem, target: GameDropTarget | 'refused' | null) => {
    // Released on the board but on a surface of the other kind (useDrag's
    // `DropOutcome`): the chip bounces back. Only a release clear of the
    // board removes anything — dropping an operator a few px inside a
    // block used to delete it, which is half of what the fourth device
    // round reported as "it removes the operator".
    if (target === 'refused') return
    if (!target) {
      if (item.data.role === 'block' && item.data.origin === 'field') {
        // "aus dem Feld ziehen und loslassen" (concept 6.5's table): the
        // same outcome as tapping the edge — brackets go home, content
        // stays. The one gesture that could have lost more than one chip
        // dissolves instead of removing (concept 6.8).
        setExpr(e => {
          const index = findGroupIndex(e.root.children, item.id)
          return index === -1 ? e : withRootChildren(e, dissolveGroup(e.root.children, index))
        })
        return
      }
      // released outside every zone: remove it, if it was actually on the
      // board — a tray-origin item dropped nowhere just bounces back, and
      // findLocation correctly finds nothing to remove for it.
      setExpr(e => removeLeafById(e, item.id))
      return
    }

    const parsed = parseZoneId(target.zoneId)
    if (!parsed) return

    // ------------------------------------------- released on a block's end
    // The two bracket edges are the block's own ends (Expression.tsx's
    // `blockZoneId`). A chip let go there joins the block on *that* side,
    // whichever side of the block it came from (concept 6.2, PO's fourth
    // device round: "the side of drag-and-drop is important"). A chip
    // already on the board brings its connecting partner along, so nothing
    // is left stranded outside; a chip from the tray brings an open slot
    // for the partner it doesn't have yet, which is how a block is
    // prepared for a third number before that number exists.
    if (parsed.target === 'block') {
      const { groupId, side } = parsed
      setExpr(e => {
        if (item.data.role === 'block') return e // a block never goes inside a block (concept section 4)
        const groupIndex = findGroupIndex(e.root.children, groupId)
        if (groupIndex === -1) return e

        const originLoc = findLocation(e.root.children, item.id)
        if (originLoc) {
          // moving one of a block's own chips to the block's own edge would
          // mean taking it out of the row it isn't in — nothing to absorb.
          if (originLoc.groupId !== null) return e
          const absorbed = absorbPairIntoGroup(e.root.children, groupIndex, originLoc.index, side)
          return absorbed ? withRootChildren(e, absorbed) : e
        }

        const leaf: Leaf | undefined = item.data.role === 'number'
          ? tray.find(n => n.id === item.id)
          : (item.data.operator ? createOperatorLeaf(item.data.operator) : undefined)
        if (!leaf) return e
        const inserted = insertLeafIntoGroup(e.root.children, groupIndex, side, leaf)
        if (!inserted) return e
        const next = withRootChildren(e, inserted)
        return withinBudget(next.root.children, numbers.length) ? next : e
      })
      return
    }

    const surface: Surface = { groupId: parsed.groupId, index: parsed.index, kind: item.kind }

    setExpr(e => {
      if (item.data.role === 'block' && item.data.origin === 'field') {
        // Moving an already-placed block moves the *brackets*, not the
        // content: the row reads exactly as before, with a different part
        // of it enclosed (concept 6.5, revised — PO, fourth device round).
        // `(a×b) + c − d` dropped on `c` is `a×b + (c−d)`; dropped on its
        // own `b` it is `a × (b+c) − d`. The block's own interior is
        // therefore a legitimate target for the block itself — it is where
        // the positions one step to the right live — while another block's
        // interior stays refused, as ever.
        const originIndex = findGroupIndex(e.root.children, item.id)
        if (originIndex === -1) return e
        const group = e.root.children[originIndex] as Group
        const span = group.children.length
        let anchor: number
        if (parsed.target === 'root') {
          anchor = parsed.index <= originIndex ? parsed.index : parsed.index + span - 1
        } else if (parsed.groupId === group.id) {
          anchor = originIndex + parsed.index
        } else {
          return e // another block's interior — a block never goes inside a block
        }
        const moved = moveGroup(e.root.children, originIndex, anchor, 2 * numbers.length - 1)
        return moved ? withRootChildren(e, moved) : e
      }

      if (item.data.role === 'block') {
        if (surface.groupId !== null) return e // a block only ever targets a root position
        if (blocksUsed >= blockBudget) return e // same cap the tray chip disables itself for (concept 4: ⌊n/2⌋)
        const resolved = resolveBlockDrop(e.root.children, surface.index)
        if (!resolved) return e
        return withRootChildren(e, applyBlockDrop(e.root.children, surface.index, resolved))
      }

      const existing = findLeaf(e.root.children, item.id)
      const originLoc = existing ? findLocation(e.root.children, item.id) : null

      // A root-level leaf dropped onto (or into) an adjacent group absorbs
      // the whole connecting (operand, operator) pair into that group in
      // one atomic step (concept 6.2), not just the one leaf that was
      // dragged — see absorbIntoGroup's own note on why moving only half
      // of the pair strands the other half with nothing left to fill it.
      // This has to run before the generic move/swap logic below, which
      // only ever moves the single dragged leaf.
      if (originLoc && originLoc.groupId === null && surface.groupId !== null) {
        const groupIndex = findGroupIndex(e.root.children, surface.groupId)
        const side = groupIndex === -1 ? null : sideOf(originLoc.index, groupIndex)
        if (side) {
          const absorbed = absorbIntoGroup(e.root.children, groupIndex, side)
          if (absorbed) return withRootChildren(e, absorbed)
        }
      }

      if (!target.occupied) {
        // an empty target: place (tray-origin) or move-in-place (board-
        // origin — leave a gap behind, don't delete a paired operator the
        // way removeOperand/removeOperator would; the chip is relocating,
        // not being removed).
        //
        // That gap is only ever safe when there's still a spare chip of
        // the same kind somewhere to eventually fill it — mid-build,
        // there always is (concept 6.6's own worked example: taking a
        // number out of a still-incomplete group). Once the puzzle's
        // budget for that kind is already exactly spent, though (every
        // number placed, or every operator the puzzle allows), the leaf
        // being moved is the *only* thing that could ever fill this exact
        // gap again, and it's the one thing that just left — nothing else
        // could ever complete the expression from there (concept 6.8 only
        // promises every gesture has an inverse, not that every gesture
        // leaves the board completable). Refusing it is the same outcome
        // as any other invalid drop: the chip bounces back.
        if (originLoc && wouldStrandAGap(e, originLoc, item.data.role === 'number' ? 'number' : 'operator', tray, numbers.length)) return e
        const leaf: Leaf | undefined = existing ?? (item.data.role === 'number'
          ? tray.find(n => n.id === item.id)
          : (item.data.operator ? createOperatorLeaf(item.data.operator) : undefined))
        if (!leaf) return e
        let next = placeLeafAt(e, surface, leaf)
        if (originLoc) {
          // clear the old slot without touching its neighbors
          next = originLoc.groupId === null
            ? withRootChildren(next, fillGap(next.root.children, originLoc.index, null))
            : withGroupChildren(next, originLoc.groupId, fillGap(groupAt(next.root.children, originLoc.groupId)!.children, originLoc.index, null))
        }
        return next
      }

      // an occupied same-kind target, dragged in from the tray: replace
      // what's there. The displaced chip isn't lost — a number's tray
      // placeholder simply frees up again (`placedIds` is derived from the
      // tree), and operators are unlimited — so the gesture is the same
      // "swap" seen from the tray's side, with the tray as the other half.
      // Doing nothing here instead was the one drop that could silently
      // fail: releasing a number over a slot that already had one.
      if (!originLoc) {
        const leaf: Leaf | undefined = item.data.role === 'number'
          ? tray.find(n => n.id === item.id)
          : (item.data.operator ? createOperatorLeaf(item.data.operator) : undefined)
        if (!leaf) return e
        if (surface.groupId === null) return withRootChildren(e, fillGap(e.root.children, surface.index, leaf))
        const group = groupAt(e.root.children, surface.groupId)
        return group ? withGroupChildren(e, surface.groupId, fillGap(group.children, surface.index, leaf)) : e
      }

      // both sides on the board: a real swap (concept 3, "Tauschen").
      if (surface.groupId === null && originLoc.groupId === null) {
        return withRootChildren(e, swapSlots(e.root.children, originLoc.index, surface.index))
      }
      if (surface.groupId === originLoc.groupId && surface.groupId !== null) {
        return withGroupChildren(e, surface.groupId, swapSlots(groupAt(e.root.children, surface.groupId)!.children, originLoc.index, surface.index))
      }
      return e // swapping between root and a group's interior isn't a supported gesture (concept 6.5 only describes swapping among root-level operands)
    })
  }, [tray, blocksUsed, blockBudget, numbers.length])

  // ------------------------------------------------------------- submit

  const onSubmit = useCallback(() => {
    if (!submittable) return
    setStatus(result === target ? 'correct' : 'wrong')
  }, [submittable, result, target])

  // -------------------------------------------------------------- hints
  // concept 10.3: a hint press is exactly one of the taps a player could
  // make — the block chip, a specific tray number, or an operator — so
  // applying a hint move reuses the same placement functions those taps
  // already call. core/hints.ts decides *what* the next move is; this only
  // decides how to apply it, the same split as onTapNumber/onTapBlock above.
  const applyHintMove = useCallback((move: HintMove) => {
    if (move.kind === 'block') { placeBlockAt(move.index); return }
    if (move.kind === 'grow') {
      const leaf = tray.find(n => n.id === move.leafId)
      if (leaf) growGroupAt(move.index, leaf)
      return
    }
    if (move.kind === 'number') {
      const leaf = tray.find(n => n.id === move.leafId)
      if (leaf) placeNumber(leaf)
      return
    }
    placeOperator(move.op)
  }, [tray, placeNumber, placeOperator, placeBlockAt, growGroupAt])

  return {
    expr,
    tray,
    trayNumbers,
    scaffoldOperands,
    scaffoldOperators,
    blockDisabled,
    operators: ops,
    operatorsMuted,
    submitEnabled: submittable,
    status,
    result,
    onTapNumber,
    onTapOperator,
    onTapBlock,
    onTapLeaf,
    onDissolveGroup,
    onSubmit,
    onDrop,
    applyHintMove,
  }
}
