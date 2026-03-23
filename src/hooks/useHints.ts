import { useState, useCallback, useEffect } from 'react'
import { Puzzle } from '../core/models/Puzzle'
import { Hint, HintEngine } from '../core/services/HintEngine'
import { getLevelById } from '../core/models/Level'

const engine = new HintEngine()

const maxHintsPerGroup: Record<string, number> = {
  beginner: 1, advanced: 2, expert: 3,
}

export function useHints(puzzle: Puzzle) {
  const [hints, setHints] = useState<Hint[]>([])
  const level = getLevelById(puzzle.levelId)
  const maxHints = maxHintsPerGroup[level.group] ?? 1
  const hintsRemaining = maxHints - hints.length

  // Reset when puzzle changes (use stable key)
  const puzzleKey = `${puzzle.levelId}-${puzzle.target}-${puzzle.numbers.join(',')}`
  useEffect(() => { setHints([]) }, [puzzleKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const requestHint = useCallback(() => {
    if (hints.length >= maxHints) return
    const hint = engine.getHint(puzzle, (hints.length + 1) as 1|2|3)
    setHints(prev => [...prev, hint])
  }, [hints, maxHints, puzzle])

  const resetHints = useCallback(() => setHints([]), [])

  return { hints, hintsRemaining, maxHints, requestHint, resetHints }
}
