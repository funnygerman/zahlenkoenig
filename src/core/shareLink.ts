// Sharing one puzzle as a link (share round, PO). The payload is the same
// three things solvedHistory.ts stores per archived entry — numbers,
// target and the operators the tray offers — and for the same reason: a
// receiver's own `settings.ops` can differ from the sender's, and a tray
// that doesn't match the board's solution makes the puzzle unplayable.
// The two types are deliberately separate despite the identical shape: an
// archived puzzle is one this player solved, a shared one is one they were
// handed, and only the second has to survive a hostile round trip through
// somebody's messaging app.
//
// The link carries its payload in the URL *fragment* (`#p=…`) rather than
// in a query string. Three reasons, in order of how much they cost to get
// wrong:
//
//   - index.html's own note ("a single page with no query strings, no
//     duplicate URLs and nothing to disambiguate") is why the SEO round's
//     trim deleted `canonical` as a no-op. Every shared link being a
//     distinct crawlable URL would make that false again and bring the tag
//     back with it.
//   - A fragment never reaches the server, and so never reaches the
//     service worker's URL matching either: `?p=…` would be a navigation
//     request whose search string the precache does not match
//     (workbox only ignores `utm_*`/`fbclid` by default), which is exactly
//     the case concept 19's offline promise is about.
//   - It is never sent to GitHub Pages' access logs. Nothing here is
//     secret, but a puzzle a player shares with one friend has no reason
//     to be in someone else's log either.

import { reachable } from './solver'
import type { Operator } from './expression'

/** What a link carries: exactly enough to put the sender's board in front of the receiver. */
export interface SharedPuzzle {
  numbers: number[]
  target: number
  ops: Operator[]
}

/** Bit order for the operator mask. Fixed for the life of the format — see FORMAT_VERSION's note. */
const ALL_OPS: readonly Operator[] = ['+', '-', '*', '/']

/**
 * The fragment parameter name. A version would normally belong in the
 * payload; here it is the *key*, so a future format can be added as `q=`
 * without an old build having to recognise and reject it — an old build
 * simply finds no `p=` and draws a normal puzzle, which is the same
 * graceful fallback every other failure in this file lands on.
 */
const PARAM = 'p'

/**
 * How the payload is packed into one opaque token.
 *
 * The link used to read `#p=6293.48.f.x7q` — the numbers, the target and the
 * operator mask in plain sight, with a checksum after them. The PO asked for
 * the whole value to be one unreadable token instead, and the distinction
 * worth writing down is that this is an **encoding, not a hash**: a hash is
 * one-way, and a link has to decode back into a board. So the fields are
 * packed, mixed and base36'd, which makes the token unreadable by eye — not
 * secret. Anyone can read the code that produces it; see `checksum` below.
 *
 * The bit layout, low to high, 36 bits in total:
 *
 * | bits | field |
 * |---|---|
 * | 2 | how many numbers, as count − 2 (so 0–2 for 2–4 numbers) |
 * | 16 | the four numbers, 4 bits each, 1–9, unused slots zero |
 * | 4 | the operator mask (see ALL_OPS) |
 * | 14 | the target, up to 16383 |
 *
 * The target field is deliberately far wider than it needs to be: `solver.ts`
 * caps every target at 999 (concept 15.5 — three digits fit the target chip),
 * so 10 bits would do and would save a character. 14 costs one character and
 * means that raising that cap later cannot silently start truncating targets
 * into different puzzles, which is the kind of failure a shared link carries
 * to somebody else's phone before anyone notices.
 */
const COUNT_BITS = 2n
const NUMBER_BITS = 4n
const MASK_BITS = 4n
const TARGET_BITS = 14n
const MAX_TARGET = (1 << Number(TARGET_BITS)) - 1

/**
 * The checksum's range, and the factor the packed payload is shifted by to
 * make room for it. Three base36 characters: ~1 in 46 656 of a damaged link
 * passing by accident, which is the right order for catching a mistyped
 * character and not worth a fourth.
 */
