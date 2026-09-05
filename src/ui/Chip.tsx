// One chip (concept 12.2/14): a number (rounded square), an operator
// (circle), the block icon (bracketed square-circle-square), the target or
// "=" (a filled accent square — concept 12.1: "die Zielzahl ist derselbe
// Chip wie eine Zahl"). Purely presentational — drag and tap are the
// caller's job (concept 5: tap and drag both end up triggering the same
// tree operation one level up; this component doesn't know which).
//
// Visual rules are copied from spec/entwurf.html's validated `.chip`
// family, not re-derived — see tokens.css's own note on why.

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { Operator } from '../core/expression'
import styles from './Chip.module.css'

export type ChipVariant = 'number' | 'operator' | 'block' | 'target' | 'submit'

const OPERATOR_GLYPH: Record<Operator, string> = {
  '+': '+',
  '-': '−', // − (concept 13.2: typographic minus, not a hyphen)
  '*': '×', // ×
  '/': '÷', // ÷
}

export function operatorGlyph(op: Operator): string {
  return OPERATOR_GLYPH[op]
}

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant: ChipVariant
  /** the number to show ('number'), or the target/result to show ('target'). */
  value?: number
  /** which operator this chip represents ('operator' variant only). */
  operator?: Operator
  /** field-scale chips are smaller than tray chips — one of the load-bearing proportions in concept 12.5. */
  scale?: 'tray' | 'field'
  /** inside a group, a chip comes forward instead of staying tray-gray (concept 12.4). */
  inGroup?: boolean
  /**
   * A dashed, empty outline standing in for a chip placed elsewhere right
   * now — in the tray, for a number or block already in the expression
   * (concept 6.6). Tapping it returns whatever left it; that's the
   * caller's onClick, not this component's concern.
   */
  placeholder?: boolean
  /**
   * A pale, filled outline in the *expression* field marking a slot the
   * puzzle will need but nothing has been dropped into yet (concept 6.4:
   * "Ein Gerüst ist damit in der Anzahl immer richtig"). Unlike
   * `placeholder`, this isn't a real gap you can tap or drop onto — concept
   * 6.4: "Sie sind keine eigenen Ablageziele" — so it renders inert, not as
   * a button.
   */
  ghost?: boolean
  /** highlighted for the hint's first press (concept 10.3). */
  pulsing?: boolean
  children?: ReactNode
}

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { variant, value, operator, scale = 'tray', inGroup = false, placeholder = false, ghost = false, pulsing = false, className, children, disabled, ...rest },
  ref
) {
  // Only the operator chip is round; the block is a normal square chip
  // with a symbol inside (concept 12.2/6.3) even though what it symbolizes
  // is round-adjacent.
  const outerShape = variant === 'operator' ? styles.circle : styles.square

  const classNames = cx(
    styles.chip,
    outerShape,
    styles[variant],
    scale === 'field' && styles.field,
    inGroup && styles.inGroup,
    placeholder && styles.placeholder,
    ghost && styles.ghostSlot,
    pulsing && styles.pulsing,
    className
  )

  if (ghost) {
    // Not a drop target and not tappable (concept 6.4) — a plain div, not
    // a button, and no ref: nothing ever needs to measure a ghost's rect.
    return <div className={classNames} aria-hidden="true" />
  }

  return (
    <button ref={ref} type="button" className={classNames} disabled={disabled} {...rest}>
      {placeholder ? null : children ?? defaultContent(variant, value, operator)}
    </button>
  )
})

function defaultContent(variant: ChipVariant, value: number | undefined, operator: Operator | undefined): ReactNode {
  switch (variant) {
    case 'number':
      return value
    case 'operator':
      return operator ? operatorGlyph(operator) : null
    case 'submit':
      return '='
    case 'target':
      return <TargetLabel value={value} />
    case 'block':
      return <BlockIcon />
  }
}

/**
 * "= 48" split as concept 9.2/12.1 render it: a small "=" and a larger
 * value, one size step down once it reaches three digits (concept 12.1:
 * the chip's edge length doesn't change, only the type size, so the grid
 * never reflows).
 */
export function TargetLabel({ value }: { value: number | undefined }) {
  if (value === undefined) return null
  const wide = String(value).length >= 3
  return (
    <span className={styles.targetInner}>
      <span className={styles.eq}>=</span>
      <span className={cx(styles.val, wide && styles.valWide)}>{value}</span>
    </span>
  )
}

/**
 * The block's symbol (concept 12.2/section on the four icon studies):
 * filled square, open circle, filled square — "Variante D" in the
 * concept's own wording, chosen because a full circle read too much like
 * an eye between the two squares.
 */
export function BlockIcon() {
  return (
    <span className={styles.blockIcon}>
      <i className={styles.blockSquare} />
      <i className={styles.blockRing} />
      <i className={styles.blockSquare} />
    </span>
  )
}
