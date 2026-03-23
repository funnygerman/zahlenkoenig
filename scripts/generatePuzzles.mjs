// Run with: node --max-old-space-size=512 scripts/generatePuzzles.mjs
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '../src/data')

const LEVELS = {
  A1:   { numberCount:2, operators:['+','-'],         maxBracketDepth:0, targetRange:{min:1,max:18},  exhaustive:true  },
  A2:   { numberCount:3, operators:['+','-'],         maxBracketDepth:0, targetRange:{min:1,max:27},  exhaustive:true  },
  A3:   { numberCount:4, operators:['+','-'],         maxBracketDepth:0, targetRange:{min:1,max:36},  exhaustive:true  },
  F1:   { numberCount:2, operators:['+','-','*','/'], maxBracketDepth:0, targetRange:{min:1,max:81},  exhaustive:true  },
  'F2-1': { numberCount:3, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:1,  max:50 }, count:500 },
  'F2-2': { numberCount:3, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:51, max:100}, count:500 },
  'F2-3': { numberCount:3, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:101,max:162}, count:500 },
  'F3-1': { numberCount:4, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:1,  max:50 }, count:500 },
  'F3-2': { numberCount:4, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:51, max:100}, count:500 },
  'F3-3': { numberCount:4, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:101,max:171}, count:500 },
  'E1-1': { numberCount:4, operators:['+','-','*','/'], maxBracketDepth:2, targetRange:{min:1,  max:50 }, count:500 },
  'E1-2': { numberCount:4, operators:['+','-','*','/'], maxBracketDepth:2, targetRange:{min:51, max:100}, count:500 },
  'E1-3': { numberCount:4, operators:['+','-','*','/'], maxBracketDepth:2, targetRange:{min:101,max:324}, count:500 },
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
  for(let a=0;a<4;a++) for(let b=0;b<4;b++){if(b===a)continue
    for(let c=0;c<4;c++){if(c===a||c===b)continue
      for(let d=0;d<4;d++){if(d===a||d===b||d===c)continue;r.push([a,b,c,d])}}}
  return r
})()

function findSolutions(nums, target, ops, maxBrackets) {
  const seen = new Set(), sols = []
  if (nums.length === 2) {
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
  } else if (nums.length === 3) {
    for (const [i,j,k] of PERMS3) {
      const [a,b,c]=[nums[i],nums[j],nums[k]]
      for (const o1 of ops) for (const o2 of ops) {
        const exprs=[`${a}${o1}${b}${o2}${c}`]
        if(maxBrackets>=1) exprs.push(`(${a}${o1}${b})${o2}${c}`,`${a}${o1}(${b}${o2}${c})`)
        for(const e of exprs){const r=safeEval(e);if(r===target&&!seen.has(e)){seen.add(e);sols.push(e)}}
      }
    }
  } else {
    for (const [i,j,k,l] of PERMS4) {
      const [a,b,c,d]=[nums[i],nums[j],nums[k],nums[l]]
      for(const o1 of ops) for(const o2 of ops) for(const o3 of ops) {
        const exprs=[`${a}${o1}${b}${o2}${c}${o3}${d}`]
        if(maxBrackets>=1) exprs.push(`(${a}${o1}${b})${o2}${c}${o3}${d}`,`${a}${o1}(${b}${o2}${c})${o3}${d}`,`${a}${o1}${b}${o2}(${c}${o3}${d})`)
        if(maxBrackets>=2) exprs.push(`(${a}${o1}${b})${o2}(${c}${o3}${d})`,`((${a}${o1}${b})${o2}${c})${o3}${d}`,`${a}${o1}(${b}${o2}(${c}${o3}${d}))`)
        for(const e of exprs){const r=safeEval(e);if(r===target&&!seen.has(e)){seen.add(e);sols.push(e);if(sols.length>10)return sols}}
      }
    }
  }
  return sols
}

function shuffle(arr) {
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}
  return arr
}

function ri(min,max){return Math.floor(Math.random()*(max-min+1))+min}
function formatTime(ms){if(ms<1000)return`${ms}ms`;if(ms<60000)return`${(ms/1000).toFixed(1)}s`;return`${Math.floor(ms/60000)}m${Math.floor((ms%60000)/1000)}s`}

mkdirSync(OUTPUT_DIR,{recursive:true})
const totalStart=Date.now()

for(const [levelId, level] of Object.entries(LEVELS)) {
  const outputPath = join(OUTPUT_DIR, `puzzles-${levelId}.json`)
  if(existsSync(outputPath)){console.log(`Skipping ${levelId} – already exists`);continue}

  const start=Date.now()
  console.log(`\nGenerating ${levelId}...`)
  const puzzles=[], seen=new Set()

  if(level.exhaustive) {
    // Exhaustive: try all number combos
    const n=level.numberCount
    const {min,max}=level.targetRange
    const loop=(nums)=>{
      for(let t=min;t<=max;t++){
        const sols=findSolutions(nums,t,level.operators,level.maxBracketDepth)
        if(sols.length>=1&&sols.length<=3){
          const key=`${[...nums].sort().join(',')}-${t}`
          if(!seen.has(key)){seen.add(key);puzzles.push({numbers:[...nums],target:t,solutions:sols.slice(0,3),levelId})}
        }
      }
    }
    if(n===2) for(let a=1;a<=9;a++) for(let b=1;b<=9;b++) loop([a,b])
    else if(n===3) for(let a=1;a<=9;a++) for(let b=1;b<=9;b++) for(let c=1;c<=9;c++) loop([a,b,c])
    else for(let a=1;a<=9;a++) for(let b=1;b<=9;b++) for(let c=1;c<=9;c++) for(let d=1;d<=9;d++) loop([a,b,c,d])
  } else {
    // Random sampling
    let attempts=0
    while(puzzles.length<level.count&&attempts<level.count*200){
      attempts++
      const nums=Array.from({length:level.numberCount},()=>ri(1,9))
      const t=ri(level.targetRange.min,level.targetRange.max)
      const sols=findSolutions(nums,t,level.operators,level.maxBracketDepth)
      if(sols.length<1||sols.length>5) continue
      const key=`${[...nums].sort().join(',')}-${t}`
      if(seen.has(key)) continue
      seen.add(key)
      puzzles.push({numbers:nums,target:t,solutions:sols.slice(0,3),levelId})
      if(puzzles.length%50===0) process.stdout.write(`  ${puzzles.length}/${level.count}\r`)
    }
  }

  writeFileSync(outputPath, JSON.stringify(shuffle(puzzles)))
  console.log(`  ✅ ${puzzles.length} puzzles in ${formatTime(Date.now()-start)}`)
}

console.log(`\nTotal: ${formatTime(Date.now()-totalStart)}`)
console.log('Done! Commit src/data/ to GitHub.')
