// Dumps the full uniqueOnly solution pool for the two selections
// checkNextPuzzle.mjs found too thin for blind redraw: 4 numbers with only
// '-', and 4 numbers with only '/' (concept 15.11's exception lists). Same
// depth-1 model as checkDepth1.mjs / checkBankShapes.mjs / checkNextPuzzle.mjs.
//
// Run with: node scripts/dumpUniqueExceptions.mjs

function apply(a, op, b) {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '*': return a * b
    case '/': return b === 0 ? NaN : a / b
  }
}
function evalFlat(nums, ops) {
  const n = [nums[0]]; const o = []
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === '*' || ops[i] === '/') {
      n[n.length - 1] = apply(n[n.length - 1], ops[i], nums[i + 1])
      if (!isFinite(n[n.length - 1])) return NaN
    } else { o.push(ops[i]); n.push(nums[i + 1]) }
  }
  let acc = n[0]
  for (let i = 0; i < o.length; i++) acc = apply(acc, o[i], n[i + 1])
  return acc
}
function evalArrangement(perm, comp, ops) {
  const n = perm.length; const operands = []; let numIdx = 0, opIdx = 0
  for (const size of comp) {
    if (size === 1) { operands.push(perm[numIdx++]) }
    else {
      const v = evalFlat(perm.slice(numIdx, numIdx + size), ops.slice(opIdx, opIdx + size - 1))
      if (!isFinite(v)) return NaN
      operands.push(v); numIdx += size; opIdx += size - 1
    }
    if (numIdx < n) opIdx++
  }
  const joinOps = []; let cursor = 0
  for (let i = 0; i < comp.length - 1; i++) { cursor += comp[i] - 1; joinOps.push(ops[cursor]); cursor += 1 }
  return evalFlat(operands, joinOps)
}
function exprString(perm, comp, ops) {
  const n = perm.length; const parts = []; let numIdx = 0, opIdx = 0
  for (const size of comp) {
    if (size === 1) { parts.push(String(perm[numIdx++])) }
    else {
      const seg = []
      for (let i = 0; i < size; i++) { seg.push(perm[numIdx + i]); if (i < size - 1) seg.push(ops[opIdx + i]) }
      parts.push('(' + seg.join('') + ')')
      numIdx += size; opIdx += size - 1
    }
    if (numIdx < n) opIdx++
  }
  const out = [parts[0]]; let cursor = 0
  for (let i = 0; i < comp.length - 1; i++) { cursor += comp[i] - 1; out.push(ops[cursor]); out.push(parts[i + 1]); cursor += 1 }
  return out.join('')
}
function canonicalFlat(tokens, ops) {
  const terms = [{ sign: '+', factors: [tokens[0]] }]
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i], tok = tokens[i + 1]
    if (op === '+' || op === '-') terms.push({ sign: op, factors: [tok] })
    else if (op === '*') terms[terms.length - 1].factors.push(tok)
    else terms[terms.length - 1].factors.push('÷' + tok)
  }
  return terms.map(t => t.sign + [...t.factors].sort().join('·')).sort().join('')
}
function canonicalArrangement(perm, comp, ops) {
  const n = perm.length; const topTokens = []; let numIdx = 0, opIdx = 0
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
  const joinOps = []; let cursor = 0
  for (let i = 0; i < comp.length - 1; i++) { cursor += comp[i] - 1; joinOps.push(ops[cursor]); cursor += 1 }
  return canonicalFlat(topTokens, joinOps)
}
function compositions(n) {
  if (n === 0) return [[]]
  const out = []
  for (let first = 1; first <= n; first++) for (const rest of compositions(n - first)) out.push([first, ...rest])
  return out
}
function permIndices(n) {
  const out = []; const arr = Array.from({ length: n }, (_, i) => i)
  const rec = k => {
    if (k === n) { out.push(arr.slice()); return }
    for (let i = k; i < n; i++) { [arr[k], arr[i]] = [arr[i], arr[k]]; rec(k + 1); [arr[k], arr[i]] = [arr[i], arr[k]] }
  }
  rec(0); return out
}
function cartesian(items, k) {
  let result = [[]]
  for (let i = 0; i < k; i++) { const next = []; for (const c of result) for (const it of items) next.push([...c, it]); result = next }
  return result
}
function multisets(n) {
  const out = []
  const rec = (start, arr) => { if (arr.length === n) { out.push(arr.slice()); return }; for (let v = start; v <= 9; v++) { arr.push(v); rec(v, arr); arr.pop() } }
  rec(1, []); return out
}

const PERM_IDX = { 3: permIndices(3), 4: permIndices(4) }
const COMPS = { 3: compositions(3).filter(c => c.length > 1), 4: compositions(4).filter(c => c.length > 1) }

function uniquePairs(n, ops) {
  const optuples = cartesian(ops, n - 1)
  const rows = []
  for (const nums of multisets(n)) {
    const targets = new Map() // target -> [{key, perm, comp, ops}]
    for (const comp of COMPS[n]) {
      for (const permI of PERM_IDX[n]) {
        const permVals = permI.map(i => nums[i])
        for (const opTuple of optuples) {
          const r = evalArrangement(permVals, comp, opTuple)
          if (!isFinite(r) || r < 1 || r > 999) continue
          const t = Math.round(r)
          if (Math.abs(r - t) > 1e-9) continue
          const key = canonicalArrangement(permVals, comp, opTuple)
          let e = targets.get(t)
          if (!e) { e = new Map(); targets.set(t, e) }
          if (!e.has(key)) e.set(key, exprString(permVals, comp, opTuple))
        }
      }
    }
    for (const [t, sols] of targets) {
      if (sols.size === 1) rows.push({ nums: nums.slice(), target: t, expr: [...sols.values()][0] })
    }
  }
  return rows
}

function band(rows, lo, hi) { return rows.filter(r => r.target >= lo && r.target <= hi) }

const SELECTIONS = [
  ['4 Zahlen, nur −', 4, ['-'], [[1,5],[5,10],[11,26]], 'EXCEPTIONS_4_MINUS'],
  ['4 Zahlen, nur ÷', 4, ['/'], [[1,12],[12,42],[42,729]], 'EXCEPTIONS_4_DIVIDE'],
]

for (const [label, n, ops, bands] of SELECTIONS) {
  const rows = uniquePairs(n, ops)
  console.log(`\n=== ${label} (total unique: ${rows.length}) ===`)
  bands.forEach(([lo,hi], i) => {
    const b = band(rows, lo, hi)
    console.log(`  band ${i} [${lo},${hi}]: ${b.length} entries`)
    b.forEach(r => console.log(`    [${r.nums.join(',')}] -> ${r.target}   (${r.expr}=${r.target})`))
  })
}

// Flat, deduplicated TS array literal (no per-band boundary duplication) —
// this is what's embedded in src/core/puzzles.ts. Regenerate and paste in
// after any change to the depth-1 model.
console.log('\n--- TS literals for src/core/puzzles.ts ---')
for (const [label, n, ops, , constName] of SELECTIONS) {
  const rows = uniquePairs(n, ops)
  console.log(`\n// ${label} (${rows.length} entries)`)
  console.log(`const ${constName}: Exception[] = [`)
  console.log(rows.map(r => `  [[${r.nums.join(', ')}], ${r.target}],`).join('\n'))
  console.log(']')
}
