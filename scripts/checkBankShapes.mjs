// Does the v1 puzzle generator cover the shapes v2 lets the player build?
//
// v1 counts brackets: at maxBracketDepth 1 it enumerates a fixed list of four
// shapes for four numbers. v2 counts nesting instead — one level of grouping,
// any number of sibling groups, each of any size >= 2, never nested. Those are
// not the same rule, and this script shows exactly which v2 shapes the v1 list
// leaves out, plus what the banks lose by it.
//
// Run with: node scripts/checkBankShapes.mjs
import { readFileSync, existsSync } from 'node:fs'

const OPS = ['+', '-', '*', '/']

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

function* permutations(arr) {
  if (arr.length <= 1) { yield arr; return }
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1))
    for (const p of permutations(rest)) yield [arr[i], ...p]
  }
}

// Compositions of n: ways to split into consecutive parts. Each part of size
// >= 2 is a group; a part of size 1 is a bare number.
function compositions(n) {
  if (n === 0) return [[]]
  const out = []
  for (let first = 1; first <= n; first++)
    for (const rest of compositions(n - first)) out.push([first, ...rest])
  return out
}

function* opAssignments(k) {
  if (k === 0) { yield []; return }
  for (const op of OPS) for (const rest of opAssignments(k - 1)) yield [op, ...rest]
}

// Evaluate one v2 arrangement: a permutation split by a composition, with the
// operators laid out left to right across groups and joins alike.
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

// Which compositions the v1 generator actually enumerates at a given bracket
// budget. v1 hardcodes these shapes; see scripts/generatePuzzles.mjs.
function v1Compositions(n, maxBrackets) {
  if (n === 2) return [[1, 1]]
  if (n === 3) {
    return maxBrackets >= 1 ? [[1, 1, 1], [2, 1], [1, 2]] : [[1, 1, 1]]
  }
  const flat = [[1, 1, 1, 1]]
  if (maxBrackets >= 1) flat.push([2, 1, 1], [1, 2, 1], [1, 1, 2])
  if (maxBrackets >= 2) flat.push([2, 2]) // v1 counts this as two brackets
  return flat
}

// All targets reachable from a multiset, restricted to a set of compositions.
// Returns Map target -> { count, minGroups }.
function reachable(numbers, comps) {
  const n = numbers.length
  const map = new Map()
  for (const perm of permutations(numbers))
    for (const comp of comps)
      for (const ops of opAssignments(n - 1)) {
        const r = evalArrangement(perm, comp, ops)
        if (!isFinite(r) || r < 0) continue
        const t = Math.round(r)
        if (Math.abs(r - t) > 1e-9) continue
        const groups = comp.filter(s => s > 1).length
        const e = map.get(t)
        if (e) { e.count++; if (groups < e.minGroups) e.minGroups = groups }
        else map.set(t, { count: 1, minGroups: groups })
      }
  return map
}

function multisets(n) {
  const out = []
  if (n === 3) {
    for (let a = 1; a <= 9; a++) for (let b = a; b <= 9; b++) for (let c = b; c <= 9; c++) out.push([a, b, c])
  } else {
    for (let a = 1; a <= 9; a++) for (let b = a; b <= 9; b++) for (let c = b; c <= 9; c++) for (let d = c; d <= 9; d++) out.push([a, b, c, d])
  }
  return out
}

// ---------------------------------------------------------------- self-check
// Guard against an always-true result: the shape lists must differ where we
// claim they do, and agree where we claim they do.
{
  const fails = []
  const c3v2 = compositions(3).map(String)
  const c3v1 = v1Compositions(3, 1).map(String)
  const c4v2 = compositions(4).map(String)
  const c4v1 = v1Compositions(4, 1).map(String)

  // (1+1+1)*3 = 9 needs a three-number group; v1 has no such shape.
  if (evalArrangement([1, 1, 1, 3], [3, 1], ['+', '+', '*']) !== 9) fails.push('(1+1+1)*3 should be 9')
  // (1+1)*(1+2) = 6 needs two sibling groups; v1 files that under two brackets.
  if (evalArrangement([1, 1, 1, 2], [2, 2], ['+', '*', '+']) !== 6) fails.push('(1+1)*(1+2) should be 6')
  if (!c4v2.includes('3,1') || c4v1.includes('3,1')) fails.push('3,1 should be v2-only')
  if (!c4v2.includes('2,2') || c4v1.includes('2,2')) fails.push('2,2 should be missing from v1 at depth 1')
  if (!c4v1.every(c => c4v2.includes(c))) fails.push('v1 shapes should all be legal in v2')
  if (!c3v1.every(c => c3v2.includes(c))) fails.push('v1 3-number shapes should all be legal in v2')

  if (fails.length) {
    console.log('SELF-CHECK FAILED:'); fails.forEach(f => console.log('  ' + f)); process.exit(1)
  }
  console.log('self-check ok\n')
}

