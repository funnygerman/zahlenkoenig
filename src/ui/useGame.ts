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
  createExpression, createTray, createOperatorLeaf, createEmptyGroup,
  insertOperand, fillGap, swapSlots, removeOperand, removeOperator,
  wrapGroup, dissolveGroup, nextOpenSurface, resolveBlockDrop, isExpressionComplete,
  type Expression as ExpressionTree, type Leaf, type Group, type Slot, type Surface, type Operator,
} from '../core/expression'
import { evaluate } from '../core/evaluate'
import type { TrayNumberSlot, TrayBlockSlot } from './Tray'
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

// ------------------------------------------------------------- tree edits
// Each takes the current tree and returns a new one — same pure-update
// style as core/expression.ts's own operations, one level up (these know
// about *root vs. inside a specific group*, which the four operations
// themselves don't).

function withRootChildren(expr: ExpressionTree, children: Slot[]): ExpressionTree {
  return { root: { ...expr.root, children } }
}

function withGroupChildren(expr: ExpressionTree, groupId: string, groupChildren: (Leaf | null)[]): ExpressionTree {
  return withRootChildren(expr, expr.root.children.map(c => (c !== null && c.kind === 'group' && c.id === groupId ? { ...c, children: groupChildren } : c)))
}

/** Places a leaf at an already-located open surface (concept 3.1) — insert at the frontier, fillGap anywhere else (an existing null). Tap never grows a group (concept 6.2's growth is drag-only), so a group target is always a fillGap. */
function placeLeafAt(expr: ExpressionTree, surface: Surface, leaf: Leaf): ExpressionTree {
  if (surface.groupId === null) {
    const children = expr.root.children
    const next = surface.index === children.length ? insertOperand(children, surface.index, leaf) : fillGap(children, surface.index, leaf)
    return withRootChildren(expr, next)
  }
  const group = groupAt(expr.root.children, surface.groupId)
  if (!group) return expr
  const next = surface.index === group.children.length ? insertOperand(group.children, surface.index, leaf) : fillGap(group.children, surface.index, leaf)
  return withGroupChildren(expr, surface.groupId, next)
}

/** A block only ever targets a root-level operand surface — a group can't contain another group (concept section 4). */
function placeGroupAt(expr: ExpressionTree, surface: Surface, group: Group): ExpressionTree {
  const children = expr.root.children
  const next = surface.index === children.length ? insertOperand(children, surface.index, group) : fillGap(children, surface.index, group)
  return withRootChildren(expr, next)
}

/** Removes the leaf with this id from wherever it is — a number takes its adjacent operator with it, an operator just leaves a gap (concept 3). */
function removeLeafById(expr: ExpressionTree, id: string): ExpressionTree {
  const loc = findLocation(expr.root.children, id)
  if (!loc) return expr
  const isOperand = loc.index % 2 === 0
  if (loc.groupId === null) {
    const next = isOperand ? removeOperand(expr.root.children, loc.index) : removeOperator(expr.root.children, loc.index)
    return withRootChildren(expr, next)
  }
  const group = groupAt(expr.root.children, loc.groupId)
  if (!group) return expr
  const next = isOperand ? removeOperand(group.children, loc.index) : removeOperator(group.children, loc.index)
  return withGroupChildren(expr, loc.groupId, next)
}

