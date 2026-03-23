import { Puzzle } from '../models/Puzzle'
import { Level, Operator } from '../models/Level'

// Bank storage
const puzzleBank: Record<string, Puzzle[]> = {}
const bankLoaded: Record<string, boolean> = {}
const bankIndices: Record<string, number[]> = {}

function bankFileName(levelId: string): string {
  // F2.1 → puzzles-F2-1, A1 → puzzles-A1
  return `puzzles-${levelId.replace('.', '-')}`
}

async function loadBank(levelId: string): Promise<void> {
  if (bankLoaded[levelId]) return
  try {
    const name = bankFileName(levelId)
    const module = await import(`../../data/${name}.json`)
    const puzzles = module.default as Puzzle[]
    puzzleBank[levelId] = puzzles
    bankIndices[levelId] = shuffled(puzzles.length)
  } catch { /* no bank – fall back to live */ }
  bankLoaded[levelId] = true
}

function shuffled(length: number): number[] {
  const arr = Array.from({ length }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function pickFromBank(levelId: string): Puzzle | null {
  const bank = puzzleBank[levelId]
  if (!bank || bank.length === 0) return null
  if (!bankIndices[levelId] || bankIndices[levelId].length === 0) {
    bankIndices[levelId] = shuffled(bank.length) // reshuffle when exhausted
  }
  return bank[bankIndices[levelId].pop()!]
}

// Live generation helpers
function safeEval(expr: string): number | null {
  try {
    const r = Function('"use strict"; return (' + expr + ')')() as number
    if (typeof r !== 'number' || !isFinite(r)) return null
    if (Math.abs(r - Math.round(r)) > 1e-9) return null
    return Math.round(r)
  } catch { return null }
}

function permutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr]
  return arr.flatMap((v, i) => permutations([...arr.slice(0,i), ...arr.slice(i+1)]).map(p => [v,...p]))
}

function findSolutions(nums: number[], target: number, level: Level): string[] {
  const seen = new Set<string>(), sols: string[] = []
  const ops = level.operators
  const mb = level.maxBracketDepth

  if (nums.length === 2) {
    for (const [a,b] of permutations(nums)) {
      for (const op of ops) {
        if (op==='/'&&b===0) continue
        const r = safeEval(`${a}${op}${b}`)
        if (r===target) {
          const k = (op==='+'||op==='*') ? [String(a),String(b)].sort().join(op) : `${a}${op}${b}`
          if (!seen.has(k)) { seen.add(k); sols.push(`${a}${op}${b}`) }
        }
      }
    }
  } else if (nums.length === 3) {
    for (const [a,b,c] of permutations(nums)) {
      for (const o1 of ops) for (const o2 of ops) {
        const exprs = [`${a}${o1}${b}${o2}${c}`]
        if (mb>=1) exprs.push(`(${a}${o1}${b})${o2}${c}`, `${a}${o1}(${b}${o2}${c})`)
        for (const e of exprs) { const r=safeEval(e); if(r===target&&!seen.has(e)){seen.add(e);sols.push(e)} }
      }
    }
  } else {
    for (const [a,b,c,d] of permutations(nums)) {
      for (const o1 of ops) for (const o2 of ops) for (const o3 of ops) {
        const exprs: string[] = [`${a}${o1}${b}${o2}${c}${o3}${d}`]
        if (mb>=1) exprs.push(`(${a}${o1}${b})${o2}${c}${o3}${d}`,`${a}${o1}(${b}${o2}${c})${o3}${d}`,`${a}${o1}${b}${o2}(${c}${o3}${d})`,`(${a}${o1}${b}${o2}${c})${o3}${d}`,`${a}${o1}(${b}${o2}${c}${o3}${d})`)
        if (mb>=2) exprs.push(`(${a}${o1}${b})${o2}(${c}${o3}${d})`,`((${a}${o1}${b})${o2}${c})${o3}${d}`,`(${a}${o1}(${b}${o2}${c}))${o3}${d}`,`${a}${o1}((${b}${o2}${c})${o3}${d})`,`${a}${o1}(${b}${o2}(${c}${o3}${d}))`)
        for (const e of exprs) { const r=safeEval(e); if(r===target&&!seen.has(e)){seen.add(e);sols.push(e);if(sols.length>30)return sols} }
      }
    }
  }
  return sols
}

function ri(min: number, max: number) { return Math.floor(Math.random()*(max-min+1))+min }

function generateLive(level: Level): Puzzle {
  const { min, max } = level.targetRange
  for (let i=0; i<500; i++) {
    const numbers = Array.from({length:level.numberCount}, ()=>ri(1,9))
    const target = ri(min, max)
    const sols = findSolutions(numbers, target, level)
    if (sols.length>=1&&sols.length<=3) return {numbers,target,solutions:sols,levelId:level.id}
  }
  for (let i=0; i<200; i++) {
    const numbers = Array.from({length:level.numberCount}, ()=>ri(1,9))
    const target = ri(min, max)
    const sols = findSolutions(numbers, target, level)
    if (sols.length>=1&&sols.length<=5) return {numbers,target,solutions:sols,levelId:level.id}
  }
  return getFallback(level)
}

function getFallback(level: Level): Puzzle {
  const fb: Record<string, Puzzle> = {
    'A1':   {numbers:[3,7],       target:10, solutions:['3+7'],          levelId:'A1'},
    'A2':   {numbers:[2,5,3],     target:10, solutions:['2+5+3'],        levelId:'A2'},
    'A3':   {numbers:[1,2,3,4],   target:10, solutions:['1+2+3+4'],      levelId:'A3'},
    'F1':   {numbers:[3,7],       target:21, solutions:['3*7'],          levelId:'F1'},
    'F2.1': {numbers:[2,3,4],     target:14, solutions:['2*(3+4)'],      levelId:'F2.1'},
    'F2.2': {numbers:[3,7,8],     target:59, solutions:['(3+7)*8-21'],   levelId:'F2.2'},
    'F2.3': {numbers:[4,6,7],     target:102,solutions:['(4+6)*7*...'],  levelId:'F2.3'},
    'F3.1': {numbers:[2,3,4,5],   target:19, solutions:['(2+3)*4-1'],    levelId:'F3.1'},
    'F3.2': {numbers:[3,4,5,6],   target:78, solutions:['(3+5)*6*...'],  levelId:'F3.2'},
    'F3.3': {numbers:[2,3,4,5],   target:110,solutions:['...'],          levelId:'F3.3'},
    'E1.1': {numbers:[2,3,4,5],   target:14, solutions:['(2+5)*(3-1)'],  levelId:'E1.1'},
    'E1.2': {numbers:[3,4,6,7],   target:75, solutions:['...'],          levelId:'E1.2'},
    'E1.3': {numbers:[4,6,7,9],   target:150,solutions:['...'],          levelId:'E1.3'},
  }
  return fb[level.id] ?? fb['F2.1']
}

export interface IPuzzleGenerator {
  generate(level: Level): Puzzle
  generateAsync(level: Level): Promise<Puzzle>
}

export class PuzzleGenerator implements IPuzzleGenerator {
  generate(level: Level): Puzzle {
    return pickFromBank(level.id) ?? generateLive(level)
  }
  async generateAsync(level: Level): Promise<Puzzle> {
    await loadBank(level.id)
    return pickFromBank(level.id) ?? generateLive(level)
  }
}
