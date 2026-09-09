// Measures what the generator actually hands the player, against what its
// own search space could have handed them.
//
// The PO's report: "I still see very many puzzles with the same patterns"
// and "−, ÷ and [] will be used very seldom", with two worked examples
// (2 numbers/all ops/groß is all `a×b`; 3 numbers/all ops/mittel is all
// `a×b+c`). Two very different causes produce that symptom, and telling
// them apart is this script's whole job:
//
//   1. The *band* is to blame — the pool a band selects genuinely contains
//      almost nothing else, because a band is a tertile of target
//      magnitude and target magnitude correlates with operator (nothing
//      built from `−` on two single digits can reach 16).
//   2. The *draw* is to blame — the pool is varied and nextPuzzle keeps
//      picking the same corner of it.
//
// So every figure is computed twice: once over `nextPuzzle`'s actual
// output (the "draw" row) and once exhaustively over every (numbers,
// target) pair the band admits (the "pool" row). Draw ≈ pool means the
// band is the problem and no amount of extra randomness will help; draw
// much narrower than pool means the draw is throwing variety away.
//
// Same depth-1 model as the generator, because it imports it
// (solver.ts's forEachArrangement) rather than keeping a sixth copy —
// concept 15.3, "ein Modell für Generator und Löser".
//
// Run with: npx tsx scripts/checkVariety.ts [options]
//   --draws N     draws per (selection, band); default 200
//   --numbers 2,3 restrict to these number counts; default 2,3,4
//   --unique      also measure uniqueOnly selections
//   --no-pool     skip the exhaustive pool pass (much faster)
//   --policy P    draw policy: current | uniform | shape | shapemix | varymix
//   --samples N   also print the first N drawn puzzles, written out
//   --ops "+-*/"  restrict to one operator selection
//   --min-ops N   smallest operator count to measure; default 2, what the app allows
//   --json FILE   write the full result as JSON
//   --self-test   run the built-in known-good/known-bad checks and exit

import { nextPuzzle, puzzleSignature, uniqueOnlyAvailable, bandRanges, type PuzzleSettings } from '../src/core/puzzles.ts'
import { withPuzzle } from '../src/core/history.ts'
import type { Operator } from '../src/core/expression.ts'
import {
  ALL_OPS, GLYPH, maskOfPattern, multisets, opSubsets, renderSolution, selfTestModel, shapesOf, type Shape,
} from './varietyModel.ts'

const BAND_NAME = ['klein', 'mittel', 'gross']

// --------------------------------------------------------------- tallies

interface Tally {
  count: number
  repOps: number[]   // representative solution uses this operator
  reqOps: number[]   // every solution uses it
  anyOps: number[]   // some solution uses it
  blockRequired: number // no bracket-free solution exists, so the player must use the block chip
  repeats: number       // the drawn puzzle was still inside the history window (draw passes only)
  patterns: Map<string, number>
}

function emptyTally(): Tally {
  return { count: 0, repOps: [0, 0, 0, 0], reqOps: [0, 0, 0, 0], anyOps: [0, 0, 0, 0], blockRequired: 0, repeats: 0, patterns: new Map() }
}

function record(t: Tally, shape: Shape): void {
  t.count++
  const repMask = maskOfPattern(shape.pattern)
  for (let i = 0; i < 4; i++) {
    if (repMask & (1 << i)) t.repOps[i]++
    if (shape.allOps & (1 << i)) t.reqOps[i]++
    if (shape.anyOps & (1 << i)) t.anyOps[i]++
  }
  if (shape.minBlocks > 0) t.blockRequired++
  t.patterns.set(shape.pattern, (t.patterns.get(shape.pattern) ?? 0) + 1)
}

function pct(x: number, n: number): number {
  return n === 0 ? 0 : Math.round((100 * x) / n)
}

/** Shannon entropy of the pattern distribution, in bits. 0 = one pattern only. */
function entropy(patterns: Map<string, number>, total: number): number {
  let h = 0
  for (const c of patterns.values()) {
    const p = c / total
    if (p > 0) h -= p * Math.log2(p)
  }
  return h
}

