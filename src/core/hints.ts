// The hint system (concept section 10): a "Restlöser" that answers "is the
// target still reachable from here?" and computes the kanonische
// Fortsetzung (10.2) — the smallest way to finish the puzzle that never
// contradicts what's already built. No React import (CLAUDE.md's rule that
// core/ is pure TypeScript).
//
// "Smallest way to finish" is modelled as the ordered *gestures* a player
// could make to reach it (10.3's "das Spiel setzt einen weiteren Chip"),
// each resolved through the SAME rules the board itself places by — see
// `applyHintMove` in useGame.ts, which literally calls the placement
// functions a manual tap or drop would.
//
// That used to mean taps only, and it cost more than anyone had checked.
// A tap cannot grow a group past two numbers (concept 6.2), so the search
// could not propose a three-number group — and
// `scripts/checkHintReachable.ts` measured the consequence: on **39.8% of
// four-number draws** every solution needed one, so the hint had nothing
// to say at all, and the board opened outlined as a dead end. The
// three-number-group round added `HintMove`'s `grow` kind for exactly that
// gesture (a tray chip dragged onto a bracket edge), which is why a move
// here is a gesture rather than a tap. After it, the search reaches
// everything `solver.ts`'s `reachable()` does at two, three and four
// numbers — 0 walled boards over 5900 real draws.
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
  /**
   * A third number dragged onto the **right bracket edge** of the group at
   * root position `index` — concept 6.2's "grow past the minimum shape",
   * the one gesture in the game that tapping structurally cannot perform.
   *
   * This is the move that exists so the hint can propose three-number
   * groups at all. Without it `completions` could only ever reach the
   * shapes a tap builds, and `scripts/checkHintReachable.ts` measured what
   * that cost: on **39.8% of four-number draws** the hint had nothing to
   * say, because every solution needed a group of three.
   *
   * It carries its position for the same reason `block` does — a drag
   * chooses where it lands and a tap cannot — and it is applied through
   * `insertLeafIntoGroup`, exactly the call `useGame`'s own drop handler
   * makes for a tray chip released on a bracket edge. That leaves an open
   * operator slot beside the new number (`withPair` splices in a null
   * partner), which the following `operator` move fills: one chip per
   * press, as concept 10.3 requires, and both of them gestures the player
   * has.
   */
  | { kind: 'grow'; index: number; leafId: string }
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
        const left = remaining.filter(l => !filling.used.has(l.id))
        out.push(...go(index + 1, [...acc, filling.group], [...moves, ...filling.moves], left, blocksLeft))

        // …and the same group grown by one more number (concept 6.2).
        //
        // This branch is not an optimisation, it is what makes the whole
        // three-number-group plan survive its own first press. `useHint`
        // recomputes from scratch on every press and applies `moves[0]`, so
        // a plan that starts "put a block at position 2" is re-derived one
        // press later against a board that now *holds* that block — and
        // without this, the search could only fill the two slots it found
        // and never reach the third. Measured directly: the plan for
        // `[1,1,1,3] → 9` used to die after three presses at `3 × ()`, with
        // the hint reporting a dead end on a board it had just built
        // itself.
        //
        // Only a pair-shaped group grows, and only by one pair: that is the
        // largest a four-number puzzle can use, and `grow`'s own note
        // explains why the number must come from the tray.
        if (filling.group.children.length !== 3) continue
        for (const tail of left) {
          for (const op of OP_PRIORITY) {
            if (!opsAllowed.includes(op)) continue
            const grown: Group = { ...filling.group, children: [...filling.group.children, createOperatorLeaf(op), tail] }
            const next = [
              ...moves,
              ...filling.moves,
              { kind: 'grow', index: acc.length, leafId: tail.id } as HintMove,
              { kind: 'operator', op } as HintMove,
            ]
            out.push(...go(index + 1, [...acc, grown], next, left.filter(l => l.id !== tail.id), blocksLeft))
          }
        }
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
            // (b2) the same bracket grown to a *third* number, covering two
            // positions more. Built on top of the pair rather than beside
            // it, because that is how a player builds one: wrap two, then
            // drag the third onto a bracket edge (concept 6.2). The `grow`
            // move is that drag; the operator that follows fills the slot
            // it opened.
            //
            // Both extra positions have to be untouched, and the third
            // number has to still be in the tray — `insertLeafIntoGroup`
            // takes a chip from the tray, and a chip already at root would
            // need the other gesture (`absorbPairIntoGroup`) and its own
            // move kind. Left out on purpose: the boards this is for are
            // overwhelmingly empty ones (a hint's budget is read from an
            // empty field), and one new move kind is enough risk for one
            // round.
            const fourth = at(index + 3)
            const fifth = at(index + 4)
            if (blocksLeft > 0 && (fourth === undefined || fourth === null) && (fifth === undefined || fifth === null)) {
              for (const tail of z.rest) {
                for (const op2 of OP_PRIORITY) {
                  if (!opsAllowed.includes(op2)) continue
                  const grown: Group = {
                    id: 'hint-group',
                    kind: 'group',
                    children: [a.leaf, m.leaf, z.leaf, createOperatorLeaf(op2), tail],
                  }
                  const coreFills = [a.move, m.move, z.move].filter((x): x is HintMove => x !== null)
                  const blockMove = { kind: 'block', index: acc.length } as HintMove
                  // Same rule as the pair below: a bracket over positions
                  // nobody has touched is placed first and filled inside,
                  // one over chips already down has to come last.
                  const core = coreFills.length < 3
                    ? [...coreFills, blockMove]
                    : [blockMove, ...coreFills]
                  const next = [
                    ...moves,
                    ...core,
                    { kind: 'grow', index: acc.length, leafId: tail.id } as HintMove,
                    { kind: 'operator', op: op2 } as HintMove,
                  ]
                  out.push(...go(index + 5, [...acc, grown], next, z.rest.filter(l => l.id !== tail.id), blocksLeft - 1))
                }
              }
            }

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

  // 10.2's order — "erst nach Anzahl der Blöcke" — is searched rather than
  // filtered for: ask for a completion using no new bracket at all, then
  // one, and so on, and take the first budget that answers. The result is
  // identical to enumerating everything and keeping the minimum (within a
  // budget the first candidate still wins, so the document-order tie-break
  // is unchanged), and it is what keeps the search affordable now that a
  // bracket can hold three numbers.
  //
  // It matters because a puzzle solvable with fewer brackets exits before
  // the expensive branches are ever built. Measured against real
  // `nextPuzzle` draws (four numbers, all four operators, empty board),
  // which is what `useHint` actually runs this on:
  //
  //   ~30ms  before three-number groups existed
  //    70ms  with them, enumerating everything and filtering
  //   ~20ms  with them, searching budget by budget
  //
  // So the wider search ended up cheaper than the narrow one it replaced.
  // The one case that is slower is a board no budget can complete — every
  // budget is exhausted in turn, ~48ms — and that is the dead-end path,
  // which is rarer and was already the expensive one. `useHint` runs this
  // in a memo on every board change, so these figures are felt directly.
  for (let k = 0; k <= blockBudget; k++) {
    for (const candidate of completions(expr.root.children, pool, opsAllowed, k)) {
      const value = evaluate({ root: { id: 'root', kind: 'group', children: candidate.root } })
      if (value === null || Math.abs(value - target) > 1e-9) continue
      return { moves: candidate.moves }
    }
  }
  return null
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
