// The hint system (concept section 10): a "Restlöser" that answers "is the
// target still reachable from here?" and computes the kanonische
// Fortsetzung (10.2) — the smallest way to finish the puzzle that never
// contradicts what's already built. No React import (CLAUDE.md's rule that
// core/ is pure TypeScript).
//
// "Smallest way to finish" is modelled as the ordered taps a player could
// make to reach it (10.3's "das Spiel setzt einen weiteren Chip"): a
// block-chip tap, a number tap, or an operator tap, each resolved through
// the SAME rules the board itself places by (nextOpenSurface/nextBlockTarget
// in expression.ts — see applyHintMove in useGame.ts, which literally calls
// the placement functions a manual tap would). That constrains a
// hint-introduced block to its two-number minimum shape: growing one past
// that is a drag-only gesture (CLAUDE.md has the full account of why), and
// a hint press is a tap, never a drag.
//
// 10.2's own wording — "die kleinste bezüglich einer festen Ordnung: erst
// nach Anzahl der Blöcke, dann nach Dokumentreihenfolge" — names two
// criteria but not a specific tie-break within them; this file's own choice
// (any consistent order satisfies "eine feste Ordnung") is: candidates are
// generated in a fixed, deterministic recursion order (remaining tray
// leaves tried in tray order, operators tried in a fixed priority), and the
// first candidate found at the minimum block count wins.

import {
  type Expression, type Group, type Leaf, type NumberLeaf, type Operator, type Slot,
  createOperatorLeaf, isExpressionComplete,
} from './expression'
import { evaluate } from './evaluate'

export type HintMove =
  /**
   * A block, at the root position the continuation needs it at. The
   * position is part of the move because a *tap* can't choose one —
   * `nextBlockTarget` always takes the first eligible position — and the
   * continuation's block is frequently somewhere else: `2 × (1+3)` from a
   * board already reading `2 ×` needs it at index 2, and placing it at 0
   * instead wrapped the `2` into `(2) ×` and left a board the hint could
   * never finish. A player reaches that position by dragging the block
   * chip there (concept 6.1), so it is still one gesture, just not the
   * tap-shaped one.
   */
  | { kind: 'block'; index: number }
  | { kind: 'number'; leafId: string }
  | { kind: 'operator'; op: Operator }

export interface Hint {
  /** the taps, in order, that complete the puzzle from here — 10.3's "ein Chip pro Druck". */
  moves: HintMove[]
  /**
   * The two tray numbers to pulse on the hint's first press (10.3): the
   * operands of the continuation's first still-fully-unplaced block, or —
   * "hat sie keinen Block, die ersten beiden benachbarten Operanden" — the
   * continuation's first two numbers, whatever position they land in, when
   * it introduces no new block at all.
   */
  pulseIds: [string, string] | null
}

const OP_PRIORITY: Operator[] = ['+', '-', '*', '/']

function placedSources(children: readonly Slot[]): Set<number> {
  const used = new Set<number>()
  const visit = (list: readonly Slot[]) => {
    for (const slot of list) {
      if (slot === null) continue
      if (slot.kind === 'group') visit(slot.children)
      else if (slot.kind === 'number') used.add(slot.source)
    }
  }
  visit(children)
  return used
}

function countGroups(children: readonly (Leaf | Group | null)[]): number {
  return children.filter(c => c !== null && c.kind === 'group').length
}

// ------------------------------------------------------------ completions
// Every fully-resolved root consistent with `fixed` (concept 10.2's "den
// bereits gebauten Baum fortsetzen"): every already-placed leaf/group stays
// exactly where it is, every open gap — inside an existing group or at
// root, existing or still past the row's current length — gets filled from
// `pool`, and a still-open root operand may also become a brand-new
// two-number block if the puzzle's block budget allows it.

function completeGroup(group: Group, pool: readonly NumberLeaf[], opsAllowed: Operator[]): { group: Group; used: Set<string> }[] {
  function go(index: number, acc: (Leaf | null)[], remaining: readonly NumberLeaf[], used: Set<string>): { group: Group; used: Set<string> }[] {
    if (index === group.children.length) return [{ group: { ...group, children: acc }, used }]
    const existing = group.children[index]
    if (existing !== null) return go(index + 1, [...acc, existing], remaining, used)
    if (index % 2 === 0) {
      const out: { group: Group; used: Set<string> }[] = []
      for (const leaf of remaining) {
        out.push(...go(index + 1, [...acc, leaf], remaining.filter(l => l.id !== leaf.id), new Set(used).add(leaf.id)))
      }
      return out
    }
    const out: { group: Group; used: Set<string> }[] = []
    for (const op of OP_PRIORITY) {
      if (!opsAllowed.includes(op)) continue
      out.push(...go(index + 1, [...acc, createOperatorLeaf(op)], remaining, used))
    }
    return out
  }
  return go(0, [], pool, new Set())
}