function topPatterns(t: Tally, k: number): string {
  return [...t.patterns.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([p, c]) => `${p} ${pct(c, t.count)}%`)
    .join('  ')
}

function opLine(counts: number[], n: number): string {
  return ALL_OPS.map((op, i) => `${GLYPH[op]}${String(pct(counts[i], n)).padStart(4)}%`).join(' ')
}

// ------------------------------------------------------------- the passes

/** Exhaustive: every (multiset, target) pair whose target lands in this band. */
function poolTally(numbers: 2 | 3 | 4, ops: Operator[], lo: number, hi: number): Tally {
  const t = emptyTally()
  for (const nums of multisets(numbers)) {
    for (const [target, shape] of shapesOf(nums, ops)) {
      if (target < lo || target > hi) continue
      record(t, shape)
    }
  }
  return t
}

// ------------------------------------------------------------ draw policies
//
// Three ways to choose *which* puzzle a draw returns, so the report can
// separate "the pool has no variety" from "the draw throws it away", and
// then say whether a different draw would recover it.
//
//   current  — puzzles.ts as shipped.
//   uniform  — same random numbers, but the target is picked uniformly at
//              random among the in-band candidates instead of by
//              reachable()'s enumeration order. Isolates the tie-break.
//   shape    — uniform, plus a short memory of recently seen *patterns*:
//              among equally good candidates, prefer the least recently
//              seen shape.
//   shapemix — shape, but keeping puzzles.ts's operator-mix preference as
//              a filter first, so the draw still asks for a puzzle that
//              *needs* the operators the player picked and only randomises
//              inside that. The proposal, measured before it is built:
//              `shape` on its own halves how often ÷ is unavoidable, which
//              would undo the fix that preference was added for.
//   varymix  — shape, but instead of always demanding the *most* operators
//              a draw can offer, it cycles the demand: least-recently-used
//              operator count first, so a run of puzzles mixes one-, two-
//              and three-operator ones deliberately.
type Policy = 'current' | 'uniform' | 'shape' | 'shapemix' | 'varymix'

/** How many recent patterns the `shape` policy remembers. */
const PATTERN_WINDOW = 12

/** How many recent operator-counts `varymix` remembers when cycling its demand. */
const MIX_WINDOW = 3

function randomNumbers(count: number): number[] {
  return Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 9))
}

function signatureOf(numbers: number[], target: number): string {
  return `${[...numbers].sort((a, b) => a - b).join(',')}=${target}`
}

/**
 * The `uniform`/`shape` draw. Deliberately keeps everything about
 * puzzles.ts's loop that is not the tie-break — random numbers, the same
 * band filter, the same "prefer a puzzle the player has not just seen" —
 * so a difference in the result is attributable to the tie-break alone.
 */
