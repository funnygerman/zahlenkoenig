import { LEVELS } from '../../core/models/Level'
import { StoredProgress } from '../../core/services/ProgressService'
import { t } from '../../i18n'
import styles from './SettingsScreen.module.css'

interface SettingsScreenProps {
  progress: StoredProgress
  onSelectLevel: (levelId: string) => void
  onSetCustomTarget: (levelId: string, target: number) => void
  onSetLanguage: (lang: 'de' | 'en') => void
  onReset: () => void
  onBack: () => void
}

const groupLabels: Record<string, string> = {
  beginner: '🌱',
  advanced: '🔥',
  expert: '🧠',
}

const groupKeys: Record<string, string> = {
  beginner: 'level.beginner',
  advanced: 'level.advanced',
  expert: 'level.expert',
}

export function SettingsScreen({
  progress,
  onSelectLevel,
  onSetCustomTarget,
  onSetLanguage,
  onReset,
  onBack,
}: SettingsScreenProps) {
  const groups = ['beginner', 'advanced', 'expert'] as const

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
          {groups.map(group => (
            <div key={group} className={styles.group}>
              <div className={styles.groupLabel}>
                {groupLabels[group]} {t(groupKeys[group])}
              </div>
              <div className={styles.levelGrid}>
                {LEVELS.filter(l => l.group === group).map(level => {
                  const unlocked = progress.unlockedLevels.includes(level.id)
                  const isCurrent = progress.currentLevelId === level.id
                  const streak = progress.unlockStreaks[level.id] ?? 0

                  return (
                    <div key={level.id} className={styles.levelCard}>
                      <button
                        className={`${styles.levelBtn} ${isCurrent ? styles.current : ''} ${!unlocked ? styles.locked : ''}`}
                        onClick={() => unlocked && onSelectLevel(level.id)}
                        disabled={!unlocked}
                      >
                        <span className={styles.levelId}>{level.id}</span>
                        {!unlocked && <span className={styles.lock}>🔒</span>}
                        {unlocked && !isCurrent && (
                          <span className={styles.streakDots}>
                            {[0, 1, 2].map(i => (
                              <span key={i} className={`${styles.dot} ${i < streak ? styles.dotFilled : ''}`} />
                            ))}
                          </span>
                        )}
                      </button>
                      {unlocked && (
                        <div className={styles.targetSlider}>
                          <label className={styles.sliderLabel}>
                            max {progress.customTargets[level.id] ?? level.targetRange.max}
                          </label>
                          <input
                            type="range"
                            min={1}
                            max={Math.min(level.maxTarget, 500)}
                            value={progress.customTargets[level.id] ?? level.targetRange.max}
                            onChange={e => onSetCustomTarget(level.id, Number(e.target.value))}
                            className={styles.slider}
                          />
                        </div>
                      )}
                    </div>
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
          }}>
            {t('settings.reset')}
          </button>
        </section>
      </div>
    </div>
  )
}
