import { t } from '../../i18n'
import styles from './Header.module.css'

interface HeaderProps {
  levelId: string
  pointStreak: number
  onSettingsClick: () => void
  onHintClick: () => void
  onRulesClick: () => void
}

export function Header({ levelId, pointStreak, onSettingsClick, onHintClick, onRulesClick }: HeaderProps) {
  return (
    <header className={styles.header}>
      <button className={styles.iconBtn} onClick={onSettingsClick} aria-label="Settings">⚙️</button>
      <div className={styles.center}>
        <span className={styles.title}>{t('appName')}</span>
        <span className={styles.level}>{levelId}</span>
      </div>
      <div className={styles.right}>
        <button className={styles.iconBtn} onClick={onHintClick} aria-label="Hints">💡</button>
        <button className={styles.iconBtn} onClick={onRulesClick} aria-label="Rules">❓</button>
        {pointStreak >= 2 && (
          <span className={styles.streak}>🔥{pointStreak}</span>
        )}
      </div>
    </header>
  )
}
