// Can every E1 puzzle be solved using only depth-<=1 groups?
// Structure: operands in a row, each operand is either a bare number or a
// group of >=2 numbers. No group inside a group. Standard precedence.
import { readFileSync } from 'node:fs'

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

// Compositions of n: ways to split into consecutive parts.
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

function solvableDepth1(numbers, target) {
  const n = numbers.length
  const comps = compositions(n)
  for (const perm of permutations(numbers)) {
    for (const comp of comps) {
      for (const ops of opAssignments(n - 1)) {
        // Split perm into parts per comp; each part of size>1 is a group.
        const operands = []
        let numIdx = 0, opIdx = 0, ok = true
        for (const size of comp) {
          if (size === 1) { operands.push(perm[numIdx++]) }
          else {
            const gNums = perm.slice(numIdx, numIdx + size)
            const gOps = ops.slice(opIdx, opIdx + size - 1)
            const v = evalFlat(gNums, gOps)
            if (!isFinite(v)) { ok = false; break }
            operands.push(v)
            numIdx += size; opIdx += size - 1
          }
          // the operator joining this part to the next is consumed below
          if (numIdx < n) opIdx++
        }
        if (!ok) continue
        // Operators between operands are those at the join positions.
        const joinOps = []
        let idx = 0, cursor = 0
        for (let i = 0; i < comp.length - 1; i++) {
          cursor += comp[i] - 1          // ops consumed inside part i
          joinOps.push(ops[cursor])
          cursor += 1                     // the join op itself
        }
        const result = evalFlat(operands, joinOps)
        if (isFinite(result) && result >= 0 && Math.abs(result - target) < 1e-9) return true
      }
    }
  }
  return false
}

let checked = 0, failed = []
for (const f of ['E1-1', 'E1-2', 'E1-3']) {
  const puzzles = JSON.parse(readFileSync(`src/data/puzzles-${f}.json`, 'utf8'))
  for (const p of puzzles) {
    checked++
    if (!solvableDepth1(p.numbers, p.target)) failed.push(`${f} ${p.numbers.join(',')} → ${p.target}`)
  }
}
console.log(`checked ${checked} E1 puzzles`)
console.log(`unsolvable with depth<=1: ${failed.length}`)
failed.slice(0, 15).forEach(x => console.log('  ' + x))
