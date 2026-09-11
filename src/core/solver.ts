// The depth-1 evaluation model shared between the puzzle generator
// (puzzles.ts, concept 15.10) and the hint system (hints.ts, concept 10).
// Concept 15.3: "ein Modell für Generator und Löser" — one model, not two
// that can drift apart the way v1's generator and validator did (concept
// 15.1). The model: operands in a row, each operand a bare number or a
// flat group of >=2 numbers, no group inside a group, standard precedence.
//
// "One model" is now literal rather than aspirational. This comment used
// to list four scripts that reimplemented the same rules alongside it, and
// keeping copies in step was a real cost — `varietyModel.ts`'s self-test
// exists because one of them drifted the moment the solver stopped
// counting fractional routes. Every script under `scripts/` *imports* this
// file today, and the four hand-written copies were deleted along with the
// bank-era questions they answered.
//
// The canonical-continuation half of the solver (concept 10.2 — "given the
// tree already built, what's the smallest completion?") lives in
// `core/hints.ts`, built in v2 step 4; what is here is the reachability
// half the generator needs.

import type { Operator } from './expression'

export type { Operator }

const TARGET_MAX = 999 // concept 15.5: three digits fit the target chip

function apply(a: number, op: Operator, b: number): number {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '*': return a * b
    case '/': return b === 0 ? NaN : a / b
  }
}

// Evaluate a flat alternating list [num, op, num, op, num...] with precedence.
function evalFlat(nums: number[], ops: Operator[]): number {
  const n = [nums[0]]
  const o: Operator[] = []
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === '*' || ops[i] === '/') {
      n[n.length - 1] = apply(n[n.length - 1], ops[i], nums[i + 1])
      if (!isFinite(n[n.length - 1])) return NaN
    } else {
      o.push(ops[i]); n.push(nums[i + 1])
    }
  }
  let acc = n[0]
  for (let i = 0; i < o.length; i++) acc = apply(acc, o[i], n[i + 1])
  return acc
}

// One v2 arrangement: a permutation split by a composition (group sizes left
// to right, no group inside a group — concept section 4).
function evalArrangement(perm: number[], comp: number[], ops: Operator[]): number {
  const n = perm.length
  const operands: number[] = []
  let numIdx = 0, opIdx = 0
  for (const size of comp) {
    if (size === 1) {
      operands.push(perm[numIdx++])
    } else {
      const v = evalFlat(perm.slice(numIdx, numIdx + size), ops.slice(opIdx, opIdx + size - 1))
      if (!isFinite(v)) return NaN
      operands.push(v)
      numIdx += size; opIdx += size - 1
    }
    if (numIdx < n) opIdx++
  }
  const joinOps: Operator[] = []
  let cursor = 0
  for (let i = 0; i < comp.length - 1; i++) {
    cursor += comp[i] - 1
    joinOps.push(ops[cursor])
    cursor += 1
  }
  return evalFlat(operands, joinOps)
}

// Canonical form of a flat +-*/ chain: an abelian sum of signed terms, each
// an abelian product of factors (division is just a factor with a negative
// exponent). Two arrangements are "the same solution" (concept 15.7: "5+6
// und 6+5 sind dieselbe Lösung") exactly when this string matches.
function canonicalFlat(tokens: string[], ops: Operator[]): string {
  const terms: { sign: string; factors: string[] }[] = [{ sign: '+', factors: [tokens[0]] }]
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i], tok = tokens[i + 1]
    if (op === '+' || op === '-') terms.push({ sign: op, factors: [tok] })
    else if (op === '*') terms[terms.length - 1].factors.push(tok)
    else terms[terms.length - 1].factors.push('÷' + tok) // '/': a tagged factor, still sortable
  }
  return terms.map(t => t.sign + [...t.factors].sort().join('·')).sort().join('')
}

// Same recursion as evalArrangement, building a canonical string instead of
// a number. A group becomes an opaque parenthesised token at the top level.
export function canonicalArrangement(perm: number[], comp: number[], ops: Operator[]): string {
  const n = perm.length
  const topTokens: string[] = []
  let numIdx = 0, opIdx = 0
  for (const size of comp) {
    if (size === 1) {
      topTokens.push(String(perm[numIdx++]))
    } else {
      const gTokens = perm.slice(numIdx, numIdx + size).map(String)
      const gOps = ops.slice(opIdx, opIdx + size - 1)
      topTokens.push('(' + canonicalFlat(gTokens, gOps) + ')')
      numIdx += size; opIdx += size - 1
    }
    if (numIdx < n) opIdx++
  }
  const joinOps: Operator[] = []
  let cursor = 0
  for (let i = 0; i < comp.length - 1; i++) {
    cursor += comp[i] - 1
    joinOps.push(ops[cursor])
    cursor += 1
  }
  return canonicalFlat(topTokens, joinOps)
}

