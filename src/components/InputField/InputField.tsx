import { Token } from '../../core/models/Token'
import { GameStatus } from '../../core/models/GameState'
import styles from './InputField.module.css'

interface InputFieldProps {
  tokens: Token[]
  status: GameStatus
  warning: string | null
  onHintClick: () => void
  onClear: () => void
  onDelete: () => void
}

export function InputField({ tokens, status, warning, onHintClick, onClear, onDelete }: InputFieldProps) {
  const borderClass = warning
    ? styles.borderWarning
    : status === 'correct'
    ? styles.borderCorrect
    : status === 'wrong'
    ? styles.borderWrong
    : styles.borderDefault

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.field} ${borderClass}`}>
        <button className={styles.hintBtn} onClick={onHintClick} aria-label="Hint">
          💡
        </button>
        <div className={styles.expression}>
          {tokens.length === 0 ? (
            <span className={styles.placeholder}>···</span>
          ) : (
            tokens.map((token, i) => (
              <span
                key={i}
                className={
                  token.type === 'number'
                    ? styles.tokenNumber
                    : token.type === 'bracket'
                    ? styles.tokenBracket
                    : styles.tokenOperator
                }
              >
                {token.value}
              </span>
            ))
          )}
        </div>
      </div>
      <button className={styles.clearBtn} onClick={onClear} aria-label="Clear">
        ✕
      </button>
      <button className={styles.deleteBtn} onClick={onDelete} aria-label="Delete">
        ⌫
      </button>
      {warning && (
        <div className={styles.warning}>{warning}</div>
      )}
      {!warning && status === 'correct' && (
        <div className={styles.correct}>✓ Richtig!</div>
      )}
      {!warning && status === 'wrong' && (
        <div className={styles.wrong}>✗ Nochmal!</div>
      )}
    </div>
  )
}
