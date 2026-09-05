// Wires useGame (state), useDrag (gestures), Tray and Expression
// (rendering) into a playable board — v2 step 2's actual goal: "ein fest
// verdrahtetes Rätsel ist spielbar". The puzzle is hardcoded to concept
// 12.5's own worst-case expression, (6+2)×(9−3)=48 — the same one
// spec/entwurf.html uses to measure the field's width. Settings, the
// on-device generator (concept 15.10), and hints (concept 10) come with
// later steps; this file has none of them.
//
// Not the final layout: concept 12.1's 5-column grid needs Header.tsx and
// the selection panel to mean anything (there's no settings chip to put in
// column 5 yet), so this stacks field/tray/readout in a plain flex column
// instead — same deferral Tray.tsx's own file comment already made.

import { useCallback } from 'react'
import { useGame } from './useGame'
import { useDrag, type DragItem, type DropTarget } from './useDrag'
import { Tray } from './Tray'
import { Expression } from './Expression'
import { Chip } from './Chip'
import type { Operator } from '../core/expression'
import './tokens.css'
import styles from './Game.module.css'

const PUZZLE = { numbers: [6, 2, 9, 3], target: 48, ops: ['+', '-', '*', '/'] as Operator[] }

interface DragPayload {
  role: 'number' | 'operator' | 'block'
  operator?: Operator
}

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function Game() {
  const game = useGame(PUZZLE)

  // useDrag only ever hands back what this app itself put into `data`
  // (concept 5: onTap and onDrop both feed the same handful of game
  // actions, just triggered differently) — the `!` reflects that
  // invariant, not a gap in it.
  const handleTap = useCallback((item: DragItem<DragPayload>) => {
    const { role, operator } = item.data!
    if (role === 'number') game.onTapNumber(item.id)
    else if (role === 'block') game.onTapBlock()
    else if (role === 'operator' && operator) game.onTapOperator(operator)
  }, [game])

  const handleDrop = useCallback((item: DragItem<DragPayload>, target: DropTarget | null) => {
    game.onDrop({ id: item.id, kind: item.kind, data: item.data! }, target)
  }, [game])

  const drag = useDrag<DragPayload>({ onTap: handleTap, onDrop: handleDrop })

  return (
    <div className={styles.game}>
      <div className={styles.fieldRow}>
        <Expression
          expr={game.expr}
          onTapLeaf={game.onTapLeaf}
          onDissolveGroup={game.onDissolveGroup}
          registerZone={drag.registerZone}
          dragHandlers={drag.dragHandlers}
          activeZoneId={drag.activeZoneId}
        />
        <Chip variant="target" value={PUZZLE.target} />
      </div>

      <Tray
        numberSlots={game.trayNumbers}
        blockDisabled={game.blockDisabled}
        operators={game.operators}
        submitEnabled={game.submitEnabled}
        onTapNumber={game.onTapNumber}
        onTapBlock={game.onTapBlock}
        onTapOperator={game.onTapOperator}
        onSubmit={game.onSubmit}
        dragHandlers={drag.dragHandlers}
      />

      {/* concept 9.2's notation line, in its simplest form: the built
          expression isn't rendered as real notation yet (that needs its own
          precedence-aware printer — deferred), just the evaluated result. */}
      <div className={cx(styles.readout, game.status === 'wrong' && styles.wrong)} role="status">
        {game.result !== null && `= ${game.result}`}
      </div>

      <div
        ref={drag.ghostRef}
        className={styles.ghost}
        style={{ display: drag.isDragging ? 'block' : 'none' }}
        aria-hidden="true"
      />
    </div>
  )
}
