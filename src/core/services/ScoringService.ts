import { SolutionResult } from './PuzzleValidator'

export interface ScoreResult {
  newPointStreak: number
}

export class ScoringService {
  calculate(result: SolutionResult, pointStreak: number): ScoreResult {
    if (!result.correct) return { newPointStreak: pointStreak } // mistakes don't break streak
    if (result.hintsUsed > 0 || !result.firstAttempt) return { newPointStreak: 0 }
    return { newPointStreak: pointStreak + 1 }
  }
}