function drawWithPolicy(
  settings: PuzzleSettings,
  lo: number,
  hi: number,
  recent: readonly string[],
  patternRecent: readonly string[],
  mixRecent: readonly number[],
  policy: 'uniform' | 'shape' | 'shapemix' | 'varymix',
): { numbers: number[]; target: number; shape: Shape; mix: number } {
  const seenAt = new Map(recent.map((sig, i) => [sig, i]))
  let best: { numbers: number[]; target: number; shape: Shape; rank: number; mix: number } | null = null

  // puzzles.ts's own preference and its relaxation schedule, reproduced so
  // the only difference from `current` is how ties are broken.
  const wantedMix = Math.min(settings.ops.length, settings.numbers - 1)
  const budget = settings.numbers === 4 ? 25 : 250
  const relaxEvery = Math.max(1, Math.ceil(budget / 3))
  let asking = wantedMix
  let spent = 0

  for (let attempt = 0; attempt < 500; attempt++) {
    const numbers = randomNumbers(settings.numbers)
    const candidates = [...shapesOf(numbers, settings.ops).entries()].filter(([t]) => t >= lo && t <= hi)
    if (candidates.length === 0) continue

    // Rank exactly as nextPuzzle does: unseen (-1) beats seen, and among
    // seen ones the one played longest ago wins.
    let bestRank = Infinity
    for (const [t] of candidates) bestRank = Math.min(bestRank, seenAt.get(signatureOf(numbers, t)) ?? -1)
    let pool = candidates.filter(([t]) => (seenAt.get(signatureOf(numbers, t)) ?? -1) === bestRank)

    // Keep only the candidates that need the most of the player's chosen
    // operators — the same quantity nextPuzzle maximises, capped the same way.
    const levelOf = ([, sh]: [number, Shape]) => Math.min(sh.minDistinctOps, wantedMix)
    let mix = 1
    if (policy === 'shapemix') {
      mix = Math.max(...pool.map(levelOf))
      pool = pool.filter(c => levelOf(c) === mix)
    } else if (policy === 'varymix') {
      // Least-recently-demanded operator count that this draw can actually
      // offer. A level absent from the window scores -1 and wins, so the
      // demand cycles instead of pinning to the maximum.
      const available = [...new Set(pool.map(levelOf))]
      mix = available.reduce((a, b) => (mixRecent.lastIndexOf(b) < mixRecent.lastIndexOf(a) ? b : a))
      pool = pool.filter(c => levelOf(c) === mix)
    }

    if (policy !== 'uniform') {
      // Least-recently-seen pattern first: a shape absent from the window
      // scores -1 and always wins, which is what pulls a bracket or a
      // division back in as soon as one is available at all.
      let bestSeen = Infinity
      const seenPattern = (p: string) => patternRecent.lastIndexOf(p)
      for (const [, sh] of pool) bestSeen = Math.min(bestSeen, seenPattern(sh.pattern))
      pool = pool.filter(([, sh]) => seenPattern(sh.pattern) === bestSeen)
    }

    const [target, shape] = pool[Math.floor(Math.random() * pool.length)]
    // varymix has already decided what it wants, so it never spends draws
    // hunting for a higher operator count.
    if (bestRank === -1 && (policy === 'varymix' || mix >= asking)) return { numbers, target, shape, mix }
    if (!best || bestRank < best.rank || (bestRank === best.rank && mix > best.mix)) {
      best = { numbers, target, shape, rank: bestRank, mix }
    }
    spent += 1
    if (spent >= budget) return best
    if (asking > 1 && spent % relaxEvery === 0) asking -= 1
  }

  if (best) return best
  throw new Error(`drawWithPolicy: no candidate for ${settings.numbers} numbers, ops "${settings.ops.join('')}", band ${settings.band}`)
}

/** What the player actually gets: real draws, with a real history window between them. */
function drawTally(settings: PuzzleSettings, draws: number, policy: Policy, lo: number, hi: number, samples?: string[]): Tally {
  const t = emptyTally()
  let recent: string[] = []
  const patternRecent: string[] = []
  const mixRecent: number[] = []
  for (let i = 0; i < draws; i++) {
    let numbers: number[]
    let target: number
    let shape: Shape | undefined
    if (policy === 'current') {
      // The shipped draw takes the shape window too now — measuring it
      // without one would measure a generator the app does not run.
      const puzzle = nextPuzzle(settings, recent, patternRecent)
      numbers = puzzle.numbers
      target = puzzle.target
      shape = shapesOf(numbers, settings.ops).get(target)
    } else {
      const drawn = drawWithPolicy(settings, lo, hi, recent, patternRecent, mixRecent, policy)
      numbers = drawn.numbers
      target = drawn.target
      shape = drawn.shape
      mixRecent.push(drawn.mix)
      if (mixRecent.length > MIX_WINDOW) mixRecent.shift()
    }
    if (!shape) throw new Error(`checkVariety: drew an unreachable puzzle ${numbers} = ${target}`)
    if (recent.includes(puzzleSignature({ numbers, target }))) t.repeats++
    recent = withPuzzle(recent, { numbers, target })
    patternRecent.push(shape.pattern)
    if (patternRecent.length > PATTERN_WINDOW) patternRecent.shift()
    if (samples) samples.push(renderSolution(numbers, settings.ops, target))
    record(t, shape)
  }
  return t
}