// Compositions of n, excluding the single whole-array group [n] (concept
// 17's "Gruppe um den ganzen Ausdruck"): it has no outside operator for its
// bracket to protect against, so it always equals the fully flat
// arrangement of the same permutation and operators — kept in, it would
// silently double every canonical-solution count (concept 15.10's own
// finding while building this model).
function allCompositions(n: number): number[][] {
  if (n === 0) return [[]]
  const out: number[][] = []
  for (let first = 1; first <= n; first++)
    for (const rest of allCompositions(n - first)) out.push([first, ...rest])
  return out
}

function compositions(n: number): number[][] {
  return allCompositions(n).filter(c => c.length > 1)
}

function permutationIndices(n: number): number[][] {
  const out: number[][] = []
  const arr = Array.from({ length: n }, (_, i) => i)
  const rec = (k: number) => {
    if (k === n) { out.push(arr.slice()); return }
    for (let i = k; i < n; i++) {
      [arr[k], arr[i]] = [arr[i], arr[k]]
      rec(k + 1)
      ;[arr[k], arr[i]] = [arr[i], arr[k]]
    }
  }
  rec(0)
  return out
}

function cartesian<T>(items: T[], k: number): T[][] {
  let result: T[][] = [[]]
  for (let i = 0; i < k; i++) {
    const next: T[][] = []
    for (const combo of result) for (const item of items) next.push([...combo, item])
    result = next
  }
  return result
}

const PERM_IDX: Record<number, number[][]> = { 2: permutationIndices(2), 3: permutationIndices(3), 4: permutationIndices(4) }
const COMPS: Record<number, number[][]> = { 2: compositions(2), 3: compositions(3), 4: compositions(4) }

const PATTERN_GLYPH: Record<Operator, string> = { '+': '+', '-': '\u2212', '*': '\u00d7', '/': '\u00f7' }

/**
 * The shape of an arrangement with the numbers blanked out: `(n\u2212n)\u00d7n`.
 *
 * Depends only on the composition and the operator tuple, never on the
 * numbers — which is what makes the memo below sound, and what lets the
 * draw remember *shapes* instead of puzzles. Remembering puzzles fixed the
 * immediate-repeat bug; it could do nothing about the far more visible one,
 * that 200 draws of "4 Zahlen, alle vier, gro\u00df" produced the same
 * `(n+n)\u00d7n\u2212n` 91% of the time out of 25 shapes the pool holds.
 */
const patternMemo = new Map<string, string>()
export function patternOf(comp: number[], opTuple: Operator[], n: number): string {
  const key = comp.join('') + '|' + opTuple.join('')
  const seen = patternMemo.get(key)
  if (seen !== undefined) return seen
  const parts: string[] = []
  let numIdx = 0
  let opIdx = 0
  for (const size of comp) {
    if (size === 1) {
      parts.push('n')
      numIdx += 1
    } else {
      let inner = 'n'
      for (let k = 0; k < size - 1; k++) inner += PATTERN_GLYPH[opTuple[opIdx + k]] + 'n'
      parts.push('(' + inner + ')')
      numIdx += size
      opIdx += size - 1
    }
    if (numIdx < n) opIdx++
  }
  let out = parts[0]
  const joins = joinOperators(comp, opTuple)
  for (let i = 0; i < joins.length; i++) out += PATTERN_GLYPH[joins[i]] + parts[i + 1]
  patternMemo.set(key, out)
  return out
}

/** The operators joining the top-level operands — the same slicing evalArrangement does. */
function joinOperators(comp: number[], ops: Operator[]): Operator[] {
  const joins: Operator[] = []
  let cursor = 0
  for (let i = 0; i < comp.length - 1; i++) {
    cursor += comp[i] - 1
    joins.push(ops[cursor])
    cursor += 1
  }
  return joins
}

const WHOLE_EPS = 1e-9
function isWhole(x: number): boolean {
  return Number.isFinite(x) && Math.abs(x - Math.round(x)) < WHOLE_EPS
}

/** evalFlat again, but refusing any step that leaves the whole numbers. */
function wholeFlat(nums: number[], ops: Operator[]): number | null {
  const terms = [nums[0]]
  const joins: Operator[] = []
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]
    if (op === '*' || op === '/') {
      const v = apply(terms[terms.length - 1], op, nums[i + 1])
      if (!isWhole(v)) return null
      terms[terms.length - 1] = v
    } else {
      joins.push(op)
      terms.push(nums[i + 1])
    }
  }
  let acc = terms[0]
  for (let i = 0; i < joins.length; i++) {
    acc = apply(acc, joins[i], terms[i + 1])
    if (!isWhole(acc)) return null
  }
  return acc
}

