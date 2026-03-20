import { Puzzle } from '../models/Puzzle'

export interface Hint {
  level: 1 | 2 | 3
  textKey: string
  textParams: Record<string, unknown>
}

export interface IHintEngine {
  getHint(puzzle: Puzzle, hintLevel: 1 | 2 | 3): Hint
}

function parseExpr(expr: string): number {
  return Function('"use strict"; return (' + expr + ')')() as number
}

function extractSubExpressions(solution: string): string[] {
  const subExprs: string[] = []
  let depth = 0
  let start = -1
  for (let i = 0; i < solution.length; i++) {
    if (solution[i] === '(') {
      if (depth === 0) start = i
      depth++
    } else if (solution[i] === ')') {
      depth--
      if (depth === 0 && start !== -1) {
        subExprs.push(solution.slice(start + 1, i))
      }
    }
  }
  return subExprs
}

export class HintEngine implements IHintEngine {
  getHint(puzzle: Puzzle, hintLevel: 1 | 2 | 3): Hint {
    const solution = puzzle.solutions[0]

    try {
      if (hintLevel === 1) {
        // Find a useful intermediate value
        const subExprs = extractSubExpressions(solution)
        if (subExprs.length > 0) {
          const subExpr = subExprs[0]
          const value = Math.round(parseExpr(subExpr))
          return { level: 1, textKey: 'hint.intermediate_value', textParams: { value } }
        }
        // For simple expressions without brackets
        return { level: 1, textKey: 'hint.think_about_target', textParams: { target: puzzle.target } }
      }

      if (hintLevel === 2) {
        // Find two numbers used together
        const subExprs = extractSubExpressions(solution)
        if (subExprs.length > 0) {
          const nums = subExprs[0].match(/\d+/g)?.map(Number) ?? []
          if (nums.length >= 2) {
            return { level: 2, textKey: 'hint.look_at_numbers', textParams: { a: nums[0], b: nums[1] } }
          }
        }
        const nums = solution.match(/\d+/g)?.map(Number) ?? []
        return { level: 2, textKey: 'hint.look_at_numbers', textParams: { a: nums[0], b: nums[1] } }
      }

      if (hintLevel === 3) {
        // Find the key operator
        const ops = solution.match(/[+\-*/]/g) ?? []
        const opMap: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' }
        const op = opMap[ops[0]] ?? ops[0]
        return { level: 3, textKey: 'hint.try_operator', textParams: { operator: op } }
      }
    } catch {
      // fallback
    }

    return { level: hintLevel, textKey: 'hint.keep_trying', textParams: {} }
  }
}
