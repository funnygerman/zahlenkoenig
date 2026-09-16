// The first-run introduction's step-by-step guidance (PO, after a report
// that the introduction's boards still leave a newcomer guessing which
// button to press): what to mark on screen, and what to say about it, for
// the one move the player should make next.
//
// Pure, and kept out of Board.tsx, for the reason this round's own bug
// gives: the interesting part is not the rendering but the *choice*, and
// the choice has a failure mode a component test would have to solve a
// puzzle to reach. Here it can be asked directly (guidance.test.ts).
//
// ---------------------------------------------------------------------
// The rule the round was built around, and why it isn't simply
// "`computeHint`'s next move":
//
// A hint *press* applies `moves[0]` through `applyHintMove`, which places a
// block at the index the move names. A **tap** cannot do that: a tapped
// block lands at the player's own anchor (concept 6.1, the block-anchor
// round), which is wherever they last worked. So on `3 ×`, with a plan
// reading `3 × (1+2)`, "tap the block chip" puts the bracket around the
// `3` instead and leaves a board nothing can finish — a dead end reached
// by following the guidance's own advice, measured in a browser the first
// time this was wired up.
//
// Two things follow, and they are the whole of this file's cleverness:
//
//   1. **A bracket goes down first.** Whenever the plan still calls for
//      one, it is offered before any chip that would sit around it —
//      because a tapped block lands at the anchor, and the anchor on an
//      untouched board is the start. That also happens to be the order
//      both bracket cards describe, which is not a coincidence: it is the
//      only order tapping can build.
//   2. **The offer is checked by simulating it.** The tree the tap would
//      produce is run through the same search, and the tap is only offered
//      if the board is still solvable afterwards. Where it isn't, the
//      honest instruction is the drag that names its own position, with
//      the destination marked.
//
// Nothing here spends a hint: the budget is only ever charged by
// `useHint`'s `onPressHint`, and a guided board is walked by the player.
//
// ---------------------------------------------------------------------
// Two things were added when the introduction grew its recovery lessons
// (PO: teach moving a bracket, and taking a wrong chip back):
//
//   3. **A dead end is answered, not met in silence.** This file used to
//      return `null` there, on the reasoning that "press =" is the one
//      thing it must never say. What that missed is that the game already
//      computes the answer and only ever showed it as a colour:
//      `findBlockers` returns the smallest set of placed chips whose
//      removal makes the target reachable again, which is exactly "what
//      should I take back". See `recovery` at the bottom of this file for
//      the two limits on it.
//   4. **A scripted beat outranks the search**, and it is the only thing
//      that does. A mistake cannot be derived — the search will never
//      advise one — so the two boards that teach recovery carry a short
//      script (`core/onboarding.ts`'s `ScriptedBeat`). What keeps that
//      from becoming a second source of truth is that a beat is keyed on
//      the *board it speaks on*, so a player who is anywhere else gets the
//      derived answer, and the one below it is unchanged.

import { computeHint, findBlockers, type HintMove } from '../core/hints'
import { dissolveGroup, moveGroup, type NumberLeaf, type Operator, type Slot } from '../core/expression'
import { blockZoneId, rootZoneId } from './Expression'
import type { TrayGuide } from './Tray'

/** Which line to show. A key rather than a string, so this file stays free of i18n and its tests read as behaviour rather than as copy. */
export type GuideMessage =
  | 'guideNumber'
  | 'guideOperator'
  | 'guideBlock'
  | 'guideBlockDrag'
  | 'guideGrow'
  | 'guideSubmit'
  // The three recovery lines. They are the only ones that speak about a
  // chip already on the board rather than one in the tray, and the only
  // ones that appear on a board the search has given up on.
  | 'guideMoveBlock'
  | 'guideDissolve'
  | 'guideUndo'

