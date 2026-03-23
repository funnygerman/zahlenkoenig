import { Token } from '../../core/models/Token'
import { GameStatus } from '../../hooks/useGame'
import styles from './InputRow.module.css'

interface InputRowProps {
  tokens: Token[]
  target: number
  status: GameStatus
  warning: string | null
  onClear: () => void
}

export function InputRow({ tokens, target, status, warning, onClear }: InputRowProps) {
  const borderClass = warning ? styles.borderWarning
    : status === 'correct' ? styles.borderCorrect
    : status === 'wrong'   ? styles.borderWrong
    : styles.borderDefault

  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        {/* Input field */}
        <div className={`${styles.field} ${borderClass}`}>
          <div className={styles.expression}>
            {tokens.map((tok, i) => (
              <span key={i} className={
                tok.type === 'number'  ? styles.tokNum :
                tok.type === 'bracket' ? styles.tokBracket :
                                         styles.tokOp
              }>{tok.value}</span>
            ))}
          </div>
          {tokens.length > 0 && (
            <button className={styles.clearBtn} onClick={onClear} aria-label="Clear">✕</button>
          )}
        </div>

        {/* Target button with = inside */}
        <div className={styles.target}>
          <span className={styles.targetEquals}>=</span>
          <span className={styles.targetValue}>{target}</span>
        </div>
      </div>

      {/* Status / warning */}
      <div className={styles.msg}>
        {warning && <span className={styles.msgWarning}>{warning}</span>}
        {!warning && status === 'correct' && <span className={styles.msgCorrect}>✓</span>}
        {!warning && status === 'wrong'   && <span className={styles.msgWrong}>✗</span>}
      </div>
    </div>
  )
}