const CHECK_RANGE = 46656n

/**
 * The mixing step, and the whole reason a token looks random rather than
 * merely encoded. Multiplying by an odd constant modulo a power of two is a
 * bijection — every payload maps to exactly one token and back — but it
 * spreads a one-digit change across the entire result, so two puzzles that
 * differ by a single chip do not produce two similar-looking links.
 *
 * `SCRAMBLE_INVERSE` is derived rather than written down, by Hensel lifting
 * (each step doubles the number of correct bits, so five are plenty for 52).
 * A hand-copied inverse constant would be a silent, untestable way to break
 * every link ever shared; `shareLink.test.ts` pins the pair's defining
 * property (`k · k⁻¹ ≡ 1`) and round-trips real puzzles through both.
 */
const SCRAMBLE_BITS = 52n
const SCRAMBLE_MOD = 1n << SCRAMBLE_BITS
const SCRAMBLE = 0x1d4f3a7b9c6e5n // odd, so it is invertible modulo a power of two

function inverseModPowerOfTwo(k: bigint, mod: bigint): bigint {
  let inv = 1n
  for (let i = 0; i < 6; i++) inv = ((inv * (2n - k * inv)) % mod + mod) % mod
  return inv
}

const SCRAMBLE_INVERSE = inverseModPowerOfTwo(SCRAMBLE, SCRAMBLE_MOD)

/**
 * A short check over the payload, so a link mangled in transit — a messaging
 * app that ate the tail, a character changed by hand — is refused rather than
 * played.
 *
 * Worth being exact about what this does and does not buy, because a checksum
 * invites the wrong assumption: it stops typos and casual fiddling, not
 * deliberate tampering. The function that computes it ships to every player's
 * browser, so anyone who wants a hand-made link can have one. That is why it
 * is not the only guard — `decodeSharedPuzzle` also asks `solver.ts` whether
 * the board it decoded is actually solvable, and that check holds no matter
 * where the link came from.
 *
 * FNV-1a, 32-bit, folded into CHECK_RANGE.
 */
