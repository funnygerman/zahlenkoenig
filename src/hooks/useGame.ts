import { useState, useCallback, useEffect, useRef } from 'react'
import { Token } from '../core/models/Token'
import { Puzzle } from '../core/models/Puzzle'
import { PuzzleValidator, SolutionResult } from '../core/services/PuzzleValidator'
import { PuzzleGenerator } from '../core/services/PuzzleGenerator'
import { ScoringService } from '../core/services/ScoringService'
import { getLevelById } from '../core/models/Level'
import { t } from '../i18n'

const validator = new PuzzleValidator()
const generator = new PuzzleGenerator()
const scorer = new ScoringService()

export type GameStatus = 'idle' | 'correct' | 'wrong'

interface UseGameOptions {
  levelId: string
  pointStreak: number
  onResult: (result: SolutionResult, newPointStreak: number) => void
}

export function useGame({ levelId, pointStreak, onResult }: UseGameOptions) {
  const level = getLevelById(levelId)
  const [puzzle, setPuzzle] = useState<Puzzle>(() => generator.generate(level))
  const [tokens, setTokens] = useState<Token[]>([])
  const [status, setStatus] = useState<GameStatus>('idle')
  const [warning, setWarning] = useState<string | null>(null)
  const [firstAttempt, setFirstAttempt] = useState(true)
  const [hintsUsed, setHintsUsed] = useState(0)
  const pointStreakRef = useRef(pointStreak)
  pointStreakRef.current = pointStreak

  // Regenerate when level changes
  useEffect(() => {
    generator.generateAsync(getLevelById(levelId)).then(p => {
      setPuzzle(p)
      setTokens([])
      setStatus('idle')
      setWarning(null)
      setFirstAttempt(true)
      setHintsUsed(0)
    })
  }, [levelId]) // eslint-disable-line react-hooks/exhaustive-deps

  const showWarning = useCallback((key: string) => {
    setWarning(t(key))
    setTimeout(() => setWarning(null), 1800)
  }, [])

  const addToken = useCallback((token: Token) => {
    const v = validator.validateToken(tokens, token)
    if (!v.valid && v.errorKey) { showWarning(v.errorKey); return }
    setTokens(prev => [...prev, token])
    setStatus('idle')
    setWarning(null)
  }, [tokens, showWarning])

  const deleteToken = useCallback(() => {
    setTokens(prev => prev.slice(0, -1))
    setStatus('idle')
    setWarning(null)
  }, [])

  const clearTokens = useCallback(() => {
    setTokens([])
    setStatus('idle')
    setWarning(null)
  }, [])

  const submitSolution = useCallback((currentHintsUsed: number) => {
    const result = validator.validateSolution(tokens, puzzle, firstAttempt, currentHintsUsed)
    if (!result.correct) {
      const usedCount = tokens.filter(t => t.type === 'number').length
      if (usedCount < puzzle.numbers.length) { showWarning('error.use_all_numbers'); return }
      setStatus('wrong')
      setFirstAttempt(false)
      return
    }
    const { newPointStreak } = scorer.calculate(result, pointStreakRef.current)
    setStatus('correct')
    onResult(result, newPointStreak)
  }, [tokens, puzzle, firstAttempt, onResult, showWarning])

  const nextPuzzle = useCallback((newHintsUsed = 0) => {
    generator.generateAsync(getLevelById(levelId)).then(p => {
      setPuzzle(p)
      setTokens([])
      setStatus('idle')
      setWarning(null)
      setFirstAttempt(true)
      setHintsUsed(newHintsUsed)
    })
  }, [levelId])

  return {
    puzzle, tokens, status, warning, hintsUsed, setHintsUsed,
    addToken, deleteToken, clearTokens, submitSolution, nextPuzzle,
  }
}