/**
 * Whether every step of this arrangement lands on a whole number, groups
 * included.
 *
 * The evaluator only ever checked the *final* result (concept 8, and the
 * 1..TARGET_MAX filter below), which makes `9 \u00f7 (1 \u00f7 9 \u00f7 9) = 729` a legal
 * puzzle: the bracket is 1/81 and dividing by it multiplies. Measured
 * across the whole search space, that is not an edge case — wherever \u00f7 is
 * selected without \u00d7, dividing by a fraction is the only route to a large
 * target, so 79% of `4 Zahlen, +\u00f7, gro\u00df` has no whole-number solution at
 * all. For an audience that starts in the first year of school that is a
 * correctness question rather than a taste one (PO), so puzzles.ts refuses
 * such a target outright rather than merely ranking it lower.
 */
export function staysWhole(perm: number[], comp: number[], opTuple: Operator[]): boolean {
  const n = perm.length
  const operands: number[] = []
  let numIdx = 0
  let opIdx = 0
  for (const size of comp) {
    if (size === 1) {
      operands.push(perm[numIdx++])
    } else {
      const v = wholeFlat(perm.slice(numIdx, numIdx + size), opTuple.slice(opIdx, opIdx + size - 1))
      if (v === null) return false
      operands.push(v)
      numIdx += size
      opIdx += size - 1
    }
    if (numIdx < n) opIdx++
  }
  return wholeFlat(operands, joinOperators(comp, opTuple)) !== null
}

/**
 * Whether this arrangement contains a step that changes nothing — `\u00d7 1`,
 * `\u00f7 1`, or a division by the number immediately to its left. A chip that
 * changes nothing is the clearest sign a puzzle was generated rather than
 * designed: `(6 + 5) \u00d7 9 \u00d7 1 = 99` is a three-number puzzle wearing a
 * four-number costume.
 *
 * Deliberately narrow. `(1 + 1) \u00d7 9 \u00d7 5` is not counted, because `1 + 1`
 * does change something, and `8 \u00f7 8 = 1` as a whole two-number puzzle is
 * not counted either — drop either 8 and it breaks. Unlike the whole-number
 * rule this is a preference in puzzles.ts, not a refusal: it is a matter of
 * elegance, not of whether a child can solve it.
 */
export function hasIdentityStep(perm: number[], comp: number[], opTuple: Operator[]): boolean {
  const n = perm.length
  const top: (number | null)[] = [] // null marks a bracket, whose value is not a chip
  let numIdx = 0
  let opIdx = 0
  for (const size of comp) {
    if (size === 1) {
      top.push(perm[numIdx++])
    } else {
      // A group is never the whole puzzle — compositions exclude [n] — so
      // the `a ÷ a` carve-out below cannot apply inside one.
      if (flatIdentity(perm.slice(numIdx, numIdx + size), opTuple.slice(opIdx, opIdx + size - 1), false)) return true
      top.push(null)
      numIdx += size
      opIdx += size - 1
    }
    if (numIdx < n) opIdx++
  }
  return flatIdentity(top, joinOperators(comp, opTuple), n === 2)
}

/**
 * The identity check on one flat run. `null` stands for a bracket's value,
 * which is not a chip the player could have spent elsewhere — reading it as
 * one was the bug that made `(1 + 1) × 9 × 5` look wasteful, because the
 * second 1 sits at the flat index the join's left operand occupies.
 */
function flatIdentity(vals: (number | null)[], ops: Operator[], entirePuzzle: boolean): boolean {
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]
    const left = vals[i]
    const right = vals[i + 1]
    if (op === '*' && (left === 1 || right === 1)) return true
    if (op === '/' && right === 1) return true
    // `9 + 6 ÷ 6` spends two chips to make a 1, but `8 ÷ 8 = 1` as the whole
    // puzzle spends nothing spare — drop either 8 and it breaks.
    if (op === '/' && left !== null && right !== null && left === right && !(entirePuzzle && vals.length === 2)) return true
  }
  return false
}

export interface ReachableEntry {
  target: number
  uniqueSolution: boolean
  /**
   * The fewest *distinct* operators any single solution of this target
   * uses. 1 means the target can be reached with one operator repeated —
   * `5+5+5+5 = 20` under `{+, ×}` — which is what made a selection of
   * several operators feel like a selection of one (PO): the generator
   * only ever asked whether a target was reachable, never whether
   * reaching it needs the operators the player actually picked. Bounded
   * above by n − 1, so two numbers are always 1.
   *
   * Counted over the whole-number solutions where the target has any,
   * since those are the only ones puzzles.ts will offer.
   */
  minDistinctOps: number
  /** At least one solution keeps every intermediate a whole number (`staysWhole`). */
  wholeSolution: boolean
  /** At least one whole-number solution also wastes no chip (`hasIdentityStep`). */
  cleanSolution: boolean
  /**
   * The shape a player is likeliest to find — fewest brackets, then first
   * alphabetically, preferring whole-number solutions. What the draw's
   * shape memory remembers.
   */
  pattern: string
}

