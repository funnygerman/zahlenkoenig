import { useState, useCallback, useRef } from 'react'
import { useGame } from '../../hooks/useGame'
import { useHints } from '../../hooks/useHints'
import { useProgress } from '../../hooks/useProgress'
import { getSolutionPreview } from '../../core/services/HintEngine'
import { t, setLanguage } from '../../i18n'
import { Header } from '../Header/Header'
import { NumberRow } from '../NumberRow/NumberRow'
import { InputRow } from '../InputRow/InputRow'
import { KeyPad } from '../KeyPad/KeyPad'
import { HintPopover } from '../HintPopover/HintPopover'
import { RulesPopover } from '../RulesPopover/RulesPopover'
import { SettingsScreen } from '../SettingsScreen/SettingsScreen'
import { NumberToken, OperatorToken, BracketToken } from '../../core/models/Token'
import { getLevelById } from '../../core/models/Level'
import styles from './GameBoard.module.css'

export function GameBoard() {
  const [showSettings, setShowSettings] = useState(false)
  const [showHints,    setShowHints]    = useState(false)
  const [showRules,    setShowRules]    = useState(false)
  const [celebrate,    setCelebrate]    = useState(false)

  const { progress, recordResult, setLevel, setLanguage: saveLanguage, reset } = useProgress()
  const levelId = progress.currentLevelId
  const level = getLevelById(levelId)
  const levelIdRef = useRef(levelId)
  levelIdRef.current = levelId

  const {
    puzzle, tokens, status, warning, setHintsUsed,
    addToken, deleteToken, clearTokens, submitSolution, nextPuzzle,
  } = useGame({
    levelId,
    pointStreak: progress.pointStreak,
    onResult: (result, newPointStreak) => {
      recordResult(levelIdRef.current, result, newPointStreak)
      setCelebrate(true)
      setTimeout(() => { setCelebrate(false); nextPuzzle(0); resetHints() }, 1200)
    },
  })

  const { hints, hintsRemaining, requestHint, resetHints } = useHints(puzzle)

  const usedIndices = tokens.filter(tok => tok.type === 'number').map(tok => (tok as NumberToken).index)

  const handleHintClick = useCallback(() => {
    if (hints.length === 0) { requestHint(); setHintsUsed(1) }
    setShowHints(true)
  }, [hints.length, requestHint, setHintsUsed])

  const handleRequestHint = useCallback(() => {
    requestHint()
    setHintsUsed(hints.length + 1)
  }, [hints.length, requestHint, setHintsUsed])

  const handleGiveUp = useCallback(() => {
    recordResult(levelIdRef.current, { correct: false, firstAttempt: false, hintsUsed: 99 }, 0)
    clearTokens(); resetHints(); nextPuzzle(0); setShowHints(false)
  }, [recordResult, clearTokens, resetHints, nextPuzzle])

  const handleSelectLevel = useCallback((id: string) => {
    setLevel(id); clearTokens(); resetHints(); setShowSettings(false)
  }, [setLevel, clearTokens, resetHints])

  const handleSetLanguage = useCallback((lang: 'de'|'en') => {
    setLanguage(lang); saveLanguage(lang)
  }, [saveLanguage])

  const solutionPreview = puzzle?.solutions[0] ? getSolutionPreview(puzzle.solutions[0]) : '?'

  // Show loading state while first puzzle is being generated
  if (!puzzle) {
    return (
      <div className={styles.board}>
        <Header
          levelId={levelId}
          pointStreak={progress.pointStreak}
          onSettingsClick={() => setShowSettings(true)}
          onHintClick={() => {}}
          onRulesClick={() => setShowRules(true)}
        />
        <div className={styles.loading}>👑</div>
        {showRules && <RulesPopover onClose={() => setShowRules(false)} />}
        {showSettings && (
          <SettingsScreen
            progress={progress}
            onSelectLevel={handleSelectLevel}
            onSetLanguage={handleSetLanguage}
            onReset={reset}
            onBack={() => setShowSettings(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className={`${styles.board} ${celebrate ? styles.celebrate : ''}`}>
      {showSettings && (
        <SettingsScreen
          progress={progress}
          onSelectLevel={handleSelectLevel}
          onSetLanguage={handleSetLanguage}
          onReset={reset}
          onBack={() => setShowSettings(false)}
        />
      )}
      {showHints && (
        <HintPopover
          hints={hints}
          hintsRemaining={hintsRemaining}
          solutionPreview={solutionPreview}
          onRequestHint={handleRequestHint}
          onGiveUp={handleGiveUp}
          onClose={() => setShowHints(false)}
        />
      )}
      {showRules && <RulesPopover onClose={() => setShowRules(false)} />}

      <Header
        levelId={levelId}
        pointStreak={progress.pointStreak}
        onSettingsClick={() => setShowSettings(true)}
        onHintClick={handleHintClick}
        onRulesClick={() => setShowRules(true)}
      />

      <NumberRow
        numbers={puzzle.numbers}
        usedIndices={usedIndices}
        onPress={(tok: NumberToken) => addToken(tok)}
      />

      <InputRow
        tokens={tokens}
        target={puzzle.target}
        status={status}
        warning={warning}
        onHintClick={handleHintClick}
        onClear={clearTokens}
      />

      <KeyPad
        level={level}
        onOperator={(tok: OperatorToken) => addToken(tok)}
        onBracket={(tok: BracketToken) => addToken(tok)}
        onDelete={deleteToken}
        onSubmit={() => submitSolution(hints.length)}
      />

      {status === 'correct' && (
        <div className={styles.banner}>
          {t('game.correct')}
          {progress.pointStreak >= 3 && <span> {t('game.streak_bonus')}</span>}
        </div>
      )}
    </div>
  )
}
