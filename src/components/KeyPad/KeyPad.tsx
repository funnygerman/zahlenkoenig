import { OperatorToken, BracketToken } from '../../core/models/Token'
import { Level } from '../../core/models/Level'
import styles from './KeyPad.module.css'

interface KeyPadProps {
  level: Level
  onOperator: (token: OperatorToken) => void
  onBracket: (token: BracketToken) => void
  onDelete: () => void
  onSubmit: () => void
}

export function KeyPad({ level, onOperator, onBracket, onDelete, onSubmit }: KeyPadProps) {
  const hasOp = (op: string) => level.operators.includes(op as OperatorToken['value'])
  const hasMulDiv = hasOp('*') || hasOp('/')
  const hasBrackets = level.maxBracketDepth > 0
  const showRow2 = hasMulDiv || hasBrackets

  function OpBtn({ value, label, active }: { value: OperatorToken['value']; label: string; active: boolean }) {
    return (
      <button
        className={`${styles.btn} ${styles.op} ${!active ? styles.inactive : ''}`}
        onClick={() => active && onOperator({ type: 'operator', value })}
        disabled={!active}
      >{active ? label : ''}</button>
    )
  }

  function BracketBtn({ value }: { value: '(' | ')' }) {
    return (
      <button
        className={`${styles.btn} ${styles.bracket} ${!hasBrackets ? styles.inactive : ''}`}
        onClick={() => hasBrackets && onBracket({ type: 'bracket', value })}
        disabled={!hasBrackets}
      >{hasBrackets ? value : ''}</button>
    )
  }

  return (
    <div className={styles.keypad}>
      {/* Row 1: + − ⌫ = (always visible) */}
      <div className={styles.row}>
        <OpBtn value="+" label="+" active={true} />
        <OpBtn value="-" label="−" active={true} />
        <button className={`${styles.btn} ${styles.del}`} onClick={onDelete}>⌫</button>
        <button className={`${styles.btn} ${styles.submit}`} onClick={onSubmit}>=</button>
      </div>

      {/* Row 2: × ÷ ( ) – only shown when level supports them */}
      {showRow2 && (
        <div className={styles.row}>
          <OpBtn value="*" label="×" active={hasOp('*')} />
          <OpBtn value="/" label="÷" active={hasOp('/')} />
          <BracketBtn value="(" />
          <BracketBtn value=")" />
        </div>
      )}

      {/* Spacer to fill remaining space */}
      <div className={styles.spacer} />
    </div>
  )
}