/**
 * Every target 1..999 reachable from this specific multiset under `ops`,
 * with whether it has exactly one canonical solution. Cheap enough (well
 * under 15,000 evaluations even for 4 numbers and all four operators) to
 * run synchronously per call — measured across puzzles.ts's whole retry
 * loop built on this, which found single-digit median attempts almost
 * everywhere (concept 15.10/15.11). The script that measured it
 * (`checkNextPuzzle.mjs`) is gone with the rest of the bank-era scripts;
 * its numbers live on at `MAX_ATTEMPTS` in puzzles.ts, which is the only
 * place they ever decided anything.
 */
/**
 * Visits every depth-1 arrangement of `numbers` under `ops` whose value is
 * a whole number in 1..TARGET_MAX, in the model's own fixed enumeration
 * order (compositions, then permutations, then operator tuples).
 *
 * Exposed so a caller can ask what *shape* a solution has — which
 * operators it uses, whether it needs a bracket — without re-deriving the
 * model. Concept 15.3 wants one model for generator and solver;
 * `scripts/checkVariety.ts` measures the generator's output against the
 * pool it draws from and would otherwise have been a sixth hand-kept copy
 * of this recursion.
 */
export function forEachArrangement(
  numbers: number[],
  ops: Operator[],
  visit: (perm: number[], comp: number[], opTuple: Operator[], value: number) => void,
): void {
  const n = numbers.length
  const perms = PERM_IDX[n]
  const comps = COMPS[n]
  const optuples = cartesian(ops, n - 1)
  for (const comp of comps) {
    for (const permI of perms) {
      const permVals = permI.map(i => numbers[i])
      for (const opTuple of optuples) {
        const r = evalArrangement(permVals, comp, opTuple)
        if (!isFinite(r) || r < 1 || r > TARGET_MAX) continue
        const t = Math.round(r)
        if (Math.abs(r - t) > 1e-9) continue
        visit(permVals, comp, opTuple, t)
      }
    }
  }
}

// How many distinct operators one tuple uses. Counted per arrangement now
// rather than once per tuple, so it stays allocation-free — the tuple is at
// most three entries long, which makes indexOf cheaper than a Set.
function distinctOpCount(tuple: Operator[]): number {
  let count = 0
  for (let i = 0; i < tuple.length; i++) if (tuple.indexOf(tuple[i]) === i) count++
  return count
}

export function reachable(numbers: number[], ops: Operator[]): ReachableEntry[] {
  interface Acc {
    sols: Set<string>
    minDistinctAny: number
    minDistinctWhole: number
    whole: boolean
    clean: boolean
    /** representative: whole beats fractional, then fewer brackets, then alphabetical */
    bestWhole: boolean
    bestBlocks: number
    bestPattern: string
  }
  const acc = new Map<number, Acc>()
  forEachArrangement(numbers, ops, (permVals, comp, opTuple, t) => {
    const distinct = distinctOpCount(opTuple)
    const whole = staysWhole(permVals, comp, opTuple)
    const clean = whole && !hasIdentityStep(permVals, comp, opTuple)
    const pattern = patternOf(comp, opTuple, numbers.length)
    let blocks = 0
    for (const size of comp) if (size > 1) blocks++

    let a = acc.get(t)
    if (!a) {
      a = {
        sols: new Set(), minDistinctAny: distinct, minDistinctWhole: whole ? distinct : Infinity,
        whole, clean, bestWhole: whole, bestBlocks: blocks, bestPattern: pattern,
      }
      acc.set(t, a)
    } else {
      a.minDistinctAny = Math.min(a.minDistinctAny, distinct)
      if (whole) a.minDistinctWhole = Math.min(a.minDistinctWhole, distinct)
      a.whole = a.whole || whole
      a.clean = a.clean || clean
      // A whole-number shape always outranks a fractional one, however many
      // brackets it carries — the player will be shown a puzzle that has a
      // whole-number path, so that is the shape to remember.
      const better = (whole && !a.bestWhole) ||
        (whole === a.bestWhole && (blocks < a.bestBlocks || (blocks === a.bestBlocks && pattern < a.bestPattern)))
      if (better) {
        a.bestWhole = whole
        a.bestBlocks = blocks
        a.bestPattern = pattern
      }
    }
    a.sols.add(canonicalArrangement(permVals, comp, opTuple))
  })
  return [...acc.entries()].map(([target, a]) => ({
    target,
    uniqueSolution: a.sols.size === 1,
    minDistinctOps: a.whole ? a.minDistinctWhole : a.minDistinctAny,
    wholeSolution: a.whole,
    cleanSolution: a.clean,
    pattern: a.bestPattern,
  }))
}
