import { useState, useCallback, useRef } from 'react'
import { useGame } from '../../hooks/useGame'
import { useHints } from '../../hooks/useHints'
import { useProgress } from '../../hooks/useProgress'
import { getLevelById } from '../../core/models/Level'
import { getSolutionPreview } from '../../core/services/HintEngine'
import { Header } from '../Header/Header'
import { InputField } from '../InputField/InputField'
import { KeyPad } from '../KeyPad/KeyPad'
import { HintPopover } from '../HintPopover/HintPopover'
import { SettingsScreen } from '../SettingsScreen/SettingsScreen'
import { Token } from '../../core/models/Token'
import { t, setLanguage } from '../../i18n'
import styles from './GameBoard.module.css'

export function GameBoard() {
  const [showSettings, setShowSettings] = useState(false)
  const [showHints, setShowHints] = useState(false)
  const [celebrate, setCelebrate] = useState(false)

  const {
    progress, recordResult, setLevel, setCustomTarget,
    setLanguage: saveLanguage, reset, isUnlocked,
  } = useProgress()

  const levelIdRef = useRef(progress.currentLevelId)
  levelIdRef.current = progress.currentLevelId

  const levelId = progress.currentLevelId
  const level = getLevelById(levelId)
  const customTarget = progress.customTargets[levelId]

  const {
    puzzle, tokens, status, warning, setHintsUsed,
    addToken, deleteToken, clearTokens, submitSolution, nextPuzzle
  } = useGame({
    levelId,
    customTarget,
    pointStreak: progress.pointStreak,
    onResult: (result, points, newPointStreak) => {
      recordResult(levelIdRef.current, result, points, newPointStreak)
      setCelebrate(true)
      setTimeout(() => {
        setCelebrate(false)
        nextPuzzle(0)
        resetHints()
      }, 1200)
    },
  })

  const { hints, hintsRemaining, requestHint, resetHints } = useHints(puzzle)

  const usedNumberIndices = tokens
    .filter(tok => tok.type === 'number')
    .map(tok => (tok as { type: 'number'; index: number }).index)

  const handleToken = useCallback((token: Token) => {
    addToken(token)
  }, [addToken])

  const handleSubmit = useCallback(() => {
    submitSolution(hints.length)
  }, [submitSolution, hints.length])

  const handleHintClick = useCallback(() => {
    if (hints.length === 0) {
      requestHint()
      setHintsUsed(1)
    }
    setShowHints(true)
  }, [hints.length, requestHint, setHintsUsed])

  const handleRequestHint = useCallback(() => {
    requestHint()
    setHintsUsed(hints.length + 1)
  }, [requestHint, hints.length, setHintsUsed])

  const handleGiveUp = useCallback(() => {
    // Signal give up to ProgressService (resets both streaks)
    recordResult(levelIdRef.current, {
      correct: false,
      firstAttempt: false,
      hintsUsed: 99,
    }, 0, 0)

    // Clear input and load next puzzle cleanly (no token injection to avoid race condition)
    clearTokens()
    resetHints()
    nextPuzzle(0)
    setShowHints(false)
  }, [recordResult, clearTokens, resetHints, nextPuzzle])

  const handleSelectLevel = useCallback((newLevelId: string) => {
    if (!isUnlocked(newLevelId)) return
    setLevel(newLevelId)
    clearTokens()
    resetHints()
    setShowSettings(false)
  }, [isUnlocked, setLevel, clearTokens, resetHints])

  const handleSetLanguage = useCallback((lang: 'de' | 'en') => {
    setLanguage(lang) // triggers re-render via subscription in useTranslation
    saveLanguage(lang)
  }, [saveLanguage])

  const solutionPreview = puzzle.solutions[0]
    ? getSolutionPreview(puzzle.solutions[0])
    : '?'

  return (
    <div className={`${styles.board} ${celebrate ? styles.celebrate : ''}`}>
      {showSettings && (
        <SettingsScreen
          progress={progress}
          onSelectLevel={handleSelectLevel}
          onSetCustomTarget={setCustomTarget}
          onSetLanguage={handleSetLanguage}
          onReset={reset}
          onBack={() => setShowSettings(false)}
        />
      )}

      {showHints && (
        <HintPopover
          hints={hints}
          hintsRemaining={hintsRemaining}
          onRequestHint={handleRequestHint}
          onGiveUp={handleGiveUp}
          onClose={() => setShowHints(false)}
          solutionPreview={solutionPreview}
        />
      )}

      <Header
        levelId={levelId}
        totalScore={progress.totalScore}
        pointStreak={progress.pointStreak}
        onMenuClick={() => setShowSettings(true)}
      />

      <InputField
        tokens={tokens}
        status={status}
        warning={warning}
        onHintClick={handleHintClick}
        onClear={clearTokens}
        onDelete={deleteToken}
      />

      <KeyPad
        puzzle={puzzle}
        level={level}
        usedNumberIndices={usedNumberIndices}
        onToken={handleToken}
        onSubmit={handleSubmit}
      />

      {status === 'correct' && (
        <div className={styles.correctBanner}>
          {t('game.correct')}
          {progress.pointStreak >= 3 && <span> {t('game.streak_bonus')}</span>}
        </div>
      )}
    </div>
  )
}
