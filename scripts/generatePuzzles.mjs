// Run with: node --max-old-space-size=512 scripts/generatePuzzles.mjs
// Generates ALL puzzles for ALL levels into src/data/

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '../src/data')

const LEVELS = {
  A1: { numberCount: 2, operators: ['+','-'],         maxBracketDepth: 0, targetRange: { min:1, max:18  } },
  A2: { numberCount: 3, operators: ['+','-'],         maxBracketDepth: 0, targetRange: { min:1, max:27  } },
  A3: { numberCount: 4, operators: ['+','-'],         maxBracketDepth: 0, targetRange: { min:1, max:36  } },
  F1: { numberCount: 2, operators: ['+','-','*','/'], maxBracketDepth: 0, targetRange: { min:1, max:81  } },
  F2: { numberCount: 3, operators: ['+','-','*','/'], maxBracketDepth: 1, targetRange: { min:1, max:100 } },
  F3: { numberCount: 4, operators: ['+','-','*','/'], maxBracketDepth: 1, targetRange: { min:1, max:100 } },
  E1: { numberCount: 4, operators: ['+','-','*','/'], maxBracketDepth: 2, targetRange: { min:1, max:100 } },
}

// Target puzzle counts per level
// A1-F1 are exhaustive (all possible puzzles), larger levels use random sampling
const TARGET_COUNTS = {
  A1: 999,  // exhaustive (~81 exist)
  A2: 999,  // exhaustive (~192 exist)
  A3: 999,  // exhaustive (~140 exist)
  F1: 999,  // exhaustive (~138 exist)
  F2: 500,
  F3: 500,
  E1: 500,
}

function safeEval(expr) {
  try {
    const r = Function('"use strict"; return (' + expr + ')')()
    if (typeof r !== 'number' || !isFinite(r)) return null
    if (Math.abs(r - Math.round(r)) > 1e-9) return null
    return Math.round(r)
  } catch { return null }
}

const PERMS3 = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]
const PERMS4 = (() => {
  const r = []
  for (let a=0;a<4;a++) for (let b=0;b<4;b++) { if(b===a) continue
    for (let c=0;c<4;c++) { if(c===a||c===b) continue
      for (let d=0;d<4;d++) { if(d===a||d===b||d===c) continue; r.push([a,b,c,d]) }
    }
  }
  return r
})()

function findSolutions2(nums, target, ops) {
  const seen = new Set(), sols = []
  for (const [a,b] of [[nums[0],nums[1]],[nums[1],nums[0]]]) {
    for (const op of ops) {
      if (op==='/'&&b===0) continue
      const r = safeEval(`${a}${op}${b}`)
      if (r===target) {
        const k=(op==='+'||op==='*')?[String(a),String(b)].sort().join(op):`${a}${op}${b}`
        if(!seen.has(k)){seen.add(k);sols.push(`${a}${op}${b}`)}
      }
    }
  }
  return sols
}

function findSolutions3(nums, target, ops, maxBrackets) {
  const seen=new Set(),sols=[]
  for (const [i,j,k] of PERMS3) {
    const [a,b,c]=[nums[i],nums[j],nums[k]]
    for (const o1 of ops) for (const o2 of ops) {
      const exprs=[`${a}${o1}${b}${o2}${c}`]
      if(maxBrackets>=1) exprs.push(`(${a}${o1}${b})${o2}${c}`,`${a}${o1}(${b}${o2}${c})`)
      for (const e of exprs) { const r=safeEval(e); if(r===target&&!seen.has(e)){seen.add(e);sols.push(e)} }
    }
  }
  return sols
}

function findSolutions4(nums, target, ops, maxBrackets) {
  const seen=new Set(),sols=[]
  for (const [i,j,k,l] of PERMS4) {
    const [a,b,c,d]=[nums[i],nums[j],nums[k],nums[l]]
    for (const o1 of ops) for (const o2 of ops) for (const o3 of ops) {
      const exprs=[`${a}${o1}${b}${o2}${c}${o3}${d}`]
      if(maxBrackets>=1) exprs.push(`(${a}${o1}${b})${o2}${c}${o3}${d}`,`${a}${o1}(${b}${o2}${c})${o3}${d}`,`${a}${o1}${b}${o2}(${c}${o3}${d})`)
      if(maxBrackets>=2) exprs.push(`(${a}${o1}${b})${o2}(${c}${o3}${d})`,`((${a}${o1}${b})${o2}${c})${o3}${d}`,`${a}${o1}(${b}${o2}(${c}${o3}${d}))`)
      for (const e of exprs) {
        const r=safeEval(e)
        if(r===target&&!seen.has(e)){seen.add(e);sols.push(e);if(sols.length>10) return sols}
      }
    }
  }
  return sols
}

