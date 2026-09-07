// Drives the hint button (concept 10.3) on top of core/hints.ts's pure
// Restlöser: tracks how many times the button has been pressed for this
// puzzle (0 — nothing shown yet), and turns that into what the board should
// display. Recomputing the hint fresh on every press (rather than indexing
// into a plan captured once) means a player who places a chip by hand
// between two hint presses still gets the right next move — the plan is
// never stale, because there never is a stored plan, only "the hint for the
// board as it is right now".

import { useCallback, useMemo, useState } from 'react'
import { computeHint, type HintMove } from '../core/hints'
import type { Expression, NumberLeaf, Operator } from '../core/expression'

export interface UseHintOptions {
  expr: Expression
  tray: readonly NumberLeaf[]
  target: number
  opsAllowed: Operator[]
  numbersCount: number
  onApplyMove: (move: HintMove) => void
}

export function useHint({ expr, tray, target, opsAllowed, numbersCount, onApplyMove }: UseHintOptions) {
  const [pressCount, setPressCount] = useState(0)

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

  const onPressHint = useCallback(() => {
    if (!hint) return
    const next = pressCount + 1
    // 1st press: pulse only. Every press after that places one more chip
    // (concept 10.3) — always `moves[0]` of a freshly recomputed hint, so
    // this is correct however the board got here.
    if (next > 1 && hint.moves.length > 0) onApplyMove(hint.moves[0])
    setPressCount(next)
  }, [hint, pressCount, onApplyMove])

  const pulseIds = pressCount === 1 ? hint?.pulseIds ?? null : null

  return { deadEnd, pulseIds, onPressHint }
}