export interface Guidance {
  /** the tray chip to mark — the chip the player is being asked to use. `null` for the recovery lines, which point at the board instead. */
  tray: TrayGuide | null
  /** a drop zone to mark as the destination, for the moves that have one (a dragged block, a number grown into a bracket, a bracket moved); `null` for a plain tap. */
  zone: string | null
  /**
   * Placed chips to mark as the thing to act on — `findBlockers`' own
   * answer, carried here rather than computed twice. The line and the mark
   * have to name the same chip, and the surest way to guarantee that is
   * for one call to produce both: the pulse this codebase deleted named the
   * wrong chip in 30.3% of the states it appeared in precisely because it
   * was derived separately from what the press applied.
   */
  marked: readonly string[] | null
  message: GuideMessage
}

export interface GuidanceInput {
  /** `computeHint`'s moves for the current board: `null` on a dead end, empty once the board is built and right. */
  plan: readonly HintMove[] | null
  /** the board's root children — only read to resolve a `grow` move's group id. */
  children: readonly Slot[]
  tray: readonly NumberLeaf[]
  target: number
  opsAllowed: Operator[]
  numbersCount: number
  /** `useGame`'s own preview of a block *tap* — where it would land, and the tree it would produce. */
  blockTap: { index: number; children: Slot[] } | null
  /**
   * A scripted instruction for this exact board, already resolved against
   * the tray (`core/onboarding.ts`'s `ScriptedBeat`, matched in Board.tsx).
   * It wins over everything below, because the two boards that teach
   * recovery have to reach a state the search would never advise.
   */
  scripted: TrayGuide | null
  /** whether `=` would be accepted right now (concept 9.1's two conditions). */
  submitEnabled: boolean
}

export function nextGuidance({
  plan, children, tray, target, opsAllowed, numbersCount, blockTap, submitEnabled, scripted,
}: GuidanceInput): Guidance | null {
  // A scripted beat is the one thing that outranks the search, and it only
  // ever exists for a board the script names by its own notation — see
  // `ScriptedBeat`. Everything below is derived as it always was.
  if (scripted !== null) {
    return { tray: scripted, zone: null, marked: null, message: scriptedMessage(scripted) }
  }

  if (plan === null) {
    return recovery(children, tray, target, opsAllowed, numbersCount)
  }

  if (plan.length === 0) {
    return submitEnabled ? { tray: { kind: 'submit' }, zone: null, marked: null, message: 'guideSubmit' } : null
  }

  // ------------------------------------------------------------- bracket
  // Brought forward past whatever else the plan wanted first — see this
  // file's own header. `blockTap` is null when no bracket fits at all
  // (budget spent, or no room left), in which case there is nothing to
  // offer and the plan's own next move stands.
  const wantsBlock = plan.find((m): m is Extract<HintMove, { kind: 'block' }> => m.kind === 'block')
  if (wantsBlock && blockTap) {
    const afterTap = computeHint(
      { root: { id: 'root', kind: 'group', children: blockTap.children } },
      tray, target, opsAllowed, numbersCount,
    )
    if (afterTap !== null) {
      return { tray: { kind: 'block' }, zone: null, marked: null, message: 'guideBlock' }
    }
    // The tap would land the bracket somewhere that kills the board, so
    // the gesture that names its own position is the only honest one.
    return {
      tray: { kind: 'block' },
      zone: rootZoneId(wantsBlock.index),
      marked: null,
      message: 'guideBlockDrag',
    }
  }

  const move = plan[0]
  switch (move.kind) {
    case 'number':
      return { tray: { kind: 'number', id: move.leafId }, zone: null, marked: null, message: 'guideNumber' }
    case 'operator':
      return { tray: { kind: 'operator', op: move.op }, zone: null, marked: null, message: 'guideOperator' }
    case 'block':
      // Unreachable in practice — the branch above answers every plan that
      // contains a block — but a `switch` that silently fell through here
      // would be the same class of mistake this file exists to prevent.
      return { tray: { kind: 'block' }, zone: rootZoneId(move.index), marked: null, message: 'guideBlockDrag' }
    case 'grow': {
      // `growGroupAt` inserts on the 'after' side, so the destination is
      // the right bracket edge — the same end the move itself lands on.
      const slot = children[move.index]
      return {
        tray: { kind: 'number', id: move.leafId },
        zone: slot != null && slot.kind === 'group' ? blockZoneId(slot.id, 'after') : null,
        marked: null,
        message: 'guideGrow',
      }
    }
  }
}

