// Generates a puzzle on the device instead of loading one from a bank
// (concept 15.10 — the bank was dropped: generating one puzzle is fast
// enough to do it live, and a PWA has no reason to preload a puzzle it
// won't play). No React import, no network access — see CLAUDE.md's rule
// that `core/` is pure TypeScript.
//
// TODO(v2 step 1): `expression.ts`, `evaluate.ts` and `solver.ts` don't
// exist yet. Concept 15.3 requires generator and solver to share one
// evaluation model, so once solver.ts exists, `evalArrangement`,
// `canonicalArrangement` and `reachable` below should move there and be
// imported by both — they are the same depth-1 model as
// scripts/checkDepth1.mjs / checkBankShapes.mjs / checkNextPuzzle.mjs /
// generateBandTable.mjs, duplicated here only until that split happens.

export type Operator = '+' | '-' | '*' | '/'

/** The subset of Settings (concept section 11) that picking a puzzle needs. */
export interface PuzzleSettings {
  numbers: 2 | 3 | 4
  ops: Operator[] // at least one
  band: 0 | 1 | 2 // klein · mittel · groß (concept 15.5)
  uniqueOnly: boolean
}

export interface Puzzle {
  numbers: number[]
  target: number
}

const ALL_OPS: Operator[] = ['+', '-', '*', '/']
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
// finding while building this).
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

interface ReachableEntry {
  target: number
  uniqueSolution: boolean
}

/**
 * Every target 1..999 reachable from this specific multiset under `ops`,
 * with whether it has exactly one canonical solution. This is the "ask the
 * solver" step of concept 15.10's algorithm — cheap enough (well under
 * 15,000 evaluations even for 4 numbers and all four operators) to run
 * synchronously per draw; scripts/checkNextPuzzle.mjs measured the whole
 * retry loop this feeds and found single-digit median attempts almost
 * everywhere (concept 15.10/15.11).
 */
