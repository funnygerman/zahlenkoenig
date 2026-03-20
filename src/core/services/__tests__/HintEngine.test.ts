import { describe, it, expect } from 'vitest'
import { HintEngine } from '../HintEngine'
import type { Puzzle } from '../../models/Puzzle'

const engine = new HintEngine()

const puzzle: Puzzle = {
  numbers: [3, 2, 5, 1],
  target: 20,
  solutions: ['3*(2+5)-1'],
  levelId: 'F2',
}

describe('HintEngine', () => {
  it('hint 1 returns an intermediate value', () => {
    const hint = engine.getHint(puzzle, 1)
    expect(hint.level).toBe(1)
    expect(hint.textKey).toBe('hint.intermediate_value')
    expect(hint.textParams.value).toBe(7) // 2+5 = 7
  })

  it('hint 2 returns the key pair of numbers', () => {
    const hint = engine.getHint(puzzle, 2)
    expect(hint.level).toBe(2)
    expect(hint.textKey).toBe('hint.look_at_numbers')
    expect([hint.textParams.a, hint.textParams.b]).toEqual(
      expect.arrayContaining([2, 5])
    )
  })

  it('hint 3 returns the key operator', () => {
    const hint = engine.getHint(puzzle, 3)
    expect(hint.level).toBe(3)
    expect(hint.textKey).toBe('hint.try_operator')
    expect(hint.textParams.operator).toBe('×') // * becomes ×
  })

  it('works for simple addition puzzle', () => {
    const simplePuzzle: Puzzle = {
      numbers: [3, 5],
      target: 8,
      solutions: ['3+5'],
      levelId: 'A1',
    }
    const hint = engine.getHint(simplePuzzle, 1)
    expect(hint.textParams.value).toBeDefined()
  })
})
