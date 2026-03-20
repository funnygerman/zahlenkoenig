// Run with: node --max-old-space-size=512 scripts/generatePuzzles.mjs
// Duration estimate: F2 ~30s, F3 ~3min, E1 ~5min

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '../src/data')

const LEVELS = {
  F2: { numberCount: 3, operators: ['+','-','*','/'], maxBracketDepth: 1, targetRange: { min: 1, max: 100 }, count: 500 },
  F3: { numberCount: 4, operators: ['+','-','*','/'], maxBracketDepth: 1, targetRange: { min: 1, max: 100 }, count: 500 },
  E1: { numberCount: 4, operators: ['+','-','*','/'], maxBracketDepth: 2, targetRange: { min: 1, max: 100 }, count: 500 },
}

// Max attempts per level = count * MAX_ATTEMPTS_FACTOR
// Higher = more time but more unique puzzles
const MAX_ATTEMPTS_FACTOR = 200

function safeEval(expr) {
  try {
    const r = Function('"use strict"; return (' + expr + ')')()
    if (typeof r !== 'number' || !isFinite(r)) return null
    if (Math.abs(r - Math.round(r)) > 1e-9) return null
    return Math.round(r)
  } catch { return null }
}

// Pre-computed permutation index tables
const PERMS3 = [
  [0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]
]
const PERMS4 = (() => {
  const result = []
  for (let a = 0; a < 4; a++)
    for (let b = 0; b < 4; b++) { if (b===a) continue
      for (let c = 0; c < 4; c++) { if (c===a||c===b) continue
        for (let d = 0; d < 4; d++) { if (d===a||d===b||d===c) continue
          result.push([a,b,c,d])
        }
      }
    }
  return result
})()

const OPS = ['+','-','*','/']

function findSolutions3(nums, target, maxBrackets) {
  const seen = new Set()
  const solutions = []
  for (const [i,j,k] of PERMS3) {
    const [a,b,c] = [nums[i], nums[j], nums[k]]
    for (const o1 of OPS) for (const o2 of OPS) {
      const exprs = [`${a}${o1}${b}${o2}${c}`]
      if (maxBrackets >= 1) exprs.push(`(${a}${o1}${b})${o2}${c}`, `${a}${o1}(${b}${o2}${c})`)
      for (const e of exprs) {
        const r = safeEval(e)
        if (r === target && !seen.has(e)) { seen.add(e); solutions.push(e) }
      }
    }
  }
  return solutions
}

function findSolutions4(nums, target, maxBrackets) {
  const seen = new Set()
  const solutions = []
  for (const [i,j,k,l] of PERMS4) {
    const [a,b,c,d] = [nums[i], nums[j], nums[k], nums[l]]
    for (const o1 of OPS) for (const o2 of OPS) for (const o3 of OPS) {
      const exprs = [`${a}${o1}${b}${o2}${c}${o3}${d}`]
      if (maxBrackets >= 1) exprs.push(
        `(${a}${o1}${b})${o2}${c}${o3}${d}`,
        `${a}${o1}(${b}${o2}${c})${o3}${d}`,
        `${a}${o1}${b}${o2}(${c}${o3}${d})`,
      )
      if (maxBrackets >= 2) exprs.push(
        `(${a}${o1}${b})${o2}(${c}${o3}${d})`,
        `((${a}${o1}${b})${o2}${c})${o3}${d}`,
        `${a}${o1}(${b}${o2}(${c}${o3}${d}))`,
      )
      for (const e of exprs) {
        const r = safeEval(e)
        if (r === target && !seen.has(e)) {
          seen.add(e); solutions.push(e)
          if (solutions.length > 10) return solutions
        }
      }
    }
  }
  return solutions
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`
  return `${Math.floor(ms/60000)}m ${Math.floor((ms%60000)/1000)}s`
}

mkdirSync(OUTPUT_DIR, { recursive: true })

const totalStart = Date.now()

for (const [levelId, level] of Object.entries(LEVELS)) {
  const { numberCount, maxBracketDepth, targetRange, count } = level
  const find = numberCount === 3 ? findSolutions3 : findSolutions4
  const maxAttempts = count * MAX_ATTEMPTS_FACTOR

  console.log(`\nGenerating ${count} puzzles for ${levelId} (max ${maxAttempts} attempts)...`)
  const levelStart = Date.now()

  const puzzles = []
  const seen = new Set()
  let attempts = 0

  while (puzzles.length < count && attempts < maxAttempts) {
    attempts++
    const numbers = Array.from({ length: numberCount }, () => randomInt(1, 9))
    const target = randomInt(targetRange.min, targetRange.max)
    const solutions = find(numbers, target, maxBracketDepth)
    if (solutions.length < 1 || solutions.length > 5) continue
    const key = `${[...numbers].sort().join(',')}-${target}`
    if (seen.has(key)) continue
    seen.add(key)
    puzzles.push({ numbers, target, solutions: solutions.slice(0, 3), levelId })

    if (puzzles.length % 50 === 0) {
      const elapsed = Date.now() - levelStart
      const rate = puzzles.length / (elapsed / 1000)
      const remaining = (count - puzzles.length) / rate
      process.stdout.write(`  ${puzzles.length}/${count} (${formatTime(elapsed)} elapsed, ~${formatTime(remaining * 1000)} remaining)\r`)
    }
  }

  const elapsed = Date.now() - levelStart
  writeFileSync(join(OUTPUT_DIR, `puzzles-${levelId}.json`), JSON.stringify(puzzles))
  console.log(`  ✅ ${puzzles.length}/${count} puzzles in ${formatTime(elapsed)} → src/data/puzzles-${levelId}.json`)

  if (puzzles.length < count) {
    console.log(`  ⚠️  Only ${puzzles.length} unique puzzles found (increase MAX_ATTEMPTS_FACTOR for more)`)
  }
}

console.log(`\nTotal time: ${formatTime(Date.now() - totalStart)}`)
console.log('Done! Commit the src/data/ folder to GitHub.')