function reachable(numbers: number[], ops: Operator[]): ReachableEntry[] {
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

function opsMask(ops: Operator[]): number {
  return ALL_OPS.reduce((m, op, i) => (ops.includes(op) ? m | (1 << i) : m), 0)
}

interface BandRow {
  total: number
  unique: number
  bands: [[number, number], [number, number], [number, number]]
}

// The 45-row table (concept 15.8/15.10): for every (number count, operator
// subset) selection, how many puzzles exist in total, how many have a
// unique solution, and the [lo,hi] target range of each band (klein ·
// mittel · groß, concept 15.5). Answers those questions from the whole
// search space, which a single generated draw can't — nextPuzzle() only
// needs it to know where to aim and whether uniqueOnly is available
// (unique === 0 means concept 15.6's switch disables itself).
//
// Generated by scripts/generateBandTable.mjs — do not hand-edit. 45 rows.
const BAND_TABLE: Record<string, BandRow> = {
  '2-1': { total: 45, unique: 45, bands: [[2, 8], [8, 12], [12, 18]] },
  '2-2': { total: 36, unique: 36, bands: [[1, 2], [2, 4], [4, 8]] },
  '2-3': { total: 81, unique: 81, bands: [[1, 4], [4, 9], [9, 18]] },
  '2-4': { total: 45, unique: 45, bands: [[1, 12], [12, 30], [32, 81]] },
  '2-5': { total: 89, unique: 88, bands: [[1, 9], [9, 16], [16, 81]] },
  '2-6': { total: 81, unique: 81, bands: [[1, 4], [4, 15], [16, 81]] },
  '2-7': { total: 125, unique: 124, bands: [[1, 5], [6, 12], [12, 81]] },
  '2-8': { total: 23, unique: 23, bands: [[1, 1], [1, 3], [3, 9]] },
  '2-9': { total: 68, unique: 68, bands: [[1, 4], [5, 10], [10, 18]] },
  '2-10': { total: 58, unique: 57, bands: [[1, 2], [2, 4], [4, 9]] },
  '2-11': { total: 103, unique: 102, bands: [[1, 3], [3, 8], [8, 18]] },
  '2-12': { total: 59, unique: 50, bands: [[1, 4], [5, 24], [24, 81]] },
  '2-13': { total: 103, unique: 93, bands: [[1, 7], [8, 14], [14, 81]] },
  '2-14': { total: 94, unique: 84, bands: [[1, 3], [3, 9], [10, 81]] },
  '2-15': { total: 138, unique: 127, bands: [[1, 4], [4, 12], [12, 81]] },
  '3-1': { total: 165, unique: 0, bands: [[3, 13], [13, 17], [17, 27]] },
  '3-2': { total: 385, unique: 61, bands: [[1, 4], [4, 7], [7, 17]] },
  '3-3': { total: 550, unique: 0, bands: [[1, 5], [5, 10], [11, 27]] },
  '3-4': { total: 165, unique: 0, bands: [[1, 45], [48, 144], [144, 729]] },
  '3-5': { total: 1035, unique: 347, bands: [[1, 21], [21, 51], [51, 729]] },
  '3-6': { total: 1148, unique: 322, bands: [[1, 7], [7, 22], [22, 729]] },
  '3-7': { total: 1973, unique: 583, bands: [[1, 12], [12, 33], [33, 729]] },
  '3-8': { total: 177, unique: 25, bands: [[1, 5], [5, 10], [12, 81]] },
  '3-9': { total: 591, unique: 89, bands: [[1, 6], [6, 12], [12, 81]] },
  '3-10': { total: 698, unique: 146, bands: [[1, 3], [3, 7], [7, 81]] },
  '3-11': { total: 1047, unique: 129, bands: [[1, 4], [4, 9], [9, 81]] },
  '3-12': { total: 297, unique: 0, bands: [[1, 8], [8, 56], [60, 729]] },
  '3-13': { total: 1370, unique: 412, bands: [[1, 13], [13, 39], [40, 729]] },
  '3-14': { total: 1309, unique: 267, bands: [[1, 6], [6, 18], [18, 729]] },
  '3-15': { total: 2253, unique: 569, bands: [[1, 9], [9, 28], [28, 729]] },
  '4-1': { total: 495, unique: 0, bands: [[4, 17], [17, 23], [23, 36]] },
  '4-2': { total: 2222, unique: 65, bands: [[1, 5], [5, 10], [11, 26]] },
  '4-3': { total: 2717, unique: 0, bands: [[1, 6], [6, 13], [13, 36]] },
  '4-4': { total: 377, unique: 0, bands: [[1, 112], [112, 360], [360, 980]] },
  '4-5': { total: 13314, unique: 6316, bands: [[1, 51], [51, 119], [119, 980]] },
  '4-6': { total: 14777, unique: 4248, bands: [[1, 15], [15, 48], [48, 980]] },
  '4-7': { total: 28035, unique: 9384, bands: [[1, 29], [29, 81], [81, 980]] },
  '4-8': { total: 922, unique: 26, bands: [[1, 12], [12, 42], [42, 729]] },
  '4-9': { total: 5756, unique: 1900, bands: [[1, 8], [8, 18], [18, 729]] },
  '4-10': { total: 6293, unique: 1168, bands: [[1, 6], [6, 12], [12, 729]] },
  '4-11': { total: 8919, unique: 1584, bands: [[1, 7], [7, 16], [16, 729]] },
  '4-12': { total: 1134, unique: 0, bands: [[1, 16], [16, 72], [72, 980]] },
  '4-13': { total: 19261, unique: 8200, bands: [[1, 28], [28, 82], [82, 980]] },
  '4-14': { total: 17009, unique: 4439, bands: [[1, 15], [15, 44], [44, 980]] },
  '4-15': { total: 31379, unique: 9988, bands: [[1, 26], [26, 73], [73, 980]] },
}

function bandRow(settings: PuzzleSettings): BandRow {
  const key = `${settings.numbers}-${opsMask(settings.ops)}`
  const row = BAND_TABLE[key]
  if (!row) throw new Error(`puzzles.ts: no band data for ${settings.numbers} numbers, ops "${settings.ops.join('')}"`)
  return row
}

/** [numbers, target] — a puzzle known to have exactly one canonical solution. */
type Exception = [number[], number]

// The two selections concept 15.11 found too thin for blind redraw under
// uniqueOnly (checkNextPuzzle.mjs measured up to 74% of draws never landing
// a hit): their whole uniqueOnly solution pool is small enough to ship
// exhaustively instead. nextPuzzle() picks straight from these, no retry
// loop needed. Generated by scripts/dumpUniqueExceptions.mjs — do not
// hand-edit.

// 4 Zahlen, nur − (65 entries). Every entry has the form [a,b,b,b], target
// = 3b−a — the only shape a single non-commutative operator can force into
// exactly one solution (concept 15.11).
const EXCEPTIONS_4_MINUS: Exception[] = [
  [[1, 1, 1, 1], 2], [[1, 2, 2, 2], 5], [[1, 3, 3, 3], 8], [[1, 4, 4, 4], 11],
  [[1, 5, 5, 5], 14], [[1, 6, 6, 6], 17], [[1, 7, 7, 7], 20], [[1, 8, 8, 8], 23],
  [[1, 9, 9, 9], 26], [[2, 2, 2, 2], 4], [[2, 2, 2, 3], 3], [[2, 2, 2, 5], 1],
  [[2, 3, 3, 3], 7], [[2, 4, 4, 4], 10], [[2, 5, 5, 5], 13], [[2, 6, 6, 6], 16],
  [[2, 7, 7, 7], 19], [[2, 8, 8, 8], 22], [[2, 9, 9, 9], 25], [[3, 3, 3, 3], 6],
  [[3, 3, 3, 4], 5], [[3, 3, 3, 5], 4], [[3, 3, 3, 7], 2], [[3, 3, 3, 8], 1],
  [[3, 4, 4, 4], 9], [[3, 5, 5, 5], 12], [[3, 6, 6, 6], 15], [[3, 7, 7, 7], 18],
  [[3, 8, 8, 8], 21], [[3, 9, 9, 9], 24], [[4, 4, 4, 4], 8], [[4, 4, 4, 5], 7],
  [[4, 4, 4, 6], 6], [[4, 4, 4, 7], 5], [[4, 4, 4, 9], 3], [[4, 5, 5, 5], 11],
  [[4, 6, 6, 6], 14], [[4, 7, 7, 7], 17], [[4, 8, 8, 8], 20], [[4, 9, 9, 9], 23],
  [[5, 5, 5, 5], 10], [[5, 5, 5, 6], 9], [[5, 5, 5, 7], 8], [[5, 5, 5, 8], 7],
  [[5, 5, 5, 9], 6], [[5, 6, 6, 6], 13], [[5, 7, 7, 7], 16], [[5, 8, 8, 8], 19],
  [[5, 9, 9, 9], 22], [[6, 6, 6, 6], 12], [[6, 6, 6, 7], 11], [[6, 6, 6, 8], 10],
  [[6, 6, 6, 9], 9], [[6, 7, 7, 7], 15], [[6, 8, 8, 8], 18], [[6, 9, 9, 9], 21],
  [[7, 7, 7, 7], 14], [[7, 7, 7, 8], 13], [[7, 7, 7, 9], 12], [[7, 8, 8, 8], 17],
  [[7, 9, 9, 9], 20], [[8, 8, 8, 8], 16], [[8, 8, 8, 9], 15], [[8, 9, 9, 9], 19],
  [[9, 9, 9, 9], 18],
]

// 4 Zahlen, nur ÷ (26 entries). Every entry has the form [a,b,b,b], target
// = b³÷a.
const EXCEPTIONS_4_DIVIDE: Exception[] = [
  [[1, 2, 2, 2], 8], [[1, 3, 3, 3], 27], [[1, 4, 4, 4], 64], [[1, 5, 5, 5], 125],
  [[1, 6, 6, 6], 216], [[1, 7, 7, 7], 343], [[1, 8, 8, 8], 512], [[1, 9, 9, 9], 729],
  [[2, 2, 2, 2], 4], [[2, 4, 4, 4], 32], [[2, 6, 6, 6], 108], [[2, 8, 8, 8], 256],
  [[3, 3, 3, 3], 9], [[3, 6, 6, 6], 72], [[3, 9, 9, 9], 243], [[4, 4, 4, 4], 16],
  [[4, 4, 4, 8], 8], [[4, 6, 6, 6], 54], [[4, 8, 8, 8], 128], [[5, 5, 5, 5], 25],
  [[6, 6, 6, 6], 36], [[6, 6, 6, 8], 27], [[6, 6, 6, 9], 24], [[7, 7, 7, 7], 49],
  [[8, 8, 8, 8], 64], [[9, 9, 9, 9], 81],
]

function exceptionList(settings: PuzzleSettings): Exception[] | null {
  if (settings.numbers !== 4 || settings.ops.length !== 1) return null
  if (settings.ops[0] === '-') return EXCEPTIONS_4_MINUS
  if (settings.ops[0] === '/') return EXCEPTIONS_4_DIVIDE
  return null
}

function randomNumbers(count: number): number[] {
  return Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 9))
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

