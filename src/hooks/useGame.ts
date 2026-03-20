import { useState, useCallback } from 'react'
import { Token } from '../core/models/Token'
import { Puzzle } from '../core/models/Puzzle'
import { GameStatus } from '../core/models/GameState'
import { PuzzleValidator, SolutionResult } from '../core/services/PuzzleValidator'
import { PuzzleGenerator } from '../core/services/PuzzleGenerator'
import { ScoringService } from '../core/services/ScoringService'
import { getLevelById } from '../core/models/Level'
import { t } from '../i18n'

const validator = new PuzzleValidator()
const generator = new PuzzleGenerator()
const scorer = new ScoringService()

interface UseGameOptions {
  levelId: string
  customTarget?: number
  pointStreak: number
  onResult: (result: SolutionResult, points: number, newPointStreak: number) => void
}

export function useGame({ levelId, customTarget, pointStreak, onResult }: UseGameOptions) {
  const level = getLevelById(levelId)

  const [puzzle, setPuzzle] = useState<Puzzle>(() => generator.generate(level, customTarget))
  const [tokens, setTokens] = useState<Token[]>([])
  const [status, setStatus] = useState<GameStatus>('idle')
  const [warning, setWarning] = useState<string | null>(null)
  const [firstAttempt, setFirstAttempt] = useState(true)
  const [hintsUsed, setHintsUsed] = useState(0)

  const showWarning = useCallback((key: string) => {
    setWarning(t(key as Parameters<typeof t>[0]))
    setTimeout(() => setWarning(null), 1800)
  }, [])

  const addToken = useCallback((token: Token) => {
    const validation = validator.validateToken(tokens, token)
    if (!validation.valid && validation.errorKey) {
      showWarning(validation.errorKey)
      return
    }
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
      // Check if all numbers are used
      const usedCount = tokens.filter(t => t.type === 'number').length
      if (usedCount < puzzle.numbers.length) {
        showWarning('error.use_all_numbers')
        return
      }
      setStatus('wrong')
      setFirstAttempt(false)
      return
    }

    const scoreResult = scorer.calculate(result, pointStreak)
    setStatus('correct')
    onResult(result, scoreResult.points, scoreResult.newPointStreak)
  }, [tokens, puzzle, firstAttempt, pointStreak, onResult, showWarning])

  const nextPuzzle = useCallback((newHintsUsed?: number) => {
    const newPuzzle = generator.generate(level, customTarget)
    setPuzzle(newPuzzle)
    setTokens([])
    setStatus('idle')
    setWarning(null)
    setFirstAttempt(true)
    setHintsUsed(newHintsUsed ?? 0)
  }, [level, customTarget])

  return {
    puzzle,
    tokens,
    status,
    warning,
    hintsUsed,
    setHintsUsed,
    addToken,
    deleteToken,
    clearTokens,
    submitSolution,
    nextPuzzle,
  }
}
