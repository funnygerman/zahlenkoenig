// The shape vocabulary shared by scripts/checkVariety.ts (what the
// generator draws) and scripts/checkBands.ts (whether a band can offer
// what the player selected).
//
// Everything here is derived from solver.ts's own arrangement enumeration
// rather than a private copy of the depth-1 model — concept 15.3's "ein
// Modell für Generator und Löser", and the reason forEachArrangement is
// exported at all.

import { forEachArrangement, reachable } from '../src/core/solver.ts'
import type { Operator } from '../src/core/expression.ts'

export const ALL_OPS: Operator[] = ['+', '-', '*', '/']
export const GLYPH: Record<Operator, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' }
export const GLYPHS = ALL_OPS.map(o => GLYPH[o])

/**
 * The shape of one arrangement with the numbers blanked out: `(n−n)×n`.
 * Depends only on the composition and the operator tuple, never on the
 * numbers — which is what makes `patternOf`'s memo sound.
 */
export function renderArrangement(tokens: string[], comp: number[], opTuple: Operator[]): string {
  const n = tokens.length
  const parts: string[] = []
  let numIdx = 0
  let opIdx = 0
  for (const size of comp) {
    if (size === 1) {
      parts.push(tokens[numIdx])
      numIdx += 1
    } else {
      let inner = tokens[numIdx]
      for (let k = 0; k < size - 1; k++) inner += ' ' + GLYPH[opTuple[opIdx + k]] + ' ' + tokens[numIdx + k + 1]
      parts.push('(' + inner + ')')
      numIdx += size
      opIdx += size - 1
    }
    if (numIdx < n) opIdx++
  }
  // The operators joining the top-level operands, found the same way
  // evalArrangement finds them.
  const joins: Operator[] = []
  let cursor = 0
  for (let i = 0; i < comp.length - 1; i++) {
    cursor += comp[i] - 1
    joins.push(opTuple[cursor])
    cursor += 1
  }
  let out = parts[0]
  for (let i = 0; i < joins.length; i++) out += ' ' + GLYPH[joins[i]] + ' ' + parts[i + 1]
  return out
}

/**
 * The shape of one arrangement with the numbers blanked out: `(n−n)×n`.
 * Depends only on the composition and the operator tuple, never on the
 * numbers — which is what makes `patternOf`'s memo sound.
 */
export function buildPattern(comp: number[], opTuple: Operator[], n: number): string {
  return renderArrangement(new Array(n).fill('n'), comp, opTuple).replace(/ /g, '')
}

/**
 * The representative solution of one puzzle, written out with its real
 * numbers — the same arrangement `shapesOf` reports as `pattern` (fewest
 * brackets, then first alphabetically), so a printed sample and the
 * measured distribution always agree.
 */
export function renderSolution(numbers: number[], ops: Operator[], target: number): string {
  let best: { blocks: number; pattern: string; text: string } | null = null
  forEachArrangement(numbers, ops, (perm, comp, opTuple, value) => {
    if (value !== target) return
    const blocks = blocksOf(comp)
    const pattern = patternOf(comp, opTuple, numbers.length)
    if (best && (blocks > best.blocks || (blocks === best.blocks && pattern >= best.pattern))) return
    best = { blocks, pattern, text: renderArrangement(perm.map(String), comp, opTuple) }
  })
  if (!best) throw new Error(`renderSolution: ${numbers} cannot reach ${target} under ${ops.join('')}`)
  return `${best!.text} = ${target}`
}

const patternMemo = new Map<string, string>()
export function patternOf(comp: number[], opTuple: Operator[], n: number): string {
  const key = comp.join('') + '|' + opTuple.join('')
  let p = patternMemo.get(key)
  if (p === undefined) {
    p = buildPattern(comp, opTuple, n)
    patternMemo.set(key, p)
  }
  return p
}

export function opsMaskOf(opTuple: Operator[]): number {
  let m = 0
  for (const op of opTuple) m |= 1 << ALL_OPS.indexOf(op)
  return m
}

