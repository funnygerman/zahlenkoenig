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
      // Wrong answer: streak stays (per spec - mistakes are ok, only hints break streak)
      return { points: 0, newPointStreak: pointStreak }
    }

    // Correct with hints: no streak progress, reduced points
    if (result.hintsUsed > 0) {
      return { points: 5, newPointStreak: 0 }
    }

    // Correct after wrong attempt(s), no hints: reduced points, no streak
    if (!result.firstAttempt) {
      return { points: 5, newPointStreak: 0 }
    }

    // Perfect: first attempt, no hints → build streak
    const newStreak = pointStreak + 1
    const points = newStreak >= 3 ? 20 : 10
    return { points, newPointStreak: newStreak }
  }
}
