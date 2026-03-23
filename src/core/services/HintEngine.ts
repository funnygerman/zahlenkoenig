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
    const r = Function('"use strict"; return (' + expr + ')')() as number
    return typeof r === 'number' && isFinite(r) ? Math.round(r) : null
  } catch { return null }
}

function extractSubExprs(solution: string): string[] {
  const result: string[] = []
  let depth = 0, start = -1
  for (let i = 0; i < solution.length; i++) {
    if (solution[i]==='(') { if(depth===0) start=i; depth++ }
    else if (solution[i]===')') { depth--; if(depth===0&&start!==-1) result.push(solution.slice(start+1,i)) }
  }
  return result
}

export function getSolutionPreview(solution: string): string {
  if (!solution) return '?'
  let preview = '', i = 0
  if (solution[0]==='(') { preview+='('; i++ }
  while (i<solution.length && /[0-9]/.test(solution[i])) preview+=solution[i++]
  if (i<solution.length && '+-*/'.includes(solution[i])) preview+=solution[i++]
  return preview + '…'
}

export class HintEngine implements IHintEngine {
  getHint(puzzle: Puzzle, hintLevel: 1 | 2 | 3): Hint {
    const solution = puzzle.solutions[0]
    if (!solution) return { level: hintLevel, textKey: 'hint.keep_trying', textParams: {} }

    try {
      if (hintLevel === 1) {
        const subs = extractSubExprs(solution)
        if (subs.length > 0) {
          const value = safeEval(subs[0])
          if (value !== null) return { level:1, textKey:'hint.intermediate_value', textParams:{value} }
        }
        // No brackets: evaluate first partial expression
        const splitIdx = solution.search(/[+\-*/]/)
        if (splitIdx > 0) {
          const leftVal = safeEval(solution.slice(0, splitIdx))
          if (leftVal !== null) return { level:1, textKey:'hint.intermediate_value', textParams:{value:leftVal} }
        }
        return { level:1, textKey:'hint.think_about_target', textParams:{target:puzzle.target} }
      }

      if (hintLevel === 2) {
        const subs = extractSubExprs(solution)
        const source = subs.length > 0 ? subs[0] : solution
        const nums = source.match(/\d+/g)?.map(Number) ?? []
        return { level:2, textKey:'hint.look_at_numbers', textParams:{a:nums[0]??'?', b:nums[1]??'?'} }
      }

      if (hintLevel === 3) {
        const ops = solution.match(/[+\-*/]/g) ?? []
        const opMap: Record<string,string> = {'+':'+','-':'−','*':'×','/':'÷'}
        const keyOp = ops.find(o=>o==='*'||o==='/') ?? ops[0] ?? '+'
        return { level:3, textKey:'hint.try_operator', textParams:{operator:opMap[keyOp]??keyOp} }
      }
    } catch { /* fallback */ }

    return { level: hintLevel, textKey: 'hint.keep_trying', textParams: {} }
  }
}