function findAll(level, levelId) {
  const { numberCount, operators, maxBracketDepth, targetRange } = level
  const find = numberCount===2 ? findSolutions2 : numberCount===3 ? findSolutions3 : findSolutions4
  const puzzles=[], seen=new Set()

  // Exhaustive search for small levels (limited number space)
  if (operators.length === 2) { // +/- only levels: A1, A2, A3
    if (numberCount === 2) {
      for (let a=1;a<=9;a++) for (let b=1;b<=9;b++) {
        for (let t=targetRange.min;t<=targetRange.max;t++) {
          const sols = find([a,b], t, operators)
          if (sols.length>=1&&sols.length<=3) {
            const key=`${[a,b].sort().join(',')}-${t}`
            if(!seen.has(key)){seen.add(key);puzzles.push({numbers:[a,b],target:t,solutions:sols.slice(0,3),levelId})}
          }
        }
      }
    } else if (numberCount === 3) {
      for (let a=1;a<=9;a++) for (let b=1;b<=9;b++) for (let c=1;c<=9;c++) {
        for (let t=targetRange.min;t<=targetRange.max;t++) {
          const sols = find([a,b,c], t, operators, maxBracketDepth)
          if (sols.length>=1&&sols.length<=3) {
            const key=`${[a,b,c].sort().join(',')}-${t}`
            if(!seen.has(key)){seen.add(key);puzzles.push({numbers:[a,b,c],target:t,solutions:sols.slice(0,3),levelId})}
          }
        }
      }
    } else { // 4 numbers (A3)
      for (let a=1;a<=9;a++) for (let b=1;b<=9;b++) for (let c=1;c<=9;c++) for (let d=1;d<=9;d++) {
        for (let t=targetRange.min;t<=targetRange.max;t++) {
          const sols = find([a,b,c,d], t, operators, maxBracketDepth)
          if (sols.length>=1&&sols.length<=3) {
            const key=`${[a,b,c,d].sort().join(',')}-${t}`
            if(!seen.has(key)){seen.add(key);puzzles.push({numbers:[a,b,c,d],target:t,solutions:sols.slice(0,3),levelId})}
          }
        }
      }
    }
    return puzzles
  }

  // For 2-number levels with all ops: exhaustive search
  if (numberCount === 2) {
    for (let a=1;a<=9;a++) for (let b=1;b<=9;b++) {
      for (let t=targetRange.min;t<=targetRange.max;t++) {
        const sols = find([a,b], t, operators)
        if (sols.length>=1&&sols.length<=3) {
          const key=`${[a,b].sort().join(',')}-${t}`
          if(!seen.has(key)){seen.add(key);puzzles.push({numbers:[a,b],target:t,solutions:sols.slice(0,3),levelId})}
        }
      }
    }
    return puzzles
  }

  // For 3-4 number levels: random sampling
  const maxAttempts = TARGET_COUNTS[levelId] * 200
  let attempts = 0
  while (puzzles.length < TARGET_COUNTS[levelId] && attempts < maxAttempts) {
    attempts++
    const numbers = Array.from({length:numberCount}, ()=>Math.floor(Math.random()*9)+1)
    const target = Math.floor(Math.random()*(targetRange.max-targetRange.min+1))+targetRange.min
    const sols = find(numbers, target, operators, maxBracketDepth)
    if (sols.length<1||sols.length>5) continue
    const key=`${[...numbers].sort().join(',')}-${target}`
    if(seen.has(key)) continue
    seen.add(key)
    puzzles.push({numbers,target,solutions:sols.slice(0,3),levelId})
    if(puzzles.length%50===0) process.stdout.write(`  ${puzzles.length}/${TARGET_COUNTS[levelId]}\r`)
  }
  return puzzles
}

function shuffle(arr) {
  for (let i=arr.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]]
  }
  return arr
}

function formatTime(ms) {
  if(ms<1000) return `${ms}ms`
  if(ms<60000) return `${(ms/1000).toFixed(1)}s`
  return `${Math.floor(ms/60000)}m${Math.floor((ms%60000)/1000)}s`
}

mkdirSync(OUTPUT_DIR, { recursive: true })
const totalStart = Date.now()

for (const [levelId, level] of Object.entries(LEVELS)) {
  const outputPath = join(OUTPUT_DIR, `puzzles-${levelId}.json`)

  if (existsSync(outputPath)) {
    console.log(`\nSkipping ${levelId} – file already exists (${outputPath})`)
    console.log('  (delete the file to regenerate)')
    continue
  }

  const start = Date.now()
  console.log(`\nGenerating ${levelId}...`)
  const puzzles = shuffle(findAll(level, levelId))
  writeFileSync(outputPath, JSON.stringify(puzzles))
  console.log(`  ✅ ${puzzles.length} puzzles in ${formatTime(Date.now()-start)} → src/data/puzzles-${levelId}.json`)
}

console.log(`\nTotal: ${formatTime(Date.now()-totalStart)}`)
console.log('Done! Commit src/data/ to GitHub.')
