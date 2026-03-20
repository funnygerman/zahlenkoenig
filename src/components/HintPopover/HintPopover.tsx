import { useState } from 'react'
import { Hint } from '../../core/services/HintEngine'
import { t } from '../../i18n'
import styles from './HintPopover.module.css'

interface HintPopoverProps {
  hints: Hint[]
  hintsRemaining: number
  onRequestHint: () => void
  onGiveUp: () => void
  onClose: () => void
  solutionPreview: string  // first token of solution e.g. "3*("
}

export function HintPopover({
  hints, hintsRemaining, onRequestHint, onGiveUp, onClose, solutionPreview
}: HintPopoverProps) {
  const [confirmingGiveUp, setConfirmingGiveUp] = useState(false)

  function handleGiveUpClick() {
    setConfirmingGiveUp(true)
  }

  function handleGiveUpConfirm() {
    setConfirmingGiveUp(false)
    onGiveUp()
    onClose()
  }

  function handleGiveUpCancel() {
    setConfirmingGiveUp(false)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.popover} onClick={e => e.stopPropagation()}>
        <h3 className={styles.title}>{t('hint.title')}</h3>

        <div className={styles.hints}>
          {hints.length === 0 && <p className={styles.empty}>💡</p>}
          {hints.map((hint, i) => (
            <div key={i} className={styles.hintItem}>
              <span className={styles.hintIcon}>{'💡'.repeat(hint.level)}</span>
              <span className={styles.hintText}>
                {t(hint.textKey, hint.textParams)}
              </span>
            </div>
          ))}
        </div>

        {/* Next hint button */}
        {hintsRemaining > 0 && (
          <button className={styles.nextBtn} onClick={onRequestHint}>
            {t('hint.next_hint')} ({hintsRemaining})
          </button>
        )}

        {/* Give up – only shown when all hints are exhausted */}
        {hintsRemaining === 0 && !confirmingGiveUp && (
          <div className={styles.giveUpSection}>
            <p className={styles.noMore}>{t('hint.no_more_hints')}</p>
            <button className={styles.giveUpBtn} onClick={handleGiveUpClick}>
              🏳️ {t('hint.give_up')}
            </button>
            <p className={styles.giveUpWarning}>{t('hint.give_up_warning')}</p>
          </div>
        )}

        {/* Confirmation dialog */}
        {confirmingGiveUp && (
          <div className={styles.confirmSection}>
            <p className={styles.confirmText}>{t('hint.give_up_confirm')}</p>
            <p className={styles.solutionPreview}>
              {t('hint.give_up_solution_prefix')} <strong>{solutionPreview}</strong>
            </p>
            <div className={styles.confirmBtns}>
              <button className={styles.confirmYes} onClick={handleGiveUpConfirm}>
                ✓ {t('hint.give_up')}
              </button>
              <button className={styles.confirmNo} onClick={handleGiveUpCancel}>
                ✗ {t('hint.next_hint').split(' ')[0]}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
