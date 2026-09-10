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
  createOperatorLeaf, dissolveGroup, isExpressionComplete, trimTrailingGaps,
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
// bereits gebauten Baum fortsetzen"), together with the taps that get from
// one to the other: every already-placed leaf/group keeps its position and
// its order, every open gap — inside an existing group or at root, existing
// or still past the row's current length — gets filled from `pool`, and the
// puzzle's block budget may buy a bracket.
//
// The moves are built here rather than diffed back out of the finished
// candidate afterwards. They used to be diffed (`diffMoves`), which worked
// only while every resolved position lined up one-to-one with a position of
// `fixed` — and a bracket that *encloses* already-placed chips consumes
// three of them for one resolved position, so the two rows stop lining up
// the moment that is allowed. Building the moves as the row is built can't
// drift out of alignment, because the alignment is never re-derived.

interface GroupFilling {
  group: Group
  used: Set<string>
  moves: HintMove[]
}

function completeGroup(group: Group, pool: readonly NumberLeaf[], opsAllowed: Operator[]): GroupFilling[] {
  function go(index: number, acc: (Leaf | null)[], remaining: readonly NumberLeaf[], used: Set<string>, moves: HintMove[]): GroupFilling[] {
    if (index === group.children.length) return [{ group: { ...group, children: acc }, used, moves }]
    const existing = group.children[index]
    if (existing !== null) return go(index + 1, [...acc, existing], remaining, used, moves)
    if (index % 2 === 0) {
      const out: GroupFilling[] = []
      for (const leaf of remaining) {
        out.push(...go(index + 1, [...acc, leaf], remaining.filter(l => l.id !== leaf.id), new Set(used).add(leaf.id), [...moves, { kind: 'number', leafId: leaf.id }]))
      }
      return out
    }
    const out: GroupFilling[] = []
    for (const op of OP_PRIORITY) {
      if (!opsAllowed.includes(op)) continue
      out.push(...go(index + 1, [...acc, createOperatorLeaf(op)], remaining, used, [...moves, { kind: 'operator', op }]))
    }
    return out
  }
  return go(0, [], pool, new Set(), [])
}

interface Candidate {
  root: (Leaf | Group | null)[]
  moves: HintMove[]
}

/** A position of `fixed` that a new bracket may enclose: open, or holding a plain leaf. A group can't contain a group (concept section 4). */
function enclosable(slot: Slot | undefined): boolean {
  return slot === undefined || slot === null || slot.kind !== 'group'
}