// ------------------------------------------------------------------ shapes
console.log('Shapes per number count (group sizes left to right):\n')
for (const n of [3, 4]) {
  const v2 = compositions(n).map(c => c.join('+'))
  const v1 = v1Compositions(n, 1).map(c => c.join('+'))
  const missing = v2.filter(s => !v1.includes(s))
  console.log(`  ${n} numbers`)
  console.log(`    v1 at maxBracketDepth 1 : ${v1.join('  ')}`)
  console.log(`    v2 (one level, no nesting): ${v2.join('  ')}`)
  console.log(`    missing from v1          : ${missing.join('  ') || '(none)'}`)
}
console.log()

// ------------------------------------------------- puzzles v1 cannot express
// Puzzles that v2 solves but that v1's depth-1 enumeration never reaches. These
// are the ones the F3 banks can never contain.
{
  const v1 = v1Compositions(4, 1)
  const v2 = compositions(4)
  const examples = []
  let missed = 0
  for (const nums of multisets(4)) {
    const rV1 = reachable(nums, v1)
    const rV2 = reachable(nums, v2)
    for (let t = 1; t <= 171; t++) {
      if (rV1.has(t) || !rV2.has(t)) continue
      missed++
      if (examples.length < 8) {
        // name a composition that does reach it, for the write-up
        let shape = '?'
        outer: for (const perm of permutations(nums))
          for (const comp of v2) {
            if (v1.some(c => String(c) === String(comp))) continue
            for (const ops of opAssignments(3)) {
              const r = evalArrangement(perm, comp, ops)
              if (isFinite(r) && Math.abs(r - t) < 1e-9) { shape = comp.join('+'); break outer }
            }
          }
        examples.push(`${nums.join(',')} → ${t}   (needs group sizes ${shape})`)
      }
    }
  }
  console.log(`4-number puzzles v2 can solve but v1 at depth 1 cannot express: ${missed}`)
  examples.forEach(e => console.log('  ' + e))
  console.log()
}

// --------------------------------------------------- bank size vs the ceiling
// How many puzzles each level could hold if generated exhaustively under the
// v2 rule, against what the bank holds today.
const LEVELS = [
  ['F2.1', 3, 1, 50, 'puzzles-F2-1.json'],
  ['F2.2', 3, 51, 100, 'puzzles-F2-2.json'],
  ['F2.3', 3, 101, 162, 'puzzles-F2-3.json'],
  ['F3.1', 4, 1, 50, 'puzzles-F3-1.json'],
  ['F3.2', 4, 51, 100, 'puzzles-F3-2.json'],
  ['F3.3', 4, 101, 171, 'puzzles-F3-3.json'],
  ['E1.1', 4, 1, 50, 'puzzles-E1-1.json'],
  ['E1.2', 4, 51, 100, 'puzzles-E1-2.json'],
  ['E1.3', 4, 101, 324, 'puzzles-E1-3.json'],
]

const profiles = { 3: null, 4: null }
for (const n of [3, 4]) {
  const comps = compositions(n)
  profiles[n] = multisets(n).map(nums => reachable(nums, comps))
}

console.log('Level   bank   v2 exhaustive   without a block')
for (const [id, n, lo, hi, file] of LEVELS) {
  let total = 0, blockFree = 0
  for (const map of profiles[n]) {
    for (let t = lo; t <= hi; t++) {
      const e = map.get(t)
      if (!e) continue
      total++
      if (e.minGroups === 0) blockFree++
    }
  }
  const path = `src/data/${file}`
  const bank = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).length : 0
  console.log(
    `${id.padEnd(6)} ${String(bank).padStart(5)}   ${String(total).padStart(13)}   ${String(blockFree).padStart(15)}`
  )
}
