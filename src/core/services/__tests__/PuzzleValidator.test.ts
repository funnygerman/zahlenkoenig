import { describe, it, expect } from 'vitest'
import { PuzzleValidator } from '../PuzzleValidator'
import type { Token } from '../../models/Token'
import type { Puzzle } from '../../models/Puzzle'

const validator = new PuzzleValidator()

const num = (value: number, index: number): Token => ({ type: 'number', value, index })
const op  = (value: '+' | '-' | '*' | '/'): Token => ({ type: 'operator', value })
const br  = (value: '(' | ')'): Token => ({ type: 'bracket', value })

describe('validateToken – numbers', () => {
  it('allows first number', () => {
    expect(validator.validateToken([], num(3, 0)).valid).toBe(true)
  })
  it('rejects number after number', () => {
    const result = validator.validateToken([num(3, 0)], num(5, 1))
    expect(result.valid).toBe(false)
    expect(result.errorKey).toBe('error.two_numbers_in_row')
  })
  it('allows number after operator', () => {
    expect(validator.validateToken([num(3, 0), op('+')], num(5, 1)).valid).toBe(true)
  })
  it('allows number after opening bracket', () => {
    expect(validator.validateToken([br('(')], num(3, 0)).valid).toBe(true)
  })
  it('rejects number after closing bracket', () => {
    const tokens: Token[] = [br('('), num(3, 0), op('+'), num(2, 1), br(')')]
    expect(validator.validateToken(tokens, num(5, 2)).valid).toBe(false)
  })
})

describe('validateToken – operators', () => {
  it('rejects operator at start', () => {
    expect(validator.validateToken([], op('+')).valid).toBe(false)
    expect(validator.validateToken([], op('+')).errorKey).toBe('error.operator_needs_number')
  })
  it('allows operator after number', () => {
    expect(validator.validateToken([num(3, 0)], op('+')).valid).toBe(true)
  })
  it('allows operator after closing bracket', () => {
    const tokens: Token[] = [br('('), num(3, 0), op('+'), num(2, 1), br(')')]
    expect(validator.validateToken(tokens, op('*')).valid).toBe(true)
  })
})

describe('validateToken – brackets', () => {
  it('allows opening bracket at start', () => {
    expect(validator.validateToken([], br('(')).valid).toBe(true)
  })
  it('allows opening bracket after operator', () => {
    expect(validator.validateToken([num(3, 0), op('+')], br('(')).valid).toBe(true)
  })
  it('rejects opening bracket after number', () => {
    expect(validator.validateToken([num(3, 0)], br('(')).valid).toBe(false)
  })
  it('rejects closing bracket without open bracket', () => {
    const result = validator.validateToken([num(3, 0), op('+'), num(2, 1)], br(')'))
    expect(result.valid).toBe(false)
    expect(result.errorKey).toBe('error.no_open_bracket')
  })
  it('allows closing bracket after number with open bracket', () => {
    const tokens: Token[] = [br('('), num(3, 0), op('+'), num(2, 1)]
    expect(validator.validateToken(tokens, br(')')).valid).toBe(true)
  })
})

describe('validateSolution', () => {
  const puzzle: Puzzle = {
    numbers: [3, 5],
    target: 8,
    solutions: ['3+5'],
    levelId: 'A1',
  }

  it('accepts correct solution', () => {
    const tokens: Token[] = [num(3, 0), op('+'), num(5, 1)]
    const result = validator.validateSolution(tokens, puzzle, false, 0)
    expect(result.correct).toBe(true)
    expect(result.firstAttempt).toBe(true)
  })

  it('rejects wrong result', () => {
    const tokens: Token[] = [num(3, 0), op('+'), num(5, 1)]
    const wrongPuzzle = { ...puzzle, target: 10 }
    const result = validator.validateSolution(tokens, wrongPuzzle, false, 0)
    expect(result.correct).toBe(false)
  })

  it('rejects when not all numbers used', () => {
    const tokens: Token[] = [num(3, 0), op('+'), num(3, 0)] // index 1 not used
    const result = validator.validateSolution(tokens, puzzle, false, 0)
    expect(result.correct).toBe(false)
  })

  it('tracks firstAttempt correctly', () => {
    const tokens: Token[] = [num(3, 0), op('+'), num(5, 1)]
    const result = validator.validateSolution(tokens, puzzle, true, 0)
    expect(result.firstAttempt).toBe(false)
  })
})