// ------------------------------------------------------------- self-test
//
// The convention in this repo (CLAUDE.md, "Verify claims rather than
// estimating them") is that a script is checked against known-good and
// known-bad cases before it reports anything.

function selfTest(): void {
  selfTestModel()

  const fail = (msg: string) => { throw new Error(`self-test: ${msg}`) }
  const eq = (a: unknown, b: unknown, what: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${what}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)
  }

  // Tally arithmetic, including the representative-operator extraction
  // that goes back through the glyphs, and the percentage conversion that
  // the console lines get wrong if they print a raw counter.
  const t = emptyTally()
  record(t, { anyOps: 0b0101, allOps: 0b0100, minBlocks: 1, minDistinctOps: 2, pattern: '(n−n)×n' })
  eq(t.repOps, [0, 1, 1, 0], 'representative ops read back from the pattern')
  eq(t.reqOps, [0, 0, 1, 0], 'required ops')
  eq(t.anyOps, [1, 0, 1, 0], 'available ops')
  eq(t.blockRequired, 1, 'bracket required')
  const tFlat = emptyTally()
  record(tFlat, { anyOps: 0b0001, allOps: 0b0001, minBlocks: 0, minDistinctOps: 1, pattern: 'n+n' })
  eq(tFlat.blockRequired, 0, 'no bracket required')
  eq(pct(tFlat.blockRequired, tFlat.count), 0, 'block figures are percentages, not raw counts')
  eq(pct(t.blockRequired, t.count), 100, 'a single bracket-requiring puzzle is 100%, not 1')
  eq(Math.round(entropy(new Map([['a', 1], ['b', 1]]), 2) * 100), 100, 'entropy of a fair coin is 1 bit')
  eq(entropy(new Map([['a', 4]]), 4), 0, 'entropy of one pattern is 0')

  console.log('self-test: all checks passed')
}

// ----------------------------------------------------------------- main