function scriptedMessage(guide: TrayGuide): GuideMessage {
  switch (guide.kind) {
    case 'number': return 'guideNumber'
    case 'operator': return 'guideOperator'
    case 'block': return 'guideBlock'
    case 'submit': return 'guideSubmit'
  }
}

// ------------------------------------------------------------------ recovery
// What to say on a board the search has given up on.
//
// This used to be "nothing", and the reasoning was sound as far as it went:
// a complete-but-wrong board looks like "no move left" from here, and
// "press =" is the one piece of advice the guidance must never give. What
// it missed is that the game *already computes the answer* and only ever
// showed it as a colour. `findBlockers` returns the smallest set of placed
// chips whose removal makes the target reachable again — which is exactly
// "what should I take back" — and the dead-end border and its marks have
// been drawing that set without a word beside it.
//
// Two deliberate limits:
//
//   - **Exactly one chip, or nothing.** Where several chips share the
//     blame there is no short true sentence to write, and the marks
//     already say what the marks say. Where *none* is to blame —
//     `findBlockers` returns empty when the empty field could not reach
//     the target either — there is nothing to undo at all.
//   - **A bracket is offered as a move before a removal.** Taking it back
//     and putting it down again is two gestures where dragging it is one,
//     and the second gesture would be the same tap that put it in the
//     wrong place to begin with (a tapped block lands at the anchor). The
//     offer is checked by simulating it, the same way the block tap above
//     is: the bracket is only called movable if the board the move
//     produces is one the search can finish.

function asExpression(children: readonly Slot[]) {
  return { root: { id: 'root' as const, kind: 'group' as const, children: children.slice() } }
}

function recovery(
  children: readonly Slot[],
  tray: readonly NumberLeaf[],
  target: number,
  opsAllowed: Operator[],
  numbersCount: number,
): Guidance | null {
  const blockers = findBlockers(asExpression(children), tray, target, opsAllowed, numbersCount)
  if (blockers.length !== 1) return null

  const id = blockers[0]
  const index = children.findIndex(c => c !== null && c.id === id)
  const slot = index === -1 ? null : children[index]

  if (slot !== null && slot.kind === 'group') {
    const to = destinationFor(children, index, tray, target, opsAllowed, numbersCount)
    if (to !== null) {
      return { tray: null, zone: rootZoneId(to), marked: [id], message: 'guideMoveBlock' }
    }
    return { tray: null, zone: null, marked: [id], message: 'guideDissolve' }
  }

  // A leaf, at the root or inside a bracket — `marked` works by id either
  // way, and tapping it is the same gesture wherever it sits (concept 6.6).
  return { tray: null, zone: null, marked: [id], message: 'guideUndo' }
}

/**
 * Where the bracket at `groupIndex` belongs, or `null` if moving it is not
 * the fix. Asked in three steps, all of them with functions the game
 * itself uses: take the brackets off and ask the search where it would put
 * a bracket on what is left; make that move for real with `moveGroup`; and
 * only offer it if the board that comes out is one the search can finish.
 */
function destinationFor(
  children: readonly Slot[],
  groupIndex: number,
  tray: readonly NumberLeaf[],
  target: number,
  opsAllowed: Operator[],
  numbersCount: number,
): number | null {
  const plan = computeHint(asExpression(dissolveGroup(children, groupIndex)), tray, target, opsAllowed, numbersCount)
  const wanted = plan?.moves.find((m): m is Extract<HintMove, { kind: 'block' }> => m.kind === 'block')
  if (!wanted) return null

  // The same cap `useGame`'s own drop handler passes: 2n−1 positions is
  // everything an n-number puzzle can hold (concept 6.4).
  const moved = moveGroup(children, groupIndex, wanted.index, 2 * numbersCount - 1)
  if (moved === null) return null
  if (computeHint(asExpression(moved), tray, target, opsAllowed, numbersCount) === null) return null
  return wanted.index
}