/** The operators a rendered pattern string uses, as a mask — read back off the glyphs. */
export function maskOfPattern(pattern: string): number {
  let m = 0
  for (const ch of pattern) {
    const i = GLYPHS.indexOf(ch)
    if (i >= 0) m |= 1 << i
  }
  return m
}

export function blocksOf(comp: number[]): number {
  let b = 0
  for (const size of comp) if (size > 1) b++
  return b
}

/**
 * What a solved puzzle looks like, over *all* its solutions:
 *  - `anyOps`    an operator some solution uses
 *  - `allOps`    an operator every solution uses (the player cannot avoid it)
 *  - `minBlocks` 0 if any solution is bracket-free
 *  - `minDistinctOps` the fewest distinct operators any one solution uses —
 *                the same quantity reachable() reports, recomputed here so a
 *                draw policy can filter on it without a second solver pass
 *  - `pattern`   the representative shape: fewest brackets, then first
 *                alphabetically. Fewest-brackets-first means a redundant
 *                bracket — `(n+n)+n` reaches whatever `n+n+n` reaches —
 *                never surfaces as the representative.
 */
export interface Shape {
  anyOps: number
  allOps: number
  minBlocks: number
  minDistinctOps: number
  pattern: string
}

function popcount(mask: number): number {
  let c = 0
  for (let m = mask; m; m >>= 1) c += m & 1
  return c
}

/** Every reachable target from this multiset, with its shape. One pass over the arrangements. */
export function shapesOf(numbers: number[], ops: Operator[]): Map<number, Shape> {
  const n = numbers.length
  const out = new Map<number, Shape>()
  forEachArrangement(numbers, ops, (_perm, comp, opTuple, value) => {
    const mask = opsMaskOf(opTuple)
    const blocks = blocksOf(comp)
    const pattern = patternOf(comp, opTuple, n)
    const prev = out.get(value)
    if (prev === undefined) {
      out.set(value, { anyOps: mask, allOps: mask, minBlocks: blocks, minDistinctOps: popcount(mask), pattern })
      return
    }
    prev.anyOps |= mask
    prev.allOps &= mask
    prev.minDistinctOps = Math.min(prev.minDistinctOps, popcount(mask))
    if (blocks < prev.minBlocks || (blocks === prev.minBlocks && pattern < prev.pattern)) {
      prev.minBlocks = blocks
      prev.pattern = pattern
    }
  })
  return out
}

/** Every multiset of `n` digits 1..9, the same space generateBandTable.mjs walks. */
export function multisets(n: number): number[][] {
  const out: number[][] = []
  const rec = (start: number, arr: number[]) => {
    if (arr.length === n) { out.push(arr.slice()); return }
    for (let v = start; v <= 9; v++) { arr.push(v); rec(v, arr); arr.pop() }
  }
  rec(1, [])
  return out
}

export function opSubsets(): { mask: number; ops: Operator[] }[] {
  const out = []
  for (let mask = 1; mask < 16; mask++) out.push({ mask, ops: ALL_OPS.filter((_, i) => mask & (1 << i)) })
  return out
}

/**
 * Known-good/known-bad checks, run before either script reports anything
 * (CLAUDE.md: "Verify claims rather than estimating them" — checkBankShapes
 * exists because two confident sentences turned out to be wrong).
 */
