// Verifies the retry-count distribution of nextPuzzle(), the on-device
// generator that replaces the puzzle bank (concept 15.10): draw random
// numbers, ask the solver for every reachable target under the chosen
// operators, keep it if the target lands in the selection's band, otherwise
// draw again.
//
// This script answers the question concept 18 ("Vor Schritt 2b") leaves
// open: how many draws does that retry loop actually need, worst case,
// across all 45 selections (number count × operator subset)? The answer
// decides whether nextPuzzle() can run synchronously on the main thread or
// needs a Web Worker.
//
// Same model as checkDepth1.mjs / checkBankShapes.mjs: operands in a row,
// each operand a bare number or a flat group of >=2 numbers, no group
// inside a group, standard precedence. Reused here, not reimplemented.
//
// Two things are computed together per selection, from the same exhaustive
// per-multiset table, because production would do the same:
//   1. the band boundaries (concept 15.5) — split the reachable targets of
//      every number multiset into three equal-sized bands,
//   2. the retry distribution of nextPuzzle() drawing against those bands.
//
// Expect this to take a minute or so for the 4-number selections — it is an
// exhaustive count over 495 multisets x up to 4 operators x 24 permutations
// x 8 group shapes, run once per one of the 15 operator subsets.
//
// Run with: node scripts/checkNextPuzzle.mjs

const ALL_OPS = ['+', '-', '*', '/']
const TARGET_MAX = 999 // concept 15.5: the target chip caps at three digits
const TRIALS = 1500
const MAX_ATTEMPTS = 200 // a run hitting this is itself the finding

function apply(a, op, b) {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '*': return a * b
    case '/': return b === 0 ? NaN : a / b
  }
}

// Evaluate a flat alternating list [num, op, num, op, num...] with precedence.
function evalFlat(nums, ops) {
  const n = [nums[0]]
  const o = []
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

// Evaluate one v2 arrangement: a permutation split by a composition (group
// sizes left to right), operators laid out across groups and joins alike.
function evalArrangement(perm, comp, ops) {
  const n = perm.length
  const operands = []
  let numIdx = 0, opIdx = 0
  for (const size of comp) {
    if (size === 1) { operands.push(perm[numIdx++]) }
    else {
      const v = evalFlat(perm.slice(numIdx, numIdx + size), ops.slice(opIdx, opIdx + size - 1))
      if (!isFinite(v)) return NaN
      operands.push(v)
      numIdx += size; opIdx += size - 1
    }
    if (numIdx < n) opIdx++
  }
  const joinOps = []
  let cursor = 0
  for (let i = 0; i < comp.length - 1; i++) {
    cursor += comp[i] - 1
    joinOps.push(ops[cursor])
    cursor += 1
  }
  return evalFlat(operands, joinOps)
}

// Canonical form of a flat +-*/ chain, treating it as what it actually is:
// an abelian sum of signed terms, each an abelian product of factors (a
// divisor is just a factor with a negative exponent). Reordering under
// commutativity always yields the same value in real arithmetic, so two
// arrangements are "the same solution" (concept 15.7: "5+6 und 6+5 sind
// dieselbe Lösung") exactly when this string matches.
function canonicalFlat(tokens, ops) {
  const terms = [{ sign: '+', factors: [tokens[0]] }]
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i], tok = tokens[i + 1]
    if (op === '+' || op === '-') terms.push({ sign: op, factors: [tok] })
    else if (op === '*') terms[terms.length - 1].factors.push(tok)
    else terms[terms.length - 1].factors.push('÷' + tok) // '/': a tagged factor, still sortable
  }
  const termStrings = terms.map(t => t.sign + [...t.factors].sort().join('·'))
  return termStrings.sort().join('')
}

// Same recursion as evalArrangement, but building a canonical string instead
// of a number. A group becomes an opaque parenthesised token at the top
// level — its own commutativity is already resolved before it gets there,
// so "4×2×3×1" and "(1+2+3)×4" (different group shapes) never collide.
function canonicalArrangement(perm, comp, ops) {
  const n = perm.length
  const topTokens = []
  let numIdx = 0, opIdx = 0
  for (const size of comp) {
    if (size === 1) { topTokens.push(String(perm[numIdx++])) }
    else {
      const gTokens = perm.slice(numIdx, numIdx + size).map(String)
      const gOps = ops.slice(opIdx, opIdx + size - 1)
      topTokens.push('(' + canonicalFlat(gTokens, gOps) + ')')
      numIdx += size; opIdx += size - 1
    }
    if (numIdx < n) opIdx++
  }
  const joinOps = []
  let cursor = 0
  for (let i = 0; i < comp.length - 1; i++) {
    cursor += comp[i] - 1
    joinOps.push(ops[cursor])
    cursor += 1
  }
  return canonicalFlat(topTokens, joinOps)
}