const argv = process.argv.slice(2)
const flag = (name: string) => argv.includes(name)
const value = (name: string, fallback: string) => {
  const i = argv.indexOf(name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback
}

if (flag('--self-test')) { selfTest(); process.exit(0) }

selfTest()

const draws = Number(value('--draws', '200'))
const counts = value('--numbers', '2,3,4').split(',').map(Number) as (2 | 3 | 4)[]
const wantPool = !flag('--no-pool')
const wantUnique = flag('--unique')
const jsonPath = value('--json', '')
const policy = value('--policy', 'current') as Policy
const opsFilter = value('--ops', '') // e.g. "+-*/" to measure one selection
// Only selections the app can actually produce: concept 15.6 (revised)
// requires at least two operators, enforced in useSettings.ts's toggleOp
// and settings.ts's sanitize, so a single-operator selection is
// unreachable however the table is keyed. --min-ops 1 measures them
// anyway, which is only useful for checking puzzles.ts's own BAND_TABLE
// (still 45 rows, 12 of them dead).
const minOps = Number(value('--min-ops', '2'))
const sampleCount = Number(value('--samples', '0')) // print this many drawn puzzles, written out
if (!['current', 'uniform', 'shape', 'shapemix', 'varymix'].includes(policy)) throw new Error(`unknown --policy ${policy}`)

interface Row {
  numbers: number
  ops: string
  band: number
  range: [number, number]
  uniqueOnly: boolean
  draw: ReturnType<typeof summarize>
  pool: ReturnType<typeof summarize> | null
  samples: string[]
}

function summarize(t: Tally) {
  return {
    count: t.count,
    repOps: t.repOps.map(c => pct(c, t.count)),
    reqOps: t.reqOps.map(c => pct(c, t.count)),
    anyOps: t.anyOps.map(c => pct(c, t.count)),
    blockRequired: pct(t.blockRequired, t.count),
    repeats: pct(t.repeats, t.count),
    distinctPatterns: t.patterns.size,
    topShare: t.count === 0 ? 0 : pct(Math.max(0, ...t.patterns.values()), t.count),
    entropyBits: Number(entropy(t.patterns, t.count).toFixed(2)),
    top: [...t.patterns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([p, c]) => [p, pct(c, t.count)] as [string, number]),
  }
}

const rows: Row[] = []
const started = Date.now()

for (const numbers of counts) {
  for (const { ops } of opSubsets()) {
    if (ops.length < minOps) continue
    if (opsFilter && ops.join('') !== opsFilter) continue
    const ranges = bandRanges(numbers, ops)
    for (const uniqueOnly of wantUnique ? [false, true] : [false]) {
      if (uniqueOnly && !uniqueOnlyAvailable(numbers, ops)) continue
      for (let band = 0 as 0 | 1 | 2; band <= 2; band = (band + 1) as 0 | 1 | 2) {
        const [lo, hi] = ranges[band]
        const settings: PuzzleSettings = { numbers, ops, band, uniqueOnly }
        const sampleOut: string[] = []
        const dt = drawTally(settings, draws, policy, lo, hi, sampleCount > 0 ? sampleOut : undefined)
        const pt = wantPool && !uniqueOnly ? poolTally(numbers, ops, lo, hi) : null

        const header = `${numbers} Zahlen  ${ops.map(o => GLYPH[o]).join('')}  ${BAND_NAME[band].padEnd(6)} [${lo},${hi}]${uniqueOnly ? '  uniqueOnly' : ''}`
        console.log('')
        console.log(header)
        console.log(`  draw n=${String(dt.count).padStart(5)}  rep ${opLine(dt.repOps, dt.count)}  []${String(pct(dt.blockRequired, dt.count)).padStart(4)}%  patterns ${String(dt.patterns.size).padStart(3)}  top ${String(summarize(dt).topShare).padStart(3)}%  H ${entropy(dt.patterns, dt.count).toFixed(2)}  repeat ${String(pct(dt.repeats, dt.count)).padStart(3)}%`)
        console.log(`        ${' '.repeat(5)}   req ${opLine(dt.reqOps, dt.count)}  []${String(pct(dt.blockRequired, dt.count)).padStart(4)}%  ${topPatterns(dt, 4)}`)
        if (pt) {
          console.log(`  pool n=${String(pt.count).padStart(5)}  rep ${opLine(pt.repOps, pt.count)}  []${String(pct(pt.blockRequired, pt.count)).padStart(4)}%  patterns ${String(pt.patterns.size).padStart(3)}  top ${String(summarize(pt).topShare).padStart(3)}%  H ${entropy(pt.patterns, pt.count).toFixed(2)}`)
          console.log(`        ${' '.repeat(5)}   any ${opLine(pt.anyOps, pt.count)}  []${String(pct(pt.blockRequired, pt.count)).padStart(4)}%  ${topPatterns(pt, 4)}`)
        }

        // One drawn puzzle per line, written out, so a reader can judge
        // the feel of a policy instead of only its entropy (CLAUDE.md:
        // "Decide layout questions by looking").
        // The *last* N, not the first: the shape and mix windows need a
        // few draws to warm up, and steady state is what a player sees.
        for (const line of sampleOut.slice(-sampleCount)) console.log(`  ${line}`)
        rows.push({ samples: sampleOut.slice(-sampleCount), numbers, ops: ops.join(''), band, range: [lo, hi], uniqueOnly, draw: summarize(dt), pool: pt ? summarize(pt) : null })
      }
    }
  }
}

console.log(`\ndone in ${((Date.now() - started) / 1000).toFixed(1)}s, ${rows.length} rows, policy ${policy}`)
if (jsonPath) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(jsonPath, JSON.stringify({ draws, policy, rows }, null, 2))
  console.log(`wrote ${jsonPath}`)
}
