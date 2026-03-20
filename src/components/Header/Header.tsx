import { t } from '../../i18n'
import styles from './Header.module.css'

interface HeaderProps {
  levelId: string
  totalScore: number
  pointStreak: number
  onMenuClick: () => void
}

export function Header({ levelId, totalScore, pointStreak, onMenuClick }: HeaderProps) {
  return (
    <header className={styles.header}>
      <button className={styles.menuBtn} onClick={onMenuClick} aria-label="Menu">
        ⋮
      </button>
      <div className={styles.title}>
        <span className={styles.appName}>{t('appName')}</span>
        <span className={styles.level}>{levelId}</span>
      </div>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t('score.points')}</span>
          <span className={styles.statValue}>{totalScore}</span>
        </div>
        {pointStreak >= 2 && (
          <div className={styles.stat}>
            <span className={styles.statLabel}>🔥</span>
            <span className={styles.statValue}>{pointStreak}</span>
          </div>
        )}
      </div>
    </header>
  )
}