function completions(
  fixed: readonly Slot[],
  pool: readonly NumberLeaf[],
  opsAllowed: Operator[],
  blockBudget: number
): Candidate[] {
  const at = (i: number): Slot | undefined => (i < fixed.length ? fixed[i] : undefined)

  function go(index: number, acc: (Leaf | Group | null)[], moves: HintMove[], remaining: readonly NumberLeaf[], blocksLeft: number): Candidate[] {
    // Done only when there is nothing left to place *and* nothing left of
    // the board to walk past. Without the first condition this stopped at
    // the moment the tray ran out and returned whatever it had built so
    // far, throwing away every position of `fixed` further right: for a
    // board reading `⬚ ÷ 5 + 7` with one 5 in the tray, the only candidate
    // considered was `5` — so a board one tap from solved was reported as
    // a dead end, and so was every *completed* expression, the correct
    // ones included (with an empty tray, the candidate was the first
    // operand alone).
    if (index >= fixed.length && remaining.length === 0 && acc.length > 0 && acc.length % 2 === 1) return [{ root: acc.slice(), moves }]

    const existing = at(index)
    const out: Candidate[] = []

    if (index % 2 === 1) {
      if (existing !== undefined && existing !== null) return go(index + 1, [...acc, existing], moves, remaining, blocksLeft)
      for (const op of OP_PRIORITY) {
        if (!opsAllowed.includes(op)) continue
        out.push(...go(index + 1, [...acc, createOperatorLeaf(op)], [...moves, { kind: 'operator', op }], remaining, blocksLeft))
      }
      return out
    }

    if (existing !== undefined && existing !== null && existing.kind === 'group') {
      for (const filling of completeGroup(existing, remaining, opsAllowed)) {
        out.push(...go(index + 1, [...acc, filling.group], [...moves, ...filling.moves], remaining.filter(l => !filling.used.has(l.id)), blocksLeft))
      }
      return out
    }

    // (a) a bare operand at this position
    if (existing !== undefined && existing !== null) {
      out.push(...go(index + 1, [...acc, existing], moves, remaining, blocksLeft))
    } else {
      for (const leaf of remaining) {
        out.push(...go(index + 1, [...acc, leaf], [...moves, { kind: 'number', leafId: leaf.id }], remaining.filter(l => l.id !== leaf.id), blocksLeft))
      }
    }

    // (b) a two-number block covering this position and the next two —
    // whatever is already sitting in them included. This is the wrap a
    // tapped or dragged block chip performs (`resolveBlockDrop`'s `wrap`,
    // span 3), and leaving it out was a real bug: a player who put `9 −`
    // down on the way to `(9 − 2) × 4 × 2` was told the target had become
    // unreachable, because the only bracket the search could imagine was
    // one over positions nobody had touched yet.
    //
    // A hint-introduced block stays a *pair*: the group is always these
    // three positions, never grown past them (growing one is drag-only —
    // see this file's banner).
    const second = at(index + 1)
    const third = at(index + 2)
    if (blocksLeft > 0 && enclosable(existing) && enclosable(third) && (second === undefined || second === null || second.kind === 'operator')) {
      // The chips the bracket will hold: each either already placed (no tap
      // needed) or drawn from the tray. The taps come *before* the block
      // move, because wrapping is what a block chip does to chips that are
      // already there — `resolveBlockDrop` only reports `wrap, span 3` once
      // both operands are real leaves.
      const firsts = existing !== undefined && existing !== null
        ? [{ leaf: existing as Leaf, move: null as HintMove | null, rest: remaining }]
        : remaining.map(leaf => ({ leaf: leaf as Leaf, move: { kind: 'number', leafId: leaf.id } as HintMove | null, rest: remaining.filter(l => l.id !== leaf.id) }))

      for (const a of firsts) {
        const middles = second !== undefined && second !== null
          ? [{ leaf: second as Leaf, move: null as HintMove | null }]
          : OP_PRIORITY.filter(op => opsAllowed.includes(op)).map(op => ({ leaf: createOperatorLeaf(op) as Leaf, move: { kind: 'operator', op } as HintMove | null }))

        for (const m of middles) {
          const lasts = third !== undefined && third !== null
            ? [{ leaf: third as Leaf, move: null as HintMove | null, rest: a.rest }]
            : a.rest.map(leaf => ({ leaf: leaf as Leaf, move: { kind: 'number', leafId: leaf.id } as HintMove | null, rest: a.rest.filter(l => l.id !== leaf.id) }))

          for (const z of lasts) {
            const group: Group = { id: 'hint-group', kind: 'group', children: [a.leaf, m.leaf, z.leaf] }
            const fills = [a.move, m.move, z.move].filter((x): x is HintMove => x !== null)
            // `acc.length` is this group's own root index once every
            // position before it is settled — which is exactly when a block
            // move can be the one the caller applies (`useHint` only ever
            // applies `moves[0]`, recomputing everything after it).
            const block = { kind: 'block', index: acc.length } as HintMove
            // Which comes first is decided by what is already on the board.
            // A bracket over three *empty* positions is placed first and
            // filled afterwards — `resolveBlockDrop` reads an open position
            // as `empty` and drops a blank block there, and going the other
            // way would leave the player looking at a complete, wrong row
            // for one press before the bracket arrives. A bracket over
            // chips that are already down has to come last instead: `wrap`
            // is only reported once both operands are real leaves.
            const wrapsSomething = fills.length < 3
            const next = wrapsSomething ? [...moves, ...fills, block] : [...moves, block, ...fills]
            out.push(...go(index + 3, [...acc, group], next, z.rest, blocksLeft - 1))
          }
        }
      }
    }

    return out
  }

  return go(0, [], [], pool, blockBudget)
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

  let best: { moves: HintMove[]; blockCount: number } | null = null
  for (const candidate of completions(expr.root.children, pool, opsAllowed, blockBudget)) {
    const value = evaluate({ root: { id: 'root', kind: 'group', children: candidate.root } })
    if (value === null || Math.abs(value - target) > 1e-9) continue
    const blockCount = countGroups(candidate.root)
    if (!best || blockCount < best.blockCount) best = { moves: candidate.moves, blockCount }
  }
  if (!best) return null

  return { moves: best.moves }
}