// checkNextPuzzle.mjs measured the retry loop below across all 45
// selections: without uniqueOnly, worst case stays in the low double
// digits; "3 Zahlen, nur ÷" is the one uniqueOnly selection without an
// exception list and needs more headroom (median 36, up to ~150). 300
// covers every measured case with margin.
const MAX_ATTEMPTS = 300

/**
 * A fresh puzzle for these settings, generated on the device (concept
 * 15.10): draw random numbers, ask the solver what's reachable, keep it if
 * the target lands in the selected band, otherwise draw again. The two
 * settings combinations with a thin uniqueOnly pool (concept 15.11) skip
 * the draw loop and pick straight from their exception list instead.
 */
export function nextPuzzle(settings: PuzzleSettings): Puzzle {
  const row = bandRow(settings)
  const [lo, hi] = row.bands[settings.band]

  if (settings.uniqueOnly) {
    const exceptions = exceptionList(settings)
    if (exceptions) {
      const inBand = exceptions.filter(([, target]) => target >= lo && target <= hi)
      const [numbers, target] = pickRandom(inBand)
      return { numbers: [...numbers], target }
    }
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const numbers = randomNumbers(settings.numbers)
    const candidates = reachable(numbers, settings.ops).filter(
      e => e.target >= lo && e.target <= hi && (!settings.uniqueOnly || e.uniqueSolution)
    )
    if (candidates.length > 0) return { numbers, target: pickRandom(candidates).target }
  }

  throw new Error(
    `nextPuzzle: no candidate found after ${MAX_ATTEMPTS} attempts for ${settings.numbers} numbers, ` +
    `ops "${settings.ops.join('')}", band ${settings.band}${settings.uniqueOnly ? ', uniqueOnly' : ''} — ` +
    'settings.ts should not be offering this combination (concept 15.6/15.9).'
  )
}

/** Whether concept 15.6's uniqueOnly switch has anything to offer for this selection. */
export function uniqueOnlyAvailable(numbers: PuzzleSettings['numbers'], ops: Operator[]): boolean {
  const row = BAND_TABLE[`${numbers}-${opsMask(ops)}`]
  return row !== undefined && row.unique > 0
}
