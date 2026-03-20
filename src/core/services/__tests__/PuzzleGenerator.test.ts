import { describe, it, expect } from 'vitest'
import { PuzzleGenerator, canonicalize, permutations } from '../PuzzleGenerator'
import { LEVELS } from '../../models/Level'

const gen = new PuzzleGenerator()

describe('canonicalize', () => {
  it('normalises commutative addition', () => {
    expect(canonicalize('5+3')).toBe(canonicalize('3+5'))
  })
  it('normalises commutative multiplication', () => {
    expect(canonicalize('5*3')).toBe(canonicalize('3*5'))
  })
  it('does NOT normalise subtraction', () => {
    expect(canonicalize('5-3')).not.toBe(canonicalize('3-5'))
  })
  it('handles bracketed expressions', () => {
    expect(canonicalize('(2+5)*3')).toBe(canonicalize('3*(5+2)'))
  })
})

describe('permutations', () => {
  it('returns n! permutations', () => {
    expect(permutations([1, 2, 3])).toHaveLength(6)
  })
  it('handles single element', () => {
    expect(permutations([1])).toEqual([[1]])
  })
})

describe('PuzzleGenerator', () => {
  it('generates a valid A1 puzzle', () => {
    const puzzle = gen.generate(LEVELS.A1)
    expect(puzzle.numbers).toHaveLength(2)
    expect(puzzle.solutions.length).toBeGreaterThanOrEqual(1)
    expect(puzzle.solutions.length).toBeLessThanOrEqual(5)
    expect(puzzle.target).toBeGreaterThanOrEqual(0)
    expect(puzzle.levelId).toBe('A1')
  })

  it('generates a valid E2 puzzle', () => {
    const puzzle = gen.generate(LEVELS.E2)
    expect(puzzle.numbers).toHaveLength(4)
    expect(puzzle.target).toBeGreaterThanOrEqual(0)
  })

  it('respects custom target', () => {
    const puzzle = gen.generate(LEVELS.F2, 10)
    expect(puzzle.target).toBe(10)
  })

  it('solutions actually evaluate to target', () => {
    const puzzle = gen.generate(LEVELS.F3)
    for (const sol of puzzle.solutions) {
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${sol})`)() as number
      expect(Math.abs(result - puzzle.target)).toBeLessThan(1e-9)
    }
  })

  it('has no duplicate solutions', () => {
    const puzzle = gen.generate(LEVELS.A4)
    const unique = new Set(puzzle.solutions)
    expect(unique.size).toBe(puzzle.solutions.length)
  })
})