/** Concept 10.1's dead-end check on its own, for callers that don't also need the continuation. */
export function isStuck(expr: Expression, tray: readonly NumberLeaf[], target: number, opsAllowed: Operator[], numbersCount: number): boolean {
  if (isExpressionComplete(expr)) return false
  return computeHint(expr, tray, target, opsAllowed, numbersCount) === null
}

// --------------------------------------------------------------- blockers
// What to mark when the board can no longer reach the target (PO decision,
// hint round: a hint press on a dead-end board marks the chips in the way
// rather than taking them back — "nur die falschen Chips markieren", never
// touch what the player built).
//
// "The chips in the way" is defined the only way that can't be argued
// with: the *smallest* set of already-placed chips whose removal makes the
// target reachable again. A block counts as one chip in that set (marking
// it means marking its brackets — dissolving it is the gesture that
// removes it), exactly as a number or an operator does.

/**
 * Every chip on the board, in document order — a block counts as one of
 * them alongside the leaves inside it, since it is one thing a player can
 * take back (by dissolving it) and one thing that can be what's wrong.
 */
function placedIds(children: readonly Slot[]): string[] {
  const ids: string[] = []
  for (const slot of children) {
    if (slot === null) continue
    ids.push(slot.id)
    if (slot.kind === 'group') for (const child of slot.children) if (child !== null) ids.push(child.id)
  }
  return ids
}

/**
 * The board without that one chip — by id rather than by position, so a
 * sequence of removals composes: dissolving a block moves its contents up
 * to the root, and a leaf removed after that is found there instead.
 * Removing a block means dissolving it (its contents stay, exactly as
 * concept 6.5 has it); removing a leaf leaves its position open for the
 * Restlöser to try refilling.
 */
function withoutId(children: readonly Slot[], id: string): Slot[] {
  const index = children.findIndex(slot => slot !== null && slot.id === id)
  if (index !== -1) {
    const slot = children[index]!
    if (slot.kind === 'group') return trimTrailingGaps(dissolveGroup(children, index))
    return trimTrailingGaps(children.map((s, i) => (i === index ? null : s)))
  }
  return children.map(slot => (slot === null || slot.kind !== 'group' ? slot : {
    ...slot,
    children: slot.children.map(child => (child !== null && child.id === id ? null : child)),
  }))
}

/**
 * How deep the search goes before it gives up and calls the whole board
 * blocked. Three removals is already far past what a player builds into a
 * dead end in practice, and the cost is a `computeHint` per subset.
 */
const MAX_BLOCKER_SET = 3

/**
 * The placed chips standing between this board and the target — empty both
 * when the target is still reachable (nothing is in the way) and when the
 * board is beside the point because the *puzzle* can't be reached from an
 * empty field either: nothing the player placed is to blame there, and
 * marking their chips would say something untrue. When something is to
 * blame but no set of up to `MAX_BLOCKER_SET` removals rescues the board,
 * the answer is every placed chip — honest, if unhelpful: nothing short of
 * taking it apart will do.
 *
 * Ties are broken toward *later* chips: of two equally small sets, the one
 * further right wins, because a player's own most recent move is the one
 * they can still picture making.
 */
export function findBlockers(
  expr: Expression,
  tray: readonly NumberLeaf[],
  target: number,
  opsAllowed: Operator[],
  numbersCount: number
): string[] {
  if (computeHint(expr, tray, target, opsAllowed, numbersCount) !== null) return []

  // reversed, so that combinations generated in index order come out
  // preferring the chips furthest to the right
  const ids = placedIds(expr.root.children).reverse()

  const rescues = (subset: readonly string[]): boolean => {
    let children: Slot[] = expr.root.children.slice()
    for (const id of subset) children = withoutId(children, id)
    return computeHint({ root: { ...expr.root, children } }, tray, target, opsAllowed, numbersCount) !== null
  }

  // Nothing the player placed is to blame if the empty field doesn't reach
  // the target either — the dead-end border already says the puzzle is
  // over, and marking their chips on top of it would be saying something
  // untrue about them.
  if (!rescues(ids)) return []

  for (let size = 1; size <= Math.min(MAX_BLOCKER_SET, ids.length); size++) {
    const pick = (start: number, acc: string[]): string[] | null => {
      if (acc.length === size) return rescues(acc) ? acc : null
      for (let i = start; i < ids.length; i++) {
        const found = pick(i + 1, [...acc, ids[i]])
        if (found) return found
      }
      return null
    }
    const found = pick(0, [])
    if (found) return found
  }

  return ids
}
