import { Puzzle } from '../models/Puzzle'
import { Level, Operator } from '../models/Level'

export interface IPuzzleGenerator {
  generate(level: Level, customTarget?: number): Puzzle
}

type ExprTree =
  | { type: 'num'; value: number; idx: number }
  | { type: 'op'; op: Operator; left: ExprTree; right: ExprTree }

function evalTree(tree: ExprTree): number | null {
  if (tree.type === 'num') return tree.value
  const l = evalTree(tree.left)
  const r = evalTree(tree.right)
  if (l === null || r === null) return null
  if (tree.op === '/' && r === 0) return null
  switch (tree.op) {
    case '+': return l + r
    case '-': return l - r
    case '*': return l * r
    case '/': return l / r
  }
}

function treeToExpr(tree: ExprTree): string {
  if (tree.type === 'num') return String(tree.value)
  const l = treeToExpr(tree.left)
  const r = treeToExpr(tree.right)
  // Canonicalize commutative ops: sort operands alphabetically
  if (tree.op === '+' || tree.op === '*') {
    const [a, b] = [l, r].sort()
    return `(${a}${tree.op}${b})`
  }
  return `(${l}${tree.op}${r})`
}

function* buildTrees(nums: { value: number; idx: number }[], ops: Operator[]): Generator<ExprTree> {
  if (nums.length === 1) {
    yield { type: 'num', value: nums[0].value, idx: nums[0].idx }
    return
  }
  for (let i = 0; i < nums.length; i++) {
    const rest = nums.filter((_, j) => j !== i)
    for (const subtree of buildTrees(rest, ops)) {
      for (const op of ops) {
        yield { type: 'op', op, left: { type: 'num', value: nums[i].value, idx: nums[i].idx }, right: subtree }
        yield { type: 'op', op, left: subtree, right: { type: 'num', value: nums[i].value, idx: nums[i].idx } }
      }
    }
  }
}

function countBracketDepth(expr: string): number {
  let max = 0, cur = 0
  for (const c of expr) {
    if (c === '(') { cur++; max = Math.max(max, cur) }
    if (c === ')') cur--
  }
  return max
}

function findSolutions(numbers: number[], target: number, level: Level): string[] {
  const nums = numbers.map((value, idx) => ({ value, idx }))
  const seen = new Set<string>()
  const solutions: string[] = []

  for (const tree of buildTrees(nums, level.operators)) {
    const result = evalTree(tree)
    if (result === null || Math.abs(result - target) > 1e-9) continue
    const expr = treeToExpr(tree)
    if (seen.has(expr)) continue
    if (countBracketDepth(expr) > level.maxBracketDepth) continue
    seen.add(expr)
    solutions.push(expr)
    if (solutions.length > 25) break
  }
  return solutions
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export class PuzzleGenerator implements IPuzzleGenerator {
  generate(level: Level, customTarget?: number): Puzzle {
    const maxTarget = Math.min(level.maxTarget, 500)

    // Try strict: 1–3 solutions
    for (let attempt = 0; attempt < 800; attempt++) {
      const numbers = Array.from({ length: level.numberCount }, () => randomInt(1, 9))
      const target = customTarget ?? randomInt(level.targetRange.min, Math.min(level.targetRange.max, maxTarget))
      const solutions = findSolutions(numbers, target, level)
      if (solutions.length >= 1 && solutions.length <= 3) {
        return { numbers, target, solutions, levelId: level.id }
      }
    }

    // Fallback: relax to 1–5 solutions
    for (let attempt = 0; attempt < 200; attempt++) {
      const numbers = Array.from({ length: level.numberCount }, () => randomInt(1, 9))
      const target = customTarget ?? randomInt(level.targetRange.min, Math.min(level.targetRange.max, maxTarget))
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
      A1: { numbers: [3, 7],       target: 10, solutions: ['(3+7)'],         levelId: 'A1' },
      A2: { numbers: [8, 5],       target: 13, solutions: ['(5+8)'],         levelId: 'A2' },
      A3: { numbers: [2, 5, 3],    target: 10, solutions: ['(2+3+5)'],       levelId: 'A3' },
      A4: { numbers: [1, 2, 3, 4], target: 10, solutions: ['(1+2+3+4)'],     levelId: 'A4' },
      F1: { numbers: [3, 7],       target: 21, solutions: ['(3*7)'],         levelId: 'F1' },
      F2: { numbers: [2, 3, 4],    target: 14, solutions: ['(2*(3+4))'],     levelId: 'F2' },
      F3: { numbers: [2, 3, 4, 5], target: 19, solutions: ['(2+3+4+5+5)'],  levelId: 'F3' },
      E1: { numbers: [2, 3, 5],    target: 16, solutions: ['(2*(3+5))'],     levelId: 'E1' },
      E2: { numbers: [2, 3, 4, 5], target: 14, solutions: ['((2+5)*(3-1))'], levelId: 'E2' },
    }
    return fallbacks[level.id] ?? fallbacks['A1']
  }
}
