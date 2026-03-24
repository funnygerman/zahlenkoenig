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
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [tokens, setTokens] = useState<Token[]>([])
  const [status, setStatus] = useState<GameStatus>('idle')
  const [warning, setWarning] = useState<string | null>(null)
  const [firstAttempt, setFirstAttempt] = useState(true)
  const [hintsUsed, setHintsUsed] = useState(0)

  const pointStreakRef = useRef(pointStreak)
  pointStreakRef.current = pointStreak

  const genCountRef = useRef(0)

  useEffect(() => {
    // Immediately clear puzzle and tokens so UI shows loading state
    // and no stale input is possible during load
    setPuzzle(null)
    setTokens([])
    setStatus('idle')
    setWarning(null)
    setFirstAttempt(true)
    setHintsUsed(0)

    const myGen = ++genCountRef.current
    generator.generateAsync(getLevelById(levelId)).then(p => {
      if (myGen !== genCountRef.current) return
      setPuzzle(p)
    })
  }, [levelId])

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
    if (!puzzle) return
    const result = validator.validateSolution(tokens, puzzle, firstAttempt, currentHintsUsed)
    if (!result.correct) {
      const usedCount = tokens.filter(tok => tok.type === 'number').length
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
    setPuzzle(null)
    setTokens([])
    setStatus('idle')
    setWarning(null)
    setFirstAttempt(true)
    setHintsUsed(newHintsUsed)

    const myGen = ++genCountRef.current
    generator.generateAsync(getLevelById(levelId)).then(p => {
      if (myGen !== genCountRef.current) return
      setPuzzle(p)
    })
  }, [levelId])

  return {
    puzzle, tokens, status, warning, hintsUsed, setHintsUsed,
    addToken, deleteToken, clearTokens, submitSolution, nextPuzzle,
  }
}
