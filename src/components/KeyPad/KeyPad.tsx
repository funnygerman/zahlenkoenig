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

  const hasOp = (op: string) => level.operators.includes(op as OperatorToken['value'])
  const hasMul = hasOp('*')
  const hasDiv = hasOp('/')
  const hasBrackets = level.maxBracketDepth > 0

  // Positions: Z3=top-center, Z1=mid-left, target=mid-center, Z2=mid-right, Z4=bot-center
  const has3 = level.numberCount >= 3
  const has4 = level.numberCount >= 4

  return (
    <div className={styles.keypad}>
      {/* Row 1: ( ) = */}
      <div className={styles.row}>
        <button
          className={`${styles.btn} ${styles.bracket} ${!hasBrackets ? styles.disabled : ''}`}
          onClick={() => hasBrackets && onToken(bracketToken('('))}
          disabled={!hasBrackets}
        >(</button>
        <button
          className={`${styles.btn} ${styles.bracket} ${!hasBrackets ? styles.disabled : ''}`}
          onClick={() => hasBrackets && onToken(bracketToken(')'))}
          disabled={!hasBrackets}
        >)</button>
        <button className={`${styles.btn} ${styles.submit}`} onClick={onSubmit}>
          {t('game.check')}
        </button>
      </div>

      {/* Row 2: + Z3 - */}
      <div className={styles.row}>
        <button className={`${styles.btn} ${styles.op}`} onClick={() => onToken(opToken('+'))}>+</button>
        {has3 ? (
          <button
            className={`${styles.btn} ${styles.num} ${usedNumberIndices.includes(2) ? styles.used : ''}`}
            onClick={() => !usedNumberIndices.includes(2) && onToken(numToken(2))}
            disabled={usedNumberIndices.includes(2)}
          >{usedNumberIndices.includes(2) ? '·' : nums[2]}</button>
        ) : (
          <div className={styles.empty} />
        )}
        <button className={`${styles.btn} ${styles.op}`} onClick={() => onToken(opToken('-'))}>−</button>
      </div>

      {/* Row 3: Z1 TARGET Z2 */}
      <div className={styles.row}>
        <button
          className={`${styles.btn} ${styles.num} ${usedNumberIndices.includes(0) ? styles.used : ''}`}
          onClick={() => !usedNumberIndices.includes(0) && onToken(numToken(0))}
          disabled={usedNumberIndices.includes(0)}
        >{usedNumberIndices.includes(0) ? '·' : nums[0]}</button>

        <div className={styles.target}>
          <span className={styles.targetLabel}>{t('game.target')}</span>
          <span className={styles.targetValue}>{puzzle.target}</span>
        </div>

        <button
          className={`${styles.btn} ${styles.num} ${usedNumberIndices.includes(1) ? styles.used : ''}`}
          onClick={() => !usedNumberIndices.includes(1) && onToken(numToken(1))}
          disabled={usedNumberIndices.includes(1)}
        >{usedNumberIndices.includes(1) ? '·' : nums[1]}</button>
      </div>

      {/* Row 4: × Z4 ÷ */}
      <div className={styles.row}>
        <button
          className={`${styles.btn} ${styles.op} ${!hasMul ? styles.hidden : ''}`}
          onClick={() => hasMul && onToken(opToken('*'))}
        >×</button>
        {has4 ? (
          <button
            className={`${styles.btn} ${styles.num} ${usedNumberIndices.includes(3) ? styles.used : ''}`}
            onClick={() => !usedNumberIndices.includes(3) && onToken(numToken(3))}
            disabled={usedNumberIndices.includes(3)}
          >{usedNumberIndices.includes(3) ? '·' : nums[3]}</button>
        ) : (
          <div className={styles.empty} />
        )}
        <button
          className={`${styles.btn} ${styles.op} ${!hasDiv ? styles.hidden : ''}`}
          onClick={() => hasDiv && onToken(opToken('/'))}
        >÷</button>
      </div>
    </div>
  )
}
