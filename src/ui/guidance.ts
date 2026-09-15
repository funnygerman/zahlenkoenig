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

import { computeHint, type HintMove } from '../core/hints'
import type { NumberLeaf, Operator, Slot } from '../core/expression'
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

export interface Guidance {
  /** the tray chip to mark — the chip the player is being asked to use. */
  tray: TrayGuide
  /** a drop zone to mark as the destination, for the two moves that have one (a dragged block, a number grown into a bracket); `null` for a plain tap. */
  zone: string | null
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
  /** whether `=` would be accepted right now (concept 9.1's two conditions). */
  submitEnabled: boolean
}

export function nextGuidance({
  plan, children, tray, target, opsAllowed, numbersCount, blockTap, submitEnabled,
}: GuidanceInput): Guidance | null {
  if (plan === null) {
    // A dead end. The border and the blocker marks are the honest answer
    // here, and "press =" would be a lie: a complete board that misses the
    // target is exactly this case.
    return null
  }

  if (plan.length === 0) {
    return submitEnabled ? { tray: { kind: 'submit' }, zone: null, message: 'guideSubmit' } : null
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
      return { tray: { kind: 'block' }, zone: null, message: 'guideBlock' }
    }
    // The tap would land the bracket somewhere that kills the board, so
    // the gesture that names its own position is the only honest one.
    return {
      tray: { kind: 'block' },
      zone: rootZoneId(wantsBlock.index),
      message: 'guideBlockDrag',
    }
  }

  const move = plan[0]
  switch (move.kind) {
    case 'number':
      return { tray: { kind: 'number', id: move.leafId }, zone: null, message: 'guideNumber' }
    case 'operator':
      return { tray: { kind: 'operator', op: move.op }, zone: null, message: 'guideOperator' }
    case 'block':
      // Unreachable in practice — the branch above answers every plan that
      // contains a block — but a `switch` that silently fell through here
      // would be the same class of mistake this file exists to prevent.
      return { tray: { kind: 'block' }, zone: rootZoneId(move.index), message: 'guideBlockDrag' }
    case 'grow': {
      // `growGroupAt` inserts on the 'after' side, so the destination is
      // the right bracket edge — the same end the move itself lands on.
      const slot = children[move.index]
      return {
        tray: { kind: 'number', id: move.leafId },
        zone: slot != null && slot.kind === 'group' ? blockZoneId(slot.id, 'after') : null,
        message: 'guideGrow',
      }
    }
  }
}