function completions(
  fixed: readonly Slot[],
  pool: readonly NumberLeaf[],
  opsAllowed: Operator[],
  blockBudget: number
): (Leaf | Group | null)[][] {
  function go(index: number, acc: (Leaf | Group | null)[], remaining: readonly NumberLeaf[], blocksLeft: number): (Leaf | Group | null)[][] {
    // Done only when there is nothing left to place *and* nothing left of
    // the board to walk past. Without the first condition this stopped at
    // the moment the tray ran out and returned whatever it had built so
    // far, throwing away every position of `fixed` further right: for a
    // board reading `⬚ ÷ 5 + 7` with one 5 in the tray, the only candidate
    // considered was `5` — so a board one tap from solved was reported as
    // a dead end, and so was every *completed* expression, the correct
    // ones included (with an empty tray, the candidate was the first
    // operand alone).
    if (index >= fixed.length && remaining.length === 0 && acc.length > 0 && acc.length % 2 === 1) return [acc.slice()]

    const existing = index < fixed.length ? fixed[index] : undefined

    if (existing !== undefined && existing !== null) {
      if (existing.kind === 'group') {
        const out: (Leaf | Group | null)[][] = []
        for (const { group, used } of completeGroup(existing, remaining, opsAllowed)) {
          out.push(...go(index + 1, [...acc, group], remaining.filter(l => !used.has(l.id)), blocksLeft))
        }
        return out
      }
      return go(index + 1, [...acc, existing], remaining, blocksLeft)
    }

    const out: (Leaf | Group | null)[][] = []
    if (index % 2 === 0) {
      // a bare leaf
      for (const leaf of remaining) {
        out.push(...go(index + 1, [...acc, leaf], remaining.filter(l => l.id !== leaf.id), blocksLeft))
      }
      // a brand-new two-number block (a hint press is a tap — see file banner)
      if (blocksLeft > 0 && remaining.length >= 2) {
        for (const a of remaining) {
          for (const b of remaining) {
            if (a.id === b.id) continue
            for (const op of OP_PRIORITY) {
              if (!opsAllowed.includes(op)) continue
              const group: Group = { id: 'hint-group', kind: 'group', children: [a, createOperatorLeaf(op), b] }
              const rest = remaining.filter(l => l.id !== a.id && l.id !== b.id)
              out.push(...go(index + 1, [...acc, group], rest, blocksLeft - 1))
            }
          }
        }
      }
    } else {
      for (const op of OP_PRIORITY) {
        if (!opsAllowed.includes(op)) continue
        out.push(...go(index + 1, [...acc, createOperatorLeaf(op)], remaining, blocksLeft))
      }
    }
    return out
  }
  return go(0, [], pool, blockBudget)
}

// ---------------------------------------------------------------- diffing
// Turns "the current root" and "a resolved candidate root" into the ordered
// taps that get from one to the other — document order, root index by root
// index, a new group's own children in order (concept 10.3).

function pushLeafMove(moves: HintMove[], leaf: Leaf) {
  moves.push(leaf.kind === 'number' ? { kind: 'number', leafId: leaf.id } : { kind: 'operator', op: leaf.value })
}

function diffMoves(fixed: readonly Slot[], resolved: readonly (Leaf | Group | null)[]): HintMove[] {
  const moves: HintMove[] = []
  for (let i = 0; i < resolved.length; i++) {
    const target = resolved[i]
    if (target === null) continue
    const existing = i < fixed.length ? fixed[i] : null

    if (existing !== null) {
      if (existing.kind === 'group' && target.kind === 'group') {
        for (let j = 0; j < target.children.length; j++) {
          const existingChild = existing.children[j] ?? null
          const targetChild = target.children[j]
          if (existingChild !== null || targetChild === null) continue
          pushLeafMove(moves, targetChild)
        }
      }
      continue // otherwise already fixed at the root — nothing new here
    }

    if (target.kind === 'group') {
      moves.push({ kind: 'block', index: i })
      for (const child of target.children) if (child !== null) pushLeafMove(moves, child)
    } else {
      pushLeafMove(moves, target)
    }
  }
  return moves
}

function findPulseIds(moves: readonly HintMove[]): [string, string] | null {
  const blockIndex = moves.findIndex(m => m.kind === 'block')
  const numbersFrom = (start: number): string[] =>
    moves.slice(start).filter((m): m is { kind: 'number'; leafId: string } => m.kind === 'number').slice(0, 2).map(m => m.leafId)

  const scoped = blockIndex === -1 ? numbersFrom(0) : numbersFrom(blockIndex + 1)
  return scoped.length === 2 ? [scoped[0], scoped[1]] : null
}

/**
 * The current board's hint, or `null` when the target is no longer
 * reachable (concept 10.1/10.2's dead-end case) — the caller decides
 * whether to call this at all (an already-complete expression has nothing
 * left to hint about).
 */
export function computeHint(
  expr: Expression,
  tray: readonly NumberLeaf[],
  target: number,
  opsAllowed: Operator[],
  numbersCount: number
): Hint | null {
  const used = placedSources(expr.root.children)
  const pool = tray.filter(leaf => !used.has(leaf.source))
  const blockBudget = Math.floor(numbersCount / 2) - countGroups(expr.root.children)

  let best: { root: (Leaf | Group | null)[]; blockCount: number } | null = null
  for (const root of completions(expr.root.children, pool, opsAllowed, blockBudget)) {
    const value = evaluate({ root: { id: 'root', kind: 'group', children: root } })
    if (value === null || Math.abs(value - target) > 1e-9) continue
    const blockCount = countGroups(root)
    if (!best || blockCount < best.blockCount) best = { root, blockCount }
  }
  if (!best) return null

  const moves = diffMoves(expr.root.children, best.root)
  return { moves, pulseIds: findPulseIds(moves) }
}

/** Concept 10.1's dead-end check on its own, for callers that don't also need the continuation. */
export function isStuck(expr: Expression, tray: readonly NumberLeaf[], target: number, opsAllowed: Operator[], numbersCount: number): boolean {
  if (isExpressionComplete(expr)) return false
  return computeHint(expr, tray, target, opsAllowed, numbersCount) === null
}