// Compositions of n: ways to split into consecutive parts. A part of size 1
// is a bare number, size >= 2 a flat group. No part ever exceeds what fits
// in the block budget (floor(n/2) chips) — for n <= 4 that is structural,
// not something this script needs to filter for.
function compositions(n) {
  if (n === 0) return [[]]
  const out = []
  for (let first = 1; first <= n; first++)
    for (const rest of compositions(n - first)) out.push([first, ...rest])
  return out
}

function permIndices(n) {
  const out = []
  const arr = Array.from({ length: n }, (_, i) => i)
  const rec = k => {
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

function cartesian(items, k) {
  let result = [[]]
  for (let i = 0; i < k; i++) {
    const next = []
    for (const combo of result) for (const item of items) next.push([...combo, item])
    result = next
  }
  return result
}

function multisets(n) {
  const out = []
  const rec = (start, arr) => {
    if (arr.length === n) { out.push(arr.slice()); return }
    for (let v = start; v <= 9; v++) { arr.push(v); rec(v, arr); arr.pop() }
  }
  rec(1, [])
  return out
}

function opSubsets() {
  const out = []
  for (let mask = 1; mask < 16; mask++) out.push(ALL_OPS.filter((_, i) => mask & (1 << i)))
  return out
}

const PERM_IDX = { 2: permIndices(2), 3: permIndices(3), 4: permIndices(4) }
const COMPS = { 2: compositions(2), 3: compositions(3), 4: compositions(4) }

// The single composition [n] — one group spanning the whole expression
// (concept 17: "Gruppe um den ganzen Ausdruck – erlaubt, verbraucht aber das
// Kontingent ohne Nutzen") — has no outside operator for the bracket to
// protect against, so it always evaluates identically to the fully flat
// arrangement of the same permutation and operators. Left in, it silently
// doubles every canonical-solution count (a bracketed twin for every flat
// arrangement) and drove measured uniqueness to 0 for every 2-number
// selection. It adds no reachable value either way, so it is dropped here —
// for value reachability that changes nothing, for uniqueness it removes a
// false negative.
const USEFUL_COMPS = Object.fromEntries(
  Object.entries(COMPS).map(([n, comps]) => [n, comps.filter(c => c.length > 1)])
)

// ---------------------------------------------------------------- self-check
// Guard against a canonicalizer that always (or never) agrees, and against a
// reachability model that has quietly drifted from checkDepth1.mjs's.
{
  const fails = []

  const a = canonicalArrangement([5, 6], [1, 1], ['+'])
  const b = canonicalArrangement([6, 5], [1, 1], ['+'])
  if (a !== b) fails.push(`5+6 and 6+5 should canonicalize the same (got "${a}" vs "${b}")`)

  // 4×2×3×1 and (1+2+3)×4 both reach 24 from {1,2,3,4} — different shapes,
  // must stay distinct solutions (concept 15.7's own example).
  const flat = canonicalArrangement([4, 2, 3, 1], [1, 1, 1, 1], ['*', '*', '*'])
  const grouped = canonicalArrangement([1, 2, 3, 4], [3, 1], ['+', '+', '*'])
  if (evalArrangement([4, 2, 3, 1], [1, 1, 1, 1], ['*', '*', '*']) !== 24) fails.push('4*2*3*1 should be 24')
  if (evalArrangement([1, 2, 3, 4], [3, 1], ['+', '+', '*']) !== 24) fails.push('(1+2+3)*4 should be 24')
  if (flat === grouped) fails.push('4×2×3×1 and (1+2+3)×4 should NOT canonicalize the same')

  // Swapping the two equal group operands of a symmetric shape must still
  // collapse: (2+3)+(3+2) reordered is still one solution.
  const c = canonicalArrangement([2, 3, 3, 2], [2, 2], ['+', '+', '+'])
  const d = canonicalArrangement([3, 2, 2, 3], [2, 2], ['+', '+', '+'])
  if (c !== d) fails.push('(2+3)+(3+2) reordered should canonicalize the same')

  // Known depth-1 (un)solvability facts (checkDepth1.mjs's own self-check),
  // recomputed here through this script's own reachable-target machinery.
  const reach = (nums, ops) => {
    const targets = new Set()
    for (const comp of COMPS[nums.length])
      for (const permI of PERM_IDX[nums.length])
        for (const opTuple of cartesian(ops, nums.length - 1)) {
          const r = evalArrangement(permI.map(i => nums[i]), comp, opTuple)
          if (isFinite(r) && r >= 0 && Math.abs(r - Math.round(r)) < 1e-9) targets.add(Math.round(r))
        }
    return targets
  }
  if (reach([1, 1, 1, 1], ALL_OPS).has(1000)) fails.push('[1,1,1,1] should not reach 1000')
  if (!reach([9, 9, 9, 9], ALL_OPS).has(243)) fails.push('[9,9,9,9] should reach 243')

  if (fails.length) {
    console.log('SELF-CHECK FAILED:'); fails.forEach(f => console.log('  ' + f)); process.exit(1)
  }
  console.log('self-check ok\n')
}

// ------------------------------------------------------- per-selection work
// Build the exhaustive per-multiset target table for one (numberCount, ops)
// selection, derive its three bands from it, and hand back everything
// simulate() needs to answer "does a random draw land in this band?" by
// lookup instead of by recomputing.
function buildSelection(n, ops) {
  const optuples = cartesian(ops, n - 1)
  const byMultiset = new Map()
  const pairs = []
  let uniqueTotal = 0

  for (const nums of multisets(n)) {
    const targets = new Map() // target -> Set(canonical key)
    for (const comp of USEFUL_COMPS[n]) {
      for (const permI of PERM_IDX[n]) {
        const permVals = permI.map(i => nums[i])
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
    const allTargets = [...targets.keys()]
    const uniqueTargets = allTargets.filter(t => targets.get(t).size === 1)
    uniqueTotal += uniqueTargets.length
    byMultiset.set(nums.join(','), { targets: allTargets, unique: uniqueTargets })
    for (const t of allTargets) pairs.push(t)
  }

  pairs.sort((x, y) => x - y)
  const total = pairs.length
  const i1 = Math.floor(total / 3), i2 = Math.floor((2 * total) / 3)
  const band = (from, to) => ({ lo: pairs[from], hi: pairs[to - 1], count: to - from })
  const bands = [band(0, i1), band(i1, i2), band(i2, total)]

  return { byMultiset, bands, total, uniqueTotal }
}

// One simulated nextPuzzle() call: draw n random numbers, look up their
// precomputed reachable targets (no recomputation — same table the band
// split came from), keep drawing until one lands in the band.
function simulate(n, selection, band, uniqueOnly) {
  const attempts = []
  let failures = 0
  for (let trial = 0; trial < TRIALS; trial++) {
    let tries = 0, hit = false
    while (tries < MAX_ATTEMPTS) {
      tries++
      const nums = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 9)).sort((x, y) => x - y)
      const entry = selection.byMultiset.get(nums.join(','))
      const pool = uniqueOnly ? entry.unique : entry.targets
      if (pool.some(t => t >= band.lo && t <= band.hi)) { hit = true; break }
    }
    if (hit) attempts.push(tries)
    else failures++
  }
  attempts.sort((x, y) => x - y)
  const at = p => (attempts.length ? attempts[Math.min(attempts.length - 1, Math.floor(p * attempts.length))] : null)
  return { failures, min: attempts[0] ?? null, median: at(0.5), p95: at(0.95), max: attempts[attempts.length - 1] ?? null }
}

// --------------------------------------------------------------------- main
const BAND_NAMES = ['klein', 'mittel', 'groß']
let worstMax = 0
let anyFailure = false

for (const n of [2, 3, 4]) {
  console.log(`\n=== ${n} Zahlen ===`)
  console.log('ops     n      u      band     [lo,hi]        attempts min/median/p95/max   failures')
  for (const ops of opSubsets()) {
    const selection = buildSelection(n, ops)
    const opsLabel = ops.join('').padEnd(4)
    for (let b = 0; b < 3; b++) {
      const band = selection.bands[b]
      const r = simulate(n, selection, band, false)
      worstMax = Math.max(worstMax, r.max ?? MAX_ATTEMPTS)
      if (r.failures > 0) anyFailure = true
      console.log(
        `${opsLabel} ${String(selection.total).padStart(5)}  ${String(selection.uniqueTotal).padStart(5)}  ` +
        `${BAND_NAMES[b].padEnd(6)}  [${band.lo},${band.hi}]`.padEnd(28) +
        `${String(r.min).padStart(3)}/${String(r.median).padStart(3)}/${String(r.p95).padStart(3)}/${String(r.max).padStart(3)}` +
        `                 ${r.failures}`
      )

      if (selection.uniqueTotal > 0) {
        const ru = simulate(n, selection, band, true)
        worstMax = Math.max(worstMax, ru.max ?? MAX_ATTEMPTS)
        if (ru.failures > 0) anyFailure = true
        console.log(
          `${''.padEnd(5)} ${''.padStart(5)}  ${''.padStart(5)}  (uniqueOnly)`.padEnd(28 + 11) +
          `${String(ru.min).padStart(3)}/${String(ru.median).padStart(3)}/${String(ru.p95).padStart(3)}/${String(ru.max).padStart(3)}` +
          `                 ${ru.failures}`
        )
      }
    }
  }
}

console.log(`\nWorst-case attempts across all selections and bands: ${worstMax}`)
if (anyFailure) {
  console.log(`At least one (selection, band) never hit within ${MAX_ATTEMPTS} attempts in ${TRIALS} trials — see the rows with failures > 0.`)
  console.log('That selection needs either a pre-drawn fallback multiset or more attempts before nextPuzzle() gives up.')
} else if (worstMax > 20) {
  console.log('Worst case is double digits — fine for a synchronous call, but close enough to the margin that it is worth re-checking on a slow device before ruling out a Web Worker.')
} else {
  console.log('Worst case stays small across every selection — a synchronous nextPuzzle() on the main thread is safe, no Web Worker needed.')
}
