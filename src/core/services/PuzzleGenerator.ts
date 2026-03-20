import { Puzzle } from '../models/Puzzle'
import { Level, Operator } from '../models/Level'

export interface IPuzzleGenerator {
  generate(level: Level, customTarget?: number): Puzzle
}

function safeEval(expr: string): number | null {
  try {
    const result = Function('"use strict"; return (' + expr + ')')() as number
    return typeof result === 'number' && isFinite(result) ? result : null
  } catch {
    return null
  }
}

function permutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr]
  return arr.flatMap((v, i) =>
    permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map(p => [v, ...p])
  )
}

// Canonical form: for commutative ops, sort operands so a <= b lexicographically
function canonical(a: string, op: string, b: string): string {
  if (op === '+' || op === '*') {
    return [a, b].sort().join(op)
  }
  return `${a}${op}${b}`
}

function findSolutions2(nums: number[], target: number, ops: Operator[]): string[] {
  const seen = new Set<string>()
  const solutions: string[] = []

  for (const [a, b] of permutations(nums)) {
    for (const op of ops) {
      if (op === '/' && b === 0) continue
      const result = safeEval(`${a}${op}${b}`)
      if (result !== null && Math.abs(result - target) < 1e-9) {
        const key = canonical(String(a), op, String(b))
        if (!seen.has(key)) {
          seen.add(key)
          solutions.push(`${a}${op}${b}`)
        }
      }
    }
  }
  return solutions
}

function findSolutions3(nums: number[], target: number, ops: Operator[], maxBrackets: number): string[] {
  const seen = new Set<string>()
  const solutions: string[] = []

  for (const perm of permutations(nums)) {
    const [a, b, c] = perm
    for (const o1 of ops) {
      for (const o2 of ops) {
        // Without brackets: a o1 b o2 c
        if (maxBrackets === 0) {
          const expr = `${a}${o1}${b}${o2}${c}`
          const result = safeEval(expr)
          if (result !== null && Math.abs(result - target) < 1e-9) {
            const key = `${a}${o1}${b}${o2}${c}`
            if (!seen.has(key)) { seen.add(key); solutions.push(expr) }
          }
        }
        // With one bracket level
        if (maxBrackets >= 1) {
          const exprs = [
            `(${a}${o1}${b})${o2}${c}`,
            `${a}${o1}(${b}${o2}${c})`,
          ]
          for (const expr of exprs) {
            const result = safeEval(expr)
            if (result !== null && Math.abs(result - target) < 1e-9) {
              if (!seen.has(expr)) { seen.add(expr); solutions.push(expr) }
            }
          }
        }
      }
    }
  }
  return solutions
}

function findSolutions4(nums: number[], target: number, ops: Operator[], maxBrackets: number): string[] {
  const seen = new Set<string>()
  const solutions: string[] = []

  for (const perm of permutations(nums)) {
    const [a, b, c, d] = perm
    for (const o1 of ops) {
      for (const o2 of ops) {
        for (const o3 of ops) {
          const exprs: string[] = []

          if (maxBrackets === 0) {
            exprs.push(`${a}${o1}${b}${o2}${c}${o3}${d}`)
          }
          if (maxBrackets >= 1) {
            exprs.push(
              `(${a}${o1}${b})${o2}${c}${o3}${d}`,
              `${a}${o1}(${b}${o2}${c})${o3}${d}`,
              `${a}${o1}${b}${o2}(${c}${o3}${d})`,
              `(${a}${o1}${b}${o2}${c})${o3}${d}`,
              `${a}${o1}(${b}${o2}${c}${o3}${d})`,
            )
          }
          if (maxBrackets >= 2) {
            exprs.push(
              `(${a}${o1}${b})${o2}(${c}${o3}${d})`,
              `((${a}${o1}${b})${o2}${c})${o3}${d}`,
              `(${a}${o1}(${b}${o2}${c}))${o3}${d}`,
              `${a}${o1}((${b}${o2}${c})${o3}${d})`,
              `${a}${o1}(${b}${o2}(${c}${o3}${d}))`,
            )
          }

          for (const expr of exprs) {
            const result = safeEval(expr)
            if (result !== null && Math.abs(result - target) < 1e-9) {
              if (!seen.has(expr)) {
                seen.add(expr)
                solutions.push(expr)
                if (solutions.length > 30) return solutions
              }
            }
          }
        }
      }
    }
  }
  return solutions
}

function findSolutions(nums: number[], target: number, level: Level): string[] {
  switch (nums.length) {
    case 2: return findSolutions2(nums, target, level.operators)
    case 3: return findSolutions3(nums, target, level.operators, level.maxBracketDepth)
    case 4: return findSolutions4(nums, target, level.operators, level.maxBracketDepth)
    default: return []
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export class PuzzleGenerator implements IPuzzleGenerator {
  generate(level: Level, customTarget?: number): Puzzle {
    const maxTarget = Math.min(level.maxTarget, 500)
    const targetMin = level.targetRange.min
    const targetMax = Math.min(level.targetRange.max, maxTarget)

    // Try strict: 1–3 solutions
    for (let attempt = 0; attempt < 500; attempt++) {
      const numbers = Array.from({ length: level.numberCount }, () => randomInt(1, 9))
      const target = customTarget ?? randomInt(targetMin, targetMax)
      const solutions = findSolutions(numbers, target, level)
      if (solutions.length >= 1 && solutions.length <= 3) {
        return { numbers, target, solutions, levelId: level.id }
      }
    }

    // Fallback: relax to 1–5 solutions
    for (let attempt = 0; attempt < 200; attempt++) {
      const numbers = Array.from({ length: level.numberCount }, () => randomInt(1, 9))
      const target = customTarget ?? randomInt(targetMin, targetMax)
      const solutions = findSolutions(numbers, target, level)
      if (solutions.length >= 1 && solutions.length <= 5) {
        return { numbers, target, solutions, levelId: level.id }
      }
    }

    // Last resort: predefined puzzles per level
    return this.getFallbackPuzzle(level)
  }

  private getFallbackPuzzle(level: Level): Puzzle {
    const fallbacks: Record<string, Puzzle> = {
      A1: { numbers: [3, 7],       target: 10, solutions: ['3+7'],           levelId: 'A1' },
      A2: { numbers: [8, 5],       target: 13, solutions: ['8+5'],           levelId: 'A2' },
      A3: { numbers: [2, 5, 3],    target: 10, solutions: ['2+5+3'],         levelId: 'A3' },
      A4: { numbers: [1, 2, 3, 4], target: 10, solutions: ['1+2+3+4'],       levelId: 'A4' },
      F1: { numbers: [3, 7],       target: 21, solutions: ['3*7'],           levelId: 'F1' },
      F2: { numbers: [2, 3, 4],    target: 14, solutions: ['2*(3+4)'],       levelId: 'F2' },
      F3: { numbers: [2, 3, 4, 5], target: 14, solutions: ['2*(3+4)-5+5'],  levelId: 'F3' },
      E1: { numbers: [2, 3, 5],    target: 16, solutions: ['2*(3+5)'],       levelId: 'E1' },
      E2: { numbers: [2, 3, 4, 5], target: 14, solutions: ['(2+5)*(3-1)'],  levelId: 'E2' },
    }
    return fallbacks[level.id] ?? fallbacks['A1']
  }
}
