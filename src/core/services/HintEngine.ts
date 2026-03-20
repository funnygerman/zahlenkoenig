import { Puzzle } from '../models/Puzzle'

export interface Hint {
  level: 1 | 2 | 3
  textKey: string
  textParams: Record<string, unknown>
}

export interface IHintEngine {
  getHint(puzzle: Puzzle, hintLevel: 1 | 2 | 3): Hint
}

function safeEval(expr: string): number | null {
  try {
    const result = Function('"use strict"; return (' + expr + ')')() as number
    return typeof result === 'number' && isFinite(result) ? Math.round(result) : null
  } catch {
    return null
  }
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

// Split a flat expression like "2+3+4" into parts by operators
function splitByOperator(expr: string): { left: string; op: string; right: string } | null {
  // Find last operator that's not inside brackets
  let depth = 0
  for (let i = expr.length - 1; i >= 0; i--) {
    const c = expr[i]
    if (c === ')') depth++
    else if (c === '(') depth--
    else if (depth === 0 && '+-*/'.includes(c) && i > 0) {
      return {
        left: expr.slice(0, i),
        op: c,
        right: expr.slice(i + 1),
      }
    }
  }
  return null
}


// Returns the beginning of the solution as a preview (first ~4 chars + ...)
export function getSolutionPreview(solution: string): string {
  if (!solution) return '?'
  // Include leading bracket if present, then first number
  // e.g. "(8-5)*3" → "(8..." , "3*(2+5)" → "3*..."
  let preview = ''
  let i = 0
  // Include optional opening bracket
  if (solution[0] === '(') { preview += '('; i++ }
  // Include first number
  while (i < solution.length && /[0-9]/.test(solution[i])) {
    preview += solution[i++]
  }
  // Include next operator if present
  if (i < solution.length && '+-*/'.includes(solution[i])) {
    preview += solution[i++]
  }
  return preview + '…'
}

export class HintEngine implements IHintEngine {
  getHint(puzzle: Puzzle, hintLevel: 1 | 2 | 3): Hint {
    const solution = puzzle.solutions[0]
    if (!solution) {
      return { level: hintLevel, textKey: 'hint.keep_trying', textParams: {} }
    }

    try {
      if (hintLevel === 1) {
        // Try to find a useful intermediate value from brackets
        const subExprs = extractSubExpressions(solution)
        if (subExprs.length > 0) {
          const value = safeEval(subExprs[0])
          if (value !== null) {
            return { level: 1, textKey: 'hint.intermediate_value', textParams: { value } }
          }
        }

        // No brackets: find intermediate value by evaluating first two numbers
        const split = splitByOperator(solution)
        if (split) {
          const leftVal = safeEval(split.left)
          if (leftVal !== null) {
            return { level: 1, textKey: 'hint.intermediate_value', textParams: { value: leftVal } }
          }
        }

        // Fallback: hint about the target
        return { level: 1, textKey: 'hint.think_about_target', textParams: { target: puzzle.target } }
      }

      if (hintLevel === 2) {
        // Find two numbers that belong together
        const subExprs = extractSubExpressions(solution)
        const source = subExprs.length > 0 ? subExprs[0] : solution
        const nums = source.match(/\d+/g)?.map(Number) ?? []
        if (nums.length >= 2) {
          return { level: 2, textKey: 'hint.look_at_numbers', textParams: { a: nums[0], b: nums[1] } }
        }
        // Only one number in subexpr – use first two from full solution
        const allNums = solution.match(/\d+/g)?.map(Number) ?? []
        return { level: 2, textKey: 'hint.look_at_numbers', textParams: { a: allNums[0] ?? '?', b: allNums[1] ?? '?' } }
      }

      if (hintLevel === 3) {
        // Find the key operator – prefer * or / as they're less obvious
        const ops = solution.match(/[+\-*/]/g) ?? []
        const opMap: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' }
        const keyOp = ops.find(o => o === '*' || o === '/') ?? ops[0] ?? '+'
        return { level: 3, textKey: 'hint.try_operator', textParams: { operator: opMap[keyOp] ?? keyOp } }
      }
    } catch {
      // fallback below
    }

    return { level: hintLevel, textKey: 'hint.keep_trying', textParams: {} }
  }
}