export function selfTestModel(): void {
  const fail = (msg: string) => { throw new Error(`varietyModel self-test: ${msg}`) }
  const eq = (a: unknown, b: unknown, what: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${what}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)
  }

  // Patterns: known shapes, spelled out by hand.
  eq(buildPattern([1, 1], ['+'], 2), 'n+n', 'flat pair')
  eq(buildPattern([1, 1, 1], ['*', '+'], 3), 'n×n+n', 'flat triple')
  eq(buildPattern([2, 1], ['-', '*'], 3), '(n−n)×n', 'leading block')
  eq(buildPattern([1, 2], ['+', '*'], 3), 'n+(n×n)', 'trailing block')
  eq(buildPattern([2, 2], ['+', '*', '-'], 4), '(n+n)×(n−n)', 'two blocks')

  // A rendered solution must be the same arrangement the pattern names,
  // or a printed sample would not match the measured distribution.
  eq(renderSolution([9, 9], ALL_OPS, 81), '9 × 9 = 81', 'rendered solution, flat')
  eq(renderSolution([1, 1, 1, 3], ['+', '*'], 9), '(1 + 1 + 1) × 3 = 9', 'rendered solution, bracketed')
  eq(buildPattern([2, 1], ['+', '*'], 3), renderArrangement(['n', 'n', 'n'], [2, 1], ['+', '*']).replace(/ /g, ''), 'pattern and render agree')

  // A pattern's operators must read back off the glyphs the same way they
  // went in — a mis-sliced opTuple would otherwise show the wrong glyph
  // and nothing would notice.
  eq(maskOfPattern('(n−n)×n'), opsMaskOf(['-', '*']), 'mask round-trips through the glyphs')
  eq(maskOfPattern('n+n÷n'), opsMaskOf(['+', '/']), 'mask round-trips, second shape')
  eq(maskOfPattern('n+n'), opsMaskOf(['+']), 'mask of a single operator')

  // Known-good: a target only a bracket can reach. 1,1,1,3 -> 9 under
  // {+,×} needs a 3-number group — solver.test.ts's own example.
  const s9 = shapesOf([1, 1, 1, 3], ['+', '*']).get(9)
  if (!s9) fail('1,1,1,3 -> 9 should be reachable under {+,*}')
  eq(s9!.minBlocks, 1, '1,1,1,3 -> 9 needs a bracket')

  // Known-good: the concept's own worst case has a bracket-free solution
  // too (6×9 − 2×3 = 48), so it must not be counted as bracket-requiring.
  const s48 = shapesOf([6, 2, 9, 3], ALL_OPS).get(48)
  if (!s48) fail('6,2,9,3 -> 48 should be reachable')
  eq(s48!.minBlocks, 0, '6,2,9,3 -> 48 has a bracket-free solution')

  // Known-good: an unavoidable operator.
  const s81 = shapesOf([9, 9], ALL_OPS).get(81)!
  eq(s81.anyOps, 1 << 2, '9,9 -> 81 uses only ×')
  eq(s81.allOps, 1 << 2, '9,9 -> 81 requires ×')
  eq(s81.pattern, 'n×n', '9,9 -> 81 pattern')
  eq(s81.minDistinctOps, 1, '9,9 -> 81 needs one operator')

  // minDistinctOps must agree with the generator's own figure, since a
  // draw policy filters on it — check it against reachable() directly.
  for (const nums of [[6, 2, 9, 3], [1, 1, 1, 3], [4, 4], [7, 8, 9]]) {
    for (const e of reachable(nums, ALL_OPS)) {
      const sh = shapesOf(nums, ALL_OPS).get(e.target)!
      if (sh.minDistinctOps !== e.minDistinctOps) {
        fail(`minDistinctOps disagrees with reachable() for ${nums} -> ${e.target}: ${sh.minDistinctOps} vs ${e.minDistinctOps}`)
      }
    }
  }
  eq(shapesOf([4, 4], ALL_OPS).get(8)!.allOps, 1 << 0, '4,4 -> 8 requires +')

  // Known-bad: an unreachable target must not be reported at all.
  if (shapesOf([1, 1], ALL_OPS).has(5)) fail('1,1 -> 5 should be unreachable')

  // Known-good, and the load-bearing claim of the whole report: with two
  // single digits nothing built from − or ÷ reaches 16 or more, so a band
  // starting at 16 cannot contain them however the draw behaves.
  for (const nums of multisets(2)) {
    for (const [target, shape] of shapesOf(nums, ALL_OPS)) {
      if (target >= 16 && (shape.anyOps & ((1 << 1) | (1 << 3)))) fail(`two digits reached ${target} with − or ÷`)
    }
  }

  eq(multisets(2).length, 45, 'there are 45 multisets of two digits')
  eq(opSubsets().length, 15, 'there are 15 non-empty operator subsets')
}
