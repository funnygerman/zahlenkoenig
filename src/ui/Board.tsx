// The playable board itself: wires useGame (state), useDrag (gestures),
// Tray and Expression (rendering) together for one puzzle. Split out of
// what used to be Game.tsx (v2 step 2) once step 3 needed Game.tsx to own
// something bigger — settings, generation, the header — while this part
// stays exactly what it was: a fixed puzzle, played. Game.test.tsx's own
// interaction tests import this directly for that reason: they exercise
// tap/drag wiring against a known, fixed puzzle and don't need (or want)
// a random one from the generator.

import { forwardRef, useCallback, useEffect, useImperativeHandle } from 'react'
import { useGame } from './useGame'
import { useHint } from './useHint'
import { useDrag, type DragItem, type DropOutcome } from './useDrag'
import { Tray } from './Tray'
import { Expression } from './Expression'
import { Chip } from './Chip'
import { notate } from '../core/notation'
import type { Operator } from '../core/expression'
import './tokens.css'
import styles from './Game.module.css'

export interface BoardProps {
  numbers: number[]
  target: number
  ops: Operator[]
  /** called 1200ms after a correct submit (concept 12.8) — the caller's cue to bring in the next puzzle. */
  onSolved?: () => void
}

/** Imperative handle so the header's hint icon (concept 12.7), rendered by a sibling in Game.tsx, can trigger a press on the board it belongs to (concept 10.3). */
export interface BoardHandle {
  pressHint: () => void
}

interface DragPayload {
  role: 'number' | 'operator' | 'block'
  operator?: Operator
  /** what the ghost has to show while this chip is in the air — the chip it came from isn't reachable from an id alone. */
  value?: number
  /**
   * Which half of the board this chip was picked up from. Tapping means
   * opposite things on the two sides — the tray places, the field returns
   * (concept 6.6: "die exakte Umkehrung des Platzierens") — and `role`
   * alone can't tell them apart, so a tapped operator on the board placed
   * a second one; numbers escaped it only because `onTapNumber` happens to
   * check whether the id is already placed.
   *
   * It doubles as the chip's scale, which is the same fact: field chips
   * are smaller than tray chips (concept 12.5).
   */
  origin: 'tray' | 'field'
}

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

const GHOST_VARIANT: Record<DragPayload['role'], 'number' | 'operator' | 'block'> = {
  number: 'number',
  operator: 'operator',
  block: 'block',
}

/** The dragged chip, redrawn inside the ghost — same variant, same scale, so what follows the finger looks like what was picked up. */
function GhostChip({ payload }: { payload: DragPayload }) {
  return (
    <Chip
      variant={GHOST_VARIANT[payload.role]}
      value={payload.value}
      operator={payload.operator}
      scale={payload.origin}
      tabIndex={-1}
    />
  )
}

export const Board = forwardRef<BoardHandle, BoardProps>(function Board({ numbers, target, ops, onSolved }, ref) {
  const game = useGame({ numbers, target, ops })
  const hint = useHint({
    expr: game.expr,
    tray: game.tray,
    target,
    opsAllowed: ops,
    numbersCount: numbers.length,
    onApplyMove: game.applyHintMove,
  })
  useImperativeHandle(ref, () => ({ pressHint: hint.onPressHint }), [hint.onPressHint])

  // concept 12.8: a correct answer waits 1200ms — the value carried over
  // from v1 — before the next puzzle replaces this board; a wrong one
  // changes nothing, and there's no "gave up" path yet (concept 10, step 4).
  useEffect(() => {
    if (game.status !== 'correct') return
    const timer = setTimeout(() => onSolved?.(), 1200)
    return () => clearTimeout(timer)
  }, [game.status, onSolved])

  // useDrag only ever hands back what this app itself put into `data`
  // (concept 5: onTap and onDrop both feed the same handful of game
  // actions, just triggered differently) — the `!` reflects that
  // invariant, not a gap in it.
  const handleTap = useCallback((item: DragItem<DragPayload>) => {
    const { role, operator, origin } = item.data!
    // Anything already on the board goes back where it came from, whatever
    // kind of chip it is (concept 6.6). Only the tray places — except a
    // placed block, which isn't a leaf at all: tapping its bracket edge
    // dissolves the group (concept 6.5), the same as ever, just routed
    // through the shared drag layer's tap detection now that the edge is
    // also a drag handle.
    if (origin === 'field') {
      if (role === 'block') game.onDissolveGroup(item.id)
      else game.onTapLeaf(item.id)
      return
    }
    if (role === 'number') game.onTapNumber(item.id)
    else if (role === 'block') game.onTapBlock()
    else if (role === 'operator' && operator) game.onTapOperator(operator)
  }, [game])

  const handleDrop = useCallback((item: DragItem<DragPayload>, target: DropOutcome) => {
    game.onDrop({ id: item.id, kind: item.kind, data: item.data! }, target)
  }, [game])

  const drag = useDrag<DragPayload>({ onTap: handleTap, onDrop: handleDrop })

  const notation = notate(game.expr)
  // Concept 9.2's notation line, revised (PO): the result only ever meant
  // anything to a player who had already committed to the expression, so
  // it's withheld until `=` is pressed rather than appearing live as the
  // tree happens to become complete — `game.status` already goes back to
  // 'idle' on any edit (useGame's own "a verdict doesn't outlive the
  // expression it was about"), which is exactly "judged and unedited since".
  const readout = game.status !== 'idle' && game.result !== null ? `${notation} = ${game.result}` : notation

  return (
    <div className={styles.board}>
      <div className={styles.fieldRow}>
        <Expression
          expr={game.expr}
          scaffoldOperands={game.scaffoldOperands}
          scaffoldOperators={game.scaffoldOperators}
          onTapLeaf={game.onTapLeaf}
          onDissolveGroup={game.onDissolveGroup}
          registerZone={drag.registerZone}
          dragHandlers={drag.dragHandlers}
          activeZoneId={drag.activeZoneId}
          deadEnd={hint.deadEnd}
        />
        <Chip variant="target" value={target} />
      </div>

      {/* concept 9.2's notation line, moved (PO): directly under the field
          being built, above the tray, rather than below it — real notation
          as the tree grows, "= result" appended only once `=` has been
          pressed on it. */}
      <div className={cx(styles.readout, game.status === 'wrong' && styles.wrong)} role="status">
        {readout}
      </div>

      <Tray
        numberSlots={game.trayNumbers}
        blockDisabled={game.blockDisabled}
        operatorsMuted={game.operatorsMuted}
        operators={game.operators}
        submitEnabled={game.submitEnabled}
        onTapNumber={game.onTapNumber}
        onTapBlock={game.onTapBlock}
        onTapOperator={game.onTapOperator}
        onSubmit={game.onSubmit}
        dragHandlers={drag.dragHandlers}
        pulsingIds={hint.pulseIds}
      />

      {/* concept 5.1's "Geisterelement": the chip itself stays put and
          dims, a copy follows the finger. useDrag writes the transform
          straight onto this node — React only ever decides *what* is in
          it, never where it is. */}
      <div
        ref={drag.ghostRef}
        className={styles.ghost}
        style={{ display: drag.isDragging ? 'grid' : 'none' }}
        aria-hidden="true"
      >
        {drag.draggingItem && <GhostChip payload={drag.draggingItem.data!} />}
      </div>
    </div>
  )
})
