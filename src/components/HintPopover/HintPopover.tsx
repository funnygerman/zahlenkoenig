import { useState } from 'react'
import { Hint } from '../../core/services/HintEngine'
import { t } from '../../i18n'
import styles from './HintPopover.module.css'

interface HintPopoverProps {
  hints: Hint[]
  hintsRemaining: number
  solutionPreview: string
  onRequestHint: () => void
  onGiveUp: () => void
  onClose: () => void
}

export function HintPopover({ hints, hintsRemaining, solutionPreview, onRequestHint, onGiveUp, onClose }: HintPopoverProps) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.popover} onClick={e => e.stopPropagation()}>
        <h3 className={styles.title}>{t('hint.title')}</h3>

        <div className={styles.hints}>
          {hints.length === 0 && <p className={styles.empty}>💡</p>}
          {hints.map((h, i) => (
            <div key={i} className={styles.hintItem}>
              <span className={styles.icon}>{'💡'.repeat(h.level)}</span>
              <span className={styles.text}>{t(h.textKey, h.textParams)}</span>
            </div>
          ))}
        </div>

        {hintsRemaining > 0 && (
          <button className={styles.nextBtn} onClick={onRequestHint}>
            {t('hint.next_hint')} ({hintsRemaining})
          </button>
        )}

        {hintsRemaining === 0 && !confirming && (
          <div className={styles.giveUpSection}>
            <p className={styles.noMore}>{t('hint.no_more_hints')}</p>
            <button className={styles.giveUpBtn} onClick={() => setConfirming(true)}>
              🏳️ {t('hint.give_up')}
            </button>
            <p className={styles.giveUpWarning}>{t('hint.give_up_warning')}</p>
          </div>
        )}

        {confirming && (
          <div className={styles.confirmSection}>
            <p className={styles.confirmText}>{t('hint.give_up_confirm')}</p>
            <p className={styles.solutionPreview}>
              {t('hint.give_up_solution_prefix')} <strong>{solutionPreview}</strong>
            </p>
            <div className={styles.confirmBtns}>
              <button className={styles.confirmYes} onClick={() => { setConfirming(false); onGiveUp() }}>
                ✓ {t('hint.give_up')}
              </button>
              <button className={styles.confirmNo} onClick={() => setConfirming(false)}>
                ✗
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
