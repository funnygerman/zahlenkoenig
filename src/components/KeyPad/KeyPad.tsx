import { Token, NumberToken, OperatorToken, BracketToken } from '../../core/models/Token'
import { Puzzle } from '../../core/models/Puzzle'
import { Level } from '../../core/models/Level'
import { t } from '../../i18n'
import styles from './KeyPad.module.css'

interface KeyPadProps {
  puzzle: Puzzle
  level: Level
  usedNumberIndices: number[]
  onToken: (token: Token) => void
  onSubmit: () => void
}

export function KeyPad({ puzzle, level, usedNumberIndices, onToken, onSubmit }: KeyPadProps) {
  const nums = puzzle.numbers

  function numToken(index: number): NumberToken {
    return { type: 'number', value: nums[index], index }
  }
  function opToken(value: OperatorToken['value']): OperatorToken {
    return { type: 'operator', value }
  }
  function bracketToken(value: BracketToken['value']): BracketToken {
    return { type: 'bracket', value }
  }

  const hasOp  = (op: string) => level.operators.includes(op as OperatorToken['value'])
  const hasMul = hasOp('*')
  const hasDiv = hasOp('/')
  const hasBrackets = level.maxBracketDepth > 0
  const has3 = level.numberCount >= 3
  const has4 = level.numberCount >= 4

  // Number button: always rendered, but empty+inactive if that slot doesn't exist
  function NumBtn({ index }: { index: number }) {
    if (index === 2 && !has3) return <div className={`${styles.btn} ${styles.num} ${styles.empty}`} />
    if (index === 3 && !has4) return <div className={`${styles.btn} ${styles.num} ${styles.empty}`} />
    const used = usedNumberIndices.includes(index)
    return (
      <button
        className={`${styles.btn} ${styles.num} ${used ? styles.used : ''}`}
        onClick={() => !used && onToken(numToken(index))}
        disabled={used}
      >
        {used ? '' : nums[index]}
      </button>
    )
  }

  // Operator button: always rendered, but invisible+inactive if not available in level
  function OpBtn({ value, label }: { value: OperatorToken['value']; label: string }) {
    const active = hasOp(value)
    return (
      <button
        className={`${styles.btn} ${styles.op} ${!active ? styles.inactive : ''}`}
        onClick={() => active && onToken(opToken(value))}
        disabled={!active}
      >
        {active ? label : ''}
      </button>
    )
  }

  // Bracket button: always rendered, invisible+inactive if not available
  function BracketBtn({ value }: { value: '(' | ')' }) {
    return (
      <button
        className={`${styles.btn} ${styles.bracket} ${!hasBrackets ? styles.inactive : ''}`}
        onClick={() => hasBrackets && onToken(bracketToken(value))}
        disabled={!hasBrackets}
      >
        {hasBrackets ? value : ''}
      </button>
    )
  }

  return (
    <div className={styles.keypad}>
      {/* Row 1: ( ) = */}
      <div className={styles.row}>
        <BracketBtn value="(" />
        <BracketBtn value=")" />
        <button className={`${styles.btn} ${styles.submit}`} onClick={onSubmit}>
          =
        </button>
      </div>

      {/* Row 2: + Z3 - */}
      <div className={styles.row}>
        <OpBtn value="+" label="+" />
        <NumBtn index={2} />
        <OpBtn value="-" label="−" />
      </div>

      {/* Row 3: Z1 TARGET Z2 */}
      <div className={styles.row}>
        <NumBtn index={0} />
        <div className={styles.target}>
          <span className={styles.targetLabel}>{t('game.target')}</span>
          <span className={styles.targetValue}>{puzzle.target}</span>
        </div>
        <NumBtn index={1} />
      </div>

      {/* Row 4: × Z4 ÷ */}
      <div className={styles.row}>
        <OpBtn value="*" label="×" />
        <NumBtn index={3} />
        <OpBtn value="/" label="÷" />
      </div>
    </div>
  )
}
