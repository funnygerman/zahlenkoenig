// The depth-1 evaluation model shared between the puzzle generator
// (puzzles.ts, concept 15.10) and the hint system (concept 10 — not yet
// implemented; needs expression.ts's tree first, v2 step 4). Concept 15.3:
// "ein Modell für Generator und Löser" — one model, not two that can drift
// apart the way v1's generator and validator did (concept 15.1).
//
// Same model as scripts/checkDepth1.mjs / checkBankShapes.mjs /
// checkNextPuzzle.mjs / generateBandTable.mjs: operands in a row, each
// operand a bare number or a flat group of >=2 numbers, no group inside a
// group, standard precedence.
//
// TODO(v2 step 1/4): `Operator` belongs to expression.ts's tree types
// (concept section 2) once that file exists — re-export it from there
// instead of defining it here. TODO(v2 step 4): the canonical-continuation
// half of the solver (concept 10.2 — "given the tree already built, what's
// the smallest completion?") isn't implemented yet; only the reachability
// half generation needs is here so far.

export type Operator = '+' | '-' | '*' | '/'

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
function canonicalArrangement(perm: number[], comp: number[], ops: Operator[]): string {
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

export interface ReachableEntry {
  target: number
  uniqueSolution: boolean
}

/**
 * Every target 1..999 reachable from this specific multiset under `ops`,
 * with whether it has exactly one canonical solution. Cheap enough (well
 * under 15,000 evaluations even for 4 numbers and all four operators) to
 * run synchronously per call — scripts/checkNextPuzzle.mjs measured
 * puzzles.ts's whole retry loop built on this and found single-digit
 * median attempts almost everywhere (concept 15.10/15.11).
 */
export function reachable(numbers: number[], ops: Operator[]): ReachableEntry[] {
  const n = numbers.length
  const perms = PERM_IDX[n]
  const comps = COMPS[n]
  const optuples = cartesian(ops, n - 1)
  const targets = new Map<number, Set<string>>()
  for (const comp of comps) {
    for (const permI of perms) {
      const permVals = permI.map(i => numbers[i])
      for (const opTuple of optuples) {
        const r = evalArrangement(permVals, comp, opTuple)
        if (!isFinite(r) || r < 1 || r > TARGET_MAX) continue
        const t = Math.round(r)
        if (Math.abs(r - t) > 1e-9) continue
        let set = targets.get(t)
        if (!set) { set = new Set(); targets.set(t, set) }
        set.add(canonicalArrangement(permVals, comp, opTuple))
      }
    }
  }
  return [...targets.entries()].map(([target, sols]) => ({ target, uniqueSolution: sols.size === 1 }))
}
