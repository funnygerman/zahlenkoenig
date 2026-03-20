import { Hint } from '../../core/services/HintEngine'
import { t } from '../../i18n'
import styles from './HintPopover.module.css'

interface HintPopoverProps {
  hints: Hint[]
  hintsRemaining: number
  onRequestHint: () => void
  onClose: () => void
}

export function HintPopover({ hints, hintsRemaining, onRequestHint, onClose }: HintPopoverProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.popover} onClick={e => e.stopPropagation()}>
        <h3 className={styles.title}>{t('hint.title')}</h3>

        <div className={styles.hints}>
          {hints.length === 0 && (
            <p className={styles.empty}>💡</p>
          )}
          {hints.map((hint, i) => (
            <div key={i} className={styles.hintItem}>
              <span className={styles.hintIcon}>{'💡'.repeat(hint.level)}</span>
              <span className={styles.hintText}>
                {t(hint.textKey, hint.textParams)}
              </span>
            </div>
          ))}
        </div>

        {hintsRemaining > 0 ? (
          <button className={styles.nextBtn} onClick={onRequestHint}>
            {t('hint.next_hint')} ({hintsRemaining})
          </button>
        ) : (
          <p className={styles.noMore}>{t('hint.no_more_hints')}</p>
        )}
      </div>
    </div>
  )
}