function checksum(payload: bigint): bigint {
  const body = payload.toString()
  let h = 0x811c9dc5
  for (let i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return BigInt(h >>> 0) % CHECK_RANGE
}

function opsMask(ops: readonly Operator[]): number {
  return ALL_OPS.reduce((m, op, i) => (ops.includes(op) ? m | (1 << i) : m), 0)
}

function opsFromMask(mask: number): Operator[] {
  return ALL_OPS.filter((_, i) => (mask & (1 << i)) !== 0)
}

/**
 * The token that goes after `#p=`: one base36 word, ten or eleven characters,
 * with nothing about the puzzle readable in it.
 *
 * Returns `null` for anything outside what the layout above can hold, rather
 * than silently truncating a number into a different puzzle. `Game.tsx` never
 * hits this — every board it can show comes from the generator, the archive or
 * a decoded link — but a caller that did would get a share button that does
 * nothing rather than a link to the wrong board.
 */
export function encodeSharedPuzzle(puzzle: SharedPuzzle): string | null {
  const { numbers, target, ops } = puzzle
  if (numbers.length < 2 || numbers.length > 4) return null
  if (!numbers.every(n => Number.isInteger(n) && n >= 1 && n <= 9)) return null
  if (!Number.isInteger(target) || target < 1 || target > MAX_TARGET) return null
  const mask = opsMask(ops)
  if (mask === 0) return null

  let packed = BigInt(target)
  packed = (packed << MASK_BITS) | BigInt(mask)
  // High slot first, so the numbers come back out in the order they went in.
  for (let i = 3; i >= 0; i--) packed = (packed << NUMBER_BITS) | BigInt(numbers[i] ?? 0)
  packed = (packed << COUNT_BITS) | BigInt(numbers.length - 2)

  const withCheck = packed * CHECK_RANGE + checksum(packed)
  return ((withCheck * SCRAMBLE) % SCRAMBLE_MOD).toString(36)
}

/** The full link to hand to `navigator.share`, or `null` for a puzzle the format cannot carry. `baseUrl` is the app's own origin + path — the caller's, since `core/` never touches `location`. */
export function sharedPuzzleUrl(puzzle: SharedPuzzle, baseUrl: string): string | null {
  const token = encodeSharedPuzzle(puzzle)
  return token && `${baseUrl}#${PARAM}=${token}`
}

/**
 * The puzzle a token describes, or `null` for anything this build will not
 * put in front of a player.
 *
 * Null covers every failure alike — malformed, mangled, hand-edited, or
 * decoding cleanly to a board that cannot actually be solved — because the
 * caller's response to all of them is the same: draw a normal puzzle. A
 * link that silently becomes an ordinary game is a much better failure
 * than an error screen, and a far better one than a board whose target
 * cannot be reached, which would open with the dead-end border lit before
 * the player touched a chip (the exact failure the hint round wrote up).
 *
 * The solvability check is `solver.ts`'s own `reachable()` — the same
 * model `puzzles.ts` generates against, so a shared puzzle is held to
 * exactly the standard a generated one is, `wholeSolution` included
 * (concept 8: a target whose only route runs through a fraction is not a
 * puzzle for this audience, however it arrived).
 */
export function decodeSharedPuzzle(token: string): SharedPuzzle | null {
  // Lowercased rather than rejected: base36 is case-free, and a link that
  // passed through something that shouted it should still open.
  const text = token.toLowerCase()
  if (!/^[0-9a-z]{1,11}$/.test(text)) return null

  // Built digit by digit in BigInt rather than with `parseInt(text, 36)`,
  // which loses precision above 2^53 and would decode a long token into a
  // neighbouring puzzle instead of refusing it.
  let scrambled = 0n
  for (const ch of text) scrambled = scrambled * 36n + BigInt(parseInt(ch, 36))
  if (scrambled >= SCRAMBLE_MOD) return null

  const withCheck = (scrambled * SCRAMBLE_INVERSE) % SCRAMBLE_MOD
  const packed = withCheck / CHECK_RANGE
  if (checksum(packed) !== withCheck % CHECK_RANGE) return null

  const count = Number(packed & ((1n << COUNT_BITS) - 1n)) + 2
  let rest = packed >> COUNT_BITS
  const slots: number[] = []
  for (let i = 0; i < 4; i++) {
    slots.push(Number(rest & ((1n << NUMBER_BITS) - 1n)))
    rest >>= NUMBER_BITS
  }
  const mask = Number(rest & ((1n << MASK_BITS) - 1n))
  rest >>= MASK_BITS
  const target = Number(rest & ((1n << TARGET_BITS) - 1n))
  // Anything left above the layout is not a token this build wrote.
  if (rest >> TARGET_BITS) return null

  const numbers = slots.slice(0, count)
  if (!numbers.every(n => n >= 1 && n <= 9)) return null
  // Unused slots must be empty, or two different packings would decode alike.
  if (slots.slice(count).some(n => n !== 0)) return null
  if (mask === 0 || target < 1) return null

  const ops = opsFromMask(mask)
  const entry = reachable(numbers, ops).find(e => e.target === target)
  if (!entry || !entry.wholeSolution) return null

  return { numbers, target, ops }
}

/**
 * The shared puzzle in a `location.hash`, if there is one. Takes the hash
 * as a string rather than reading `location` itself so it stays testable
 * and `core/` stays free of the DOM.
 */
export function readSharedPuzzle(hash: string): SharedPuzzle | null {
  try {
    const token = new URLSearchParams(hash.replace(/^#/, '')).get(PARAM)
    return token ? decodeSharedPuzzle(token) : null
  } catch {
    return null
  }
}
