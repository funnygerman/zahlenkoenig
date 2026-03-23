import { Token } from '../../core/models/Token'
import { GameStatus } from '../../hooks/useGame'
import { t } from '../../i18n'
import styles from './InputRow.module.css'

interface InputRowProps {
  tokens: Token[]
  target: number
  status: GameStatus
  warning: string | null
  onHintClick: () => void
  onClear: () => void
}

export function InputRow({ tokens, target, status, warning, onHintClick, onClear }: InputRowProps) {
  const borderClass = warning ? styles.borderWarning
    : status === 'correct' ? styles.borderCorrect
    : status === 'wrong'   ? styles.borderWrong
    : styles.borderDefault

  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        {/* Input field */}
        <div className={`${styles.field} ${borderClass}`}>
          <button className={styles.hintBtn} onClick={onHintClick} aria-label="Hint">💡</button>
          <div className={styles.expression}>
            {tokens.length === 0
              ? <span className={styles.placeholder}>{t('game.placeholder')}</span>
              : tokens.map((tok, i) => (
                  <span key={i} className={
                    tok.type === 'number'   ? styles.tokNum :
                    tok.type === 'bracket'  ? styles.tokBracket :
                                              styles.tokOp
                  }>{tok.value}</span>
                ))
            }
          </div>
          {tokens.length > 0 && (
            <button className={styles.clearBtn} onClick={onClear} aria-label="Clear">✕</button>
          )}
        </div>

        {/* Static equals sign */}
        <span className={styles.equals}>=</span>

        {/* Target */}
        <div className={styles.target}>
          <span className={styles.targetLabel}>{t('game.target')}</span>
          <span className={styles.targetValue}>{target}</span>
        </div>
      </div>

      {/* Status / warning message */}
      <div className={styles.msg}>
        {warning && <span className={styles.msgWarning}>{warning}</span>}
        {!warning && status === 'correct' && <span className={styles.msgCorrect}>{t('game.correct')}</span>}
        {!warning && status === 'wrong'   && <span className={styles.msgWrong}>{t('error.wrong_answer')}</span>}
      </div>
    </div>
  )
}
