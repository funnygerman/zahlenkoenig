import { SolutionResult } from './PuzzleValidator'

export interface ScoreResult {
  points: number
  newPointStreak: number
}

export interface IScoringService {
  calculate(result: SolutionResult, pointStreak: number): ScoreResult
}

export class ScoringService implements IScoringService {
  calculate(result: SolutionResult, pointStreak: number): ScoreResult {
    if (!result.correct) {
      return { points: 0, newPointStreak: 0 }
    }

    // Correct with hints used
    if (result.hintsUsed > 0) {
      return { points: 5, newPointStreak: 0 }
    }

    // Correct after wrong attempt(s)
    if (!result.firstAttempt) {
      return { points: 5, newPointStreak: 0 }
    }

    // Perfect: first attempt, no hints
    const newStreak = pointStreak + 1
    const points = newStreak >= 3 ? 20 : 10
    return { points, newPointStreak: newStreak }
  }
}
