import { Puzzle } from '../models/Puzzle'
import { Level, Operator } from '../models/Level'

// ── Puzzle bank ───────────────────────────────────────────────────────────────
const puzzleBank: Record<string, Puzzle[]> = {}
const bankLoaded: Record<string, boolean> = {}
// Per-level index tracker to avoid repeats until all puzzles are seen
const bankIndices: Record<string, number[]> = {}

async function loadBank(levelId: string): Promise<void> {
  if (bankLoaded[levelId]) return
  try {
    const module = await import(`../../data/puzzles-${levelId}.json`)
    const puzzles = module.default as Puzzle[]
    puzzleBank[levelId] = puzzles
    // Create shuffled index array
    bankIndices[levelId] = shuffledIndices(puzzles.length)
  } catch {
    // No bank available – fall back to live generation
  }
  bankLoaded[levelId] = true
}

function shuffledIndices(length: number): number[] {
  const arr = Array.from({ length }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function pickFromBank(levelId: string, customTarget?: number): Puzzle | null {
  const bank = puzzleBank[levelId]
  if (!bank || bank.length === 0) return null

  if (customTarget !== undefined) {
    const matching = bank.filter(p => p.target === customTarget)
    if (matching.length > 0) return matching[Math.floor(Math.random() * matching.length)]
    return null
  }

  // Use index tracker for no-repeat shuffled order
  const indices = bankIndices[levelId]
  if (!indices || indices.length === 0) {
    // All puzzles seen – reshuffle and start again
    bankIndices[levelId] = shuffledIndices(bank.length)
    return bank[bankIndices[levelId].pop()!]
  }
  return bank[indices.pop()!]
}

// ── Live generation (fallback) ────────────────────────────────────────────────
export interface IPuzzleGenerator {
  generate(level: Level, customTarget?: number): Puzzle
  generateAsync(level: Level, customTarget?: number): Promise<Puzzle>
}

function safeEval(expr: string): number | null {
  try {
    const result = Function('"use strict"; return (' + expr + ')')() as number
    if (typeof result !== 'number' || !isFinite(result)) return null
    if (Math.abs(result - Math.round(result)) > 1e-9) return null
    return Math.round(result)
  } catch { return null }
}

function permutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr]
  return arr.flatMap((v, i) =>
    permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map(p => [v, ...p])
  )
}

function findSolutions2(nums: number[], target: number, ops: Operator[]): string[] {
  const seen = new Set<string>(), solutions: string[] = []
  for (const [a, b] of permutations(nums)) {
    for (const op of ops) {
      if (op === '/' && b === 0) continue
      const r = safeEval(`${a}${op}${b}`)
      if (r === target) {
        const key = op === '+' || op === '*' ? [String(a), String(b)].sort().join(op) : `${a}${op}${b}`
        if (!seen.has(key)) { seen.add(key); solutions.push(`${a}${op}${b}`) }
      }
    }
  }
  return solutions
}

function findSolutions3(nums: number[], target: number, ops: Operator[], maxBrackets: number): string[] {
  const seen = new Set<string>(), solutions: string[] = []
  for (const [a, b, c] of permutations(nums)) {
    for (const o1 of ops) for (const o2 of ops) {
      const exprs = [`${a}${o1}${b}${o2}${c}`]
      if (maxBrackets >= 1) exprs.push(`(${a}${o1}${b})${o2}${c}`, `${a}${o1}(${b}${o2}${c})`)
      for (const e of exprs) { const r = safeEval(e); if (r === target && !seen.has(e)) { seen.add(e); solutions.push(e) } }
    }
  }
  return solutions
}

function findSolutions4(nums: number[], target: number, ops: Operator[], maxBrackets: number): string[] {
  const seen = new Set<string>(), solutions: string[] = []
  for (const [a, b, c, d] of permutations(nums)) {
    for (const o1 of ops) for (const o2 of ops) for (const o3 of ops) {
      const exprs: string[] = [`${a}${o1}${b}${o2}${c}${o3}${d}`]
      if (maxBrackets >= 1) exprs.push(
        `(${a}${o1}${b})${o2}${c}${o3}${d}`, `${a}${o1}(${b}${o2}${c})${o3}${d}`,
        `${a}${o1}${b}${o2}(${c}${o3}${d})`, `(${a}${o1}${b}${o2}${c})${o3}${d}`,
        `${a}${o1}(${b}${o2}${c}${o3}${d})`,
      )
      if (maxBrackets >= 2) exprs.push(
        `(${a}${o1}${b})${o2}(${c}${o3}${d})`, `((${a}${o1}${b})${o2}${c})${o3}${d}`,
        `(${a}${o1}(${b}${o2}${c}))${o3}${d}`, `${a}${o1}((${b}${o2}${c})${o3}${d})`,
        `${a}${o1}(${b}${o2}(${c}${o3}${d}))`,
      )
      for (const e of exprs) {
        const r = safeEval(e)
        if (r === target && !seen.has(e)) { seen.add(e); solutions.push(e); if (solutions.length > 30) return solutions }
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

function generateLive(level: Level, customTarget?: number): Puzzle {
  const targetMin = level.targetRange.min
  const targetMax = Math.min(level.targetRange.max, Math.min(level.maxTarget, 500))

  for (let i = 0; i < 500; i++) {
    const numbers = Array.from({ length: level.numberCount }, () => randomInt(1, 9))
    const target = customTarget ?? randomInt(targetMin, targetMax)
    const solutions = findSolutions(numbers, target, level)
    if (solutions.length >= 1 && solutions.length <= 3) return { numbers, target, solutions, levelId: level.id }
  }
  for (let i = 0; i < 200; i++) {
    const numbers = Array.from({ length: level.numberCount }, () => randomInt(1, 9))
    const target = customTarget ?? randomInt(targetMin, targetMax)
    const solutions = findSolutions(numbers, target, level)
    if (solutions.length >= 1 && solutions.length <= 5) return { numbers, target, solutions, levelId: level.id }
  }
  return getFallbackPuzzle(level)
}

function getFallbackPuzzle(level: Level): Puzzle {
  const fallbacks: Record<string, Puzzle> = {
    A1: { numbers: [3, 7],       target: 10, solutions: ['3+7'],          levelId: 'A1' },
    A2: { numbers: [2, 5, 3],    target: 10, solutions: ['2+5+3'],        levelId: 'A2' },
    A3: { numbers: [1, 2, 3, 4], target: 10, solutions: ['1+2+3+4'],      levelId: 'A3' },
    F1: { numbers: [3, 7],       target: 21, solutions: ['3*7'],          levelId: 'F1' },
    F2: { numbers: [2, 3, 4],    target: 14, solutions: ['2*(3+4)'],      levelId: 'F2' },
    F3: { numbers: [2, 3, 4, 5], target: 19, solutions: ['(2+3)*4-1'],   levelId: 'F3' },
    E1: { numbers: [2, 3, 4, 5], target: 14, solutions: ['(2+5)*(3-1)'], levelId: 'E1' },
  }
  return fallbacks[level.id] ?? fallbacks['F2']
}

// ── Public API ────────────────────────────────────────────────────────────────
export class PuzzleGenerator implements IPuzzleGenerator {
  generate(level: Level, customTarget?: number): Puzzle {
    const banked = pickFromBank(level.id, customTarget)
    if (banked) return banked
    return generateLive(level, customTarget)
  }

  async generateAsync(level: Level, customTarget?: number): Promise<Puzzle> {
    await loadBank(level.id)
    const banked = pickFromBank(level.id, customTarget)
    if (banked) return banked
    return generateLive(level, customTarget)
  }
}