export function useGame({ numbers, target, ops }: UseGameOptions) {
  const tray = useMemo(() => createTray(numbers), [numbers])
  const blockBudget = Math.floor(numbers.length / 2)

  const [expr, setExpr] = useState<ExpressionTree>(createExpression)
  const [status, setStatus] = useState<GameStatus>('idle')

  const placedIds = useMemo(() => collectPlacedIds(expr.root.children), [expr])
  const blocksUsed = useMemo(() => countGroups(expr.root.children), [expr])
  const complete = useMemo(() => isExpressionComplete(expr), [expr])
  const result = useMemo(() => (complete ? evaluate(expr) : null), [expr, complete])

  const trayNumbers: TrayNumberSlot[] = useMemo(
    () => tray.map(leaf => ({ id: leaf.id, value: leaf.value, used: placedIds.has(leaf.id) })),
    [tray, placedIds]
  )
  const blockSlots: TrayBlockSlot[] = useMemo(
    () => Array.from({ length: blockBudget }, (_, i) => ({ id: `block-${i}`, used: i < blocksUsed })),
    [blockBudget, blocksUsed]
  )

  // ------------------------------------------------------------- placing

  const placeNumber = useCallback((leaf: Leaf) => {
    setExpr(e => {
      const surface = nextOpenSurface(e, 'operand')
      return surface ? placeLeafAt(e, surface, leaf) : e
    })
  }, [])

  const placeOperator = useCallback((op: Operator) => {
    setExpr(e => {
      const surface = nextOpenSurface(e, 'operator')
      return surface ? placeLeafAt(e, surface, createOperatorLeaf(op)) : e
    })
  }, [])

  const placeBlock = useCallback(() => {
    setExpr(e => {
      const surface = nextOpenSurface(e, 'operand')
      // Tap always resolves to a bare empty group — concept 6.1's
      // wrap-existing-content behavior needs an *occupied* target, which
      // nextOpenSurface (by definition) never returns.
      return surface ? placeGroupAt(e, surface, createEmptyGroup()) : e
    })
  }, [])

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
  // Origin (tray vs. already on the board) isn't tagged explicitly — it's
  // derivable from the tree itself: a number's id never changes between
  // tray and board (same NumberLeaf throughout its life), and a tray-origin
  // operator/block's id is synthetic (`tray-op-+`, `block-0`) and never
  // matches a real placed leaf/group id. So "not found in the tree" *is*
  // "still in the tray" — one fact instead of two that could disagree.
  //
  // Not implemented in this pass: dragging an entire placed *group* to
  // swap/relocate it (concept 6.5 allows it — "ein Block ist ein Operand"
  // — but Expression.tsx doesn't wire drag onto a group as a whole yet,
  // only onto its individual leaf children and its bracket edges).

  const onDrop = useCallback((item: GameDropItem, target: GameDropTarget | null) => {
    if (!target) {
      // released outside every zone: remove it, if it was actually on the
      // board — a tray-origin item dropped nowhere just bounces back, and
      // findLocation correctly finds nothing to remove for it.
      setExpr(e => removeLeafById(e, item.id))
      return
    }

    const parsed = parseZoneId(target.zoneId)
    if (!parsed) return
    const surface: Surface = { groupId: parsed.groupId, index: parsed.index, kind: item.kind }

    setExpr(e => {
      if (item.data.role === 'block') {
        if (surface.groupId !== null) return e // a block only ever targets a root position
        const resolved = resolveBlockDrop(e.root.children, surface.index)
        if (!resolved) return e
        if (resolved.kind === 'empty') return placeGroupAt(e, surface, createEmptyGroup())
        return withRootChildren(e, wrapGroup(e.root.children, resolved.start, resolved.span))
      }

      const existing = findLeaf(e.root.children, item.id)
      const originLoc = existing ? findLocation(e.root.children, item.id) : null

      if (!target.occupied) {
        // an empty target: place (tray-origin) or move-in-place (board-
        // origin — leave a gap behind, don't delete a paired operator the
        // way removeOperand/removeOperator would; the chip is relocating,
        // not being removed).
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

      // an occupied same-kind target: swap. Only meaningful for a chip
      // already on the board — a tray-origin item has no "other side" to
      // receive what it displaces, so it's a no-op rather than guessing.
      if (!originLoc) return e
      if (surface.groupId === null && originLoc.groupId === null) {
        return withRootChildren(e, swapSlots(e.root.children, originLoc.index, surface.index))
      }
      if (surface.groupId === originLoc.groupId && surface.groupId !== null) {
        return withGroupChildren(e, surface.groupId, swapSlots(groupAt(e.root.children, surface.groupId)!.children, originLoc.index, surface.index))
      }
      return e // swapping between root and a group's interior isn't a supported gesture (concept 6.5 only describes swapping among root-level operands)
    })
  }, [tray])

  // ------------------------------------------------------------- submit

  const onSubmit = useCallback(() => {
    if (!complete) return
    setStatus(result === target ? 'correct' : 'wrong')
  }, [complete, result, target])

  return {
    expr,
    trayNumbers,
    blockSlots,
    operators: ops,
    submitEnabled: complete,
    status,
    result,
    onTapNumber,
    onTapOperator,
    onTapBlock,
    onTapLeaf,
    onDissolveGroup,
    onSubmit,
    onDrop,
  }
}
