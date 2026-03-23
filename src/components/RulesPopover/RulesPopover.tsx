import { t } from '../../i18n'
import styles from './RulesPopover.module.css'

interface RulesPopoverProps {
  onClose: () => void
}

export function RulesPopover({ onClose }: RulesPopoverProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.popover} onClick={e => e.stopPropagation()}>
        <h3 className={styles.title}>{t('rules.title')}</h3>

        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>{t('rules.goal_title')}</h4>
          <p className={styles.text}>{t('rules.goal_text')}</p>
        </section>

        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>{t('rules.rules_title')}</h4>
          <ul className={styles.list}>
            <li>{t('rules.rule1')}</li>
            <li>{t('rules.rule2')}</li>
            <li>{t('rules.rule3')}</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>{t('rules.tips_title')}</h4>
          <p className={styles.text}>{t('rules.tips_text')}</p>
        </section>

        <button className={styles.closeBtn} onClick={onClose}>OK</button>
      </div>
    </div>
  )
}
