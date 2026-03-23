import { LEVELS, LEVEL_GROUPS } from '../../core/models/Level'
import { StoredProgress } from '../../core/services/ProgressService'
import { t } from '../../i18n'
import styles from './SettingsScreen.module.css'

interface SettingsScreenProps {
  progress: StoredProgress
  onSelectLevel: (id: string) => void
  onSetLanguage: (lang: 'de' | 'en') => void
  onReset: () => void
  onBack: () => void
}

export function SettingsScreen({ progress, onSelectLevel, onSetLanguage, onReset, onBack }: SettingsScreenProps) {
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← {t('settings.back')}</button>
        <h2 className={styles.title}>{t('settings.title')}</h2>
        <div />
      </header>

      <div className={styles.content}>
        {/* Language */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('settings.language')}</h3>
          <div className={styles.langRow}>
            <button
              className={`${styles.langBtn} ${progress.language === 'de' ? styles.active : ''}`}
              onClick={() => onSetLanguage('de')}
            >🇩🇪 Deutsch</button>
            <button
              className={`${styles.langBtn} ${progress.language === 'en' ? styles.active : ''}`}
              onClick={() => onSetLanguage('en')}
            >🇬🇧 English</button>
          </div>
        </section>

        {/* Levels */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('settings.levels')}</h3>
          {LEVEL_GROUPS.map(group => (
            <div key={group.key} className={styles.group}>
              <div className={styles.groupLabel}>
                {group.label} {
                group.key === 'beginner' ? t('level.beginner') :
                group.key === 'advanced' ? t('level.advanced') :
                t('level.expert')
              }
              </div>
              <div className={styles.levelCards}>
                {group.ids.map(id => {
                  const level = LEVELS.find(l => l.id === id)!
                  const streak = progress.unlockStreaks[id] ?? 0
                  const isCurrent = progress.currentLevelId === id
                  return (
                    <button
                      key={id}
                      className={`${styles.levelCard} ${isCurrent ? styles.current : ''}`}
                      onClick={() => onSelectLevel(id)}
                    >
                      <span className={styles.cardId}>{id}</span>
                      <span className={styles.cardNums}>
                        {t('level.numbers', { n: level.numberCount })}
                      </span>
                      <span className={styles.cardRange}>
                        {t('level.target_range', { min: level.targetRange.min, max: level.targetRange.max })}
                      </span>
                      <span className={styles.cardStreak}>
                        {[0,1,2].map(i => (
                          <span key={i} className={`${styles.dot} ${i < streak ? styles.dotFilled : ''}`} />
                        ))}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Reset */}
        <section className={styles.section}>
          <button className={styles.resetBtn} onClick={() => {
            if (window.confirm(t('settings.reset_confirm'))) onReset()
          }}>{t('settings.reset')}</button>
        </section>
      </div>
    </div>
  )
}
