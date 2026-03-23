import { Token } from '../models/Token'
import { Puzzle } from '../models/Puzzle'

export interface ValidationResult {
  valid: boolean
  errorKey: string | null
}

export interface SolutionResult {
  correct: boolean
  firstAttempt: boolean
  hintsUsed: number
}

export interface IPuzzleValidator {
  validateToken(tokens: Token[], newToken: Token): ValidationResult
  validateSolution(tokens: Token[], puzzle: Puzzle, firstAttempt: boolean, hintsUsed: number): SolutionResult
}

export class PuzzleValidator implements IPuzzleValidator {
  validateToken(tokens: Token[], newToken: Token): ValidationResult {
    const last = tokens[tokens.length - 1]

    if (newToken.type === 'number') {
      if (last && (last.type === 'number' || (last.type === 'bracket' && last.value === ')')))
        return { valid: false, errorKey: 'error.two_numbers_in_row' }
    }
    if (newToken.type === 'operator') {
      if (!last || last.type === 'operator' || (last.type === 'bracket' && last.value === '('))
        return { valid: false, errorKey: 'error.operator_needs_number' }
    }
    if (newToken.type === 'bracket' && newToken.value === '(') {
      if (last && (last.type === 'number' || (last.type === 'bracket' && last.value === ')')))
        return { valid: false, errorKey: 'error.bracket_not_allowed' }
    }
    if (newToken.type === 'bracket' && newToken.value === ')') {
      if (!last || (last.type !== 'number' && !(last.type === 'bracket' && last.value === ')')))
        return { valid: false, errorKey: 'error.bracket_not_allowed' }
      const open  = tokens.filter(t => t.type === 'bracket' && t.value === '(').length
      const close = tokens.filter(t => t.type === 'bracket' && t.value === ')').length
      if (close >= open) return { valid: false, errorKey: 'error.no_open_bracket' }
    }
    return { valid: true, errorKey: null }
  }

  validateSolution(tokens: Token[], puzzle: Puzzle, firstAttempt: boolean, hintsUsed: number): SolutionResult {
    const usedIndices = tokens.filter(t => t.type === 'number').map(t => (t as {type:'number';index:number}).index)
    const allUsed = puzzle.numbers.every((_, i) => usedIndices.includes(i)) && usedIndices.length === puzzle.numbers.length
    if (!allUsed) return { correct: false, firstAttempt, hintsUsed }

    const open  = tokens.filter(t => t.type === 'bracket' && t.value === '(').length
    const close = tokens.filter(t => t.type === 'bracket' && t.value === ')').length
    if (open !== close) return { correct: false, firstAttempt, hintsUsed }

    const expr = tokens.map(t => t.value).join('')
    try {
      const result = Function('"use strict"; return (' + expr + ')')() as number
      if (typeof result !== 'number' || !isFinite(result) || result < 0) return { correct: false, firstAttempt, hintsUsed }
      return { correct: Math.abs(result - puzzle.target) < 1e-9, firstAttempt, hintsUsed }
    } catch { return { correct: false, firstAttempt, hintsUsed } }
  }
}
