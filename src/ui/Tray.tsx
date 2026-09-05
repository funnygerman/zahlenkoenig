// The tray/palette (concept 12.1's rows 2-3): numbers and block chips on
// one row, operators and "=" on the next. Numbers are right-aligned — with
// fewer than 4 numbers the left cells are simply empty ("nichts", concept
// 12.3), never a placeholder, so a 3-number puzzle can't be mistaken for a
// 4-number one with a chip already placed.
//
// This owns its own two-row flex layout rather than assuming Game.tsx's
// eventual 5-column grid (concept 12.1) — Game.tsx doesn't exist yet (v2
// step 2 isn't finished), so there's no grid to slot into. Once it does,
// each row here may need to become grid items instead; the chip contents
// and interaction wiring below don't change either way.
//
// The block chip is a single, permanent chip, like an operator's — not one
// placeholder per unit of budget (concept section 4's floor(n/2)). It's
// disabled once the budget is used up rather than hidden or turned into a
// placeholder: unlike a number, an already-placed block's tray "instance"
// doesn't stand for any specific group on the board (nothing here remembers
// *which* group a tap would return), so there's nothing for a placeholder
// to tap back — removing a block is bracket-edge-only (concept 6: "Block:
// antippen löst auf").

import { Chip } from './Chip'
import type { DragHandlers } from './useDrag'
import type { Operator } from '../core/expression'
import styles from './Tray.module.css'

export interface TrayNumberSlot {
  id: string
  value: number
  /** already placed in the expression — rendered as a dashed placeholder (concept 6.6); tapping it returns the number. */
  used: boolean
}

export interface TrayProps {
  /** right-aligned; length matches the puzzle's number count (2-4, concept 15.4). */
  numberSlots: TrayNumberSlot[]
  /** how many number columns to pad to on the left with empty ("nichts") cells — concept 12.1's grid is 4 wide. */
  numberColumns?: number
  /** the block budget (concept 4: floor(n/2)) is used up — the chip disables rather than disappearing. */
  blockDisabled: boolean
  /** always shown in ×÷+− order (concept 12.1), whichever the puzzle's settings enabled. */
  operators: Operator[]
  submitEnabled: boolean
  onTapNumber: (id: string) => void
  onTapBlock: () => void
  onTapOperator: (op: Operator) => void
  onSubmit: () => void
  /**
   * Wires a chip into the shared drag layer (concept 5.1) — pass useDrag's
   * `dragHandlers`, lifted to a common ancestor of Tray and Expression so a
   * chip can be dragged from one into the other. Omit to make the tray
   * tap-only (e.g. in a test, or before drag is wired up). `data.role`
   * lets the drop handler tell a number from a block (both are
   * operand-kind) without guessing from the id string.
   */
  dragHandlers?: (item: { id: string; kind: 'operand' | 'operator'; data: { role: 'number' | 'operator' | 'block'; operator?: Operator } }) => DragHandlers
}

function NumberCell({ slot, onTap, drag }: { slot: TrayNumberSlot; onTap: (id: string) => void; drag?: TrayProps['dragHandlers'] }) {
  // When drag is wired up, useDrag's own tap-vs-drag detection (below the
  // 6px threshold, concept 5.1) is the only tap path — a plain onClick
  // alongside it would double-fire, since both a native click and
  // useDrag's onPointerUp-detected tap happen on the same gesture.
  //
  // This must not depend on `slot.used`: a tap's own pointerup already
  // calls onTap and (synchronously, in React) re-renders with the new
  // `used` value *before* the browser fires the trailing native `click`
  // for that same physical gesture — so a `used`-conditioned `hasDrag`
  // flips mid-gesture and the now-defined onClick fires too, undoing the
  // tap it just made. onTap itself already handles both directions
  // (onTapNumber checks placedIds), so drag stays the only path
  // regardless of `used`.
  const hasDrag = Boolean(drag)
  return (
    <Chip
      variant="number"
      value={slot.value}
      placeholder={slot.used}
      onClick={hasDrag ? undefined : () => onTap(slot.id)}
      {...(drag ? drag({ id: slot.id, kind: 'operand', data: { role: 'number' } }) : undefined)}
    />
  )
}

export function Tray({
  numberSlots,
  numberColumns = 4,
  blockDisabled,
  operators,
  submitEnabled,
  onTapNumber,
  onTapBlock,
  onTapOperator,
  onSubmit,
  dragHandlers,
}: TrayProps) {
  const emptyCount = Math.max(0, numberColumns - numberSlots.length)

  return (
    <div className={styles.tray}>
      <div className={styles.row}>
        {Array.from({ length: emptyCount }, (_, i) => (
          <div key={`empty-${i}`} className={styles.emptyCell} aria-hidden="true" />
        ))}
        {numberSlots.map(slot => (
          <NumberCell key={slot.id} slot={slot} onTap={onTapNumber} drag={dragHandlers} />
        ))}
        <Chip
          variant="block"
          disabled={blockDisabled}
          onClick={dragHandlers ? undefined : onTapBlock}
          {...(dragHandlers ? dragHandlers({ id: 'tray-block', kind: 'operand', data: { role: 'block' } }) : undefined)}
        />
      </div>
      <div className={styles.row}>
        {(['*', '/', '+', '-'] as Operator[])
          .filter(op => operators.includes(op))
          .map(op => (
            <Chip
              key={op}
              variant="operator"
              operator={op}
              onClick={dragHandlers ? undefined : () => onTapOperator(op)}
              {...(dragHandlers ? dragHandlers({ id: `tray-op-${op}`, kind: 'operator', data: { role: 'operator', operator: op } }) : undefined)}
            />
          ))}
        <Chip variant="submit" disabled={!submitEnabled} onClick={onSubmit} />
      </div>
    </div>
  )
}
