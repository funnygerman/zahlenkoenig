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
 * A short check over the payload, so a link mangled in transit — a
 * messaging app that ate the tail, a digit changed by hand — is refused
 * rather than played.
 *
 * Worth being exact about what this does and does not buy, because a
 * checksum invites the wrong assumption: it stops typos and casual
 * fiddling, not deliberate tampering. The function that computes it ships
 * to every player's browser, so anyone who wants a hand-made link can have
 * one. That is why it is not the only guard — `decodeSharedPuzzle` also
 * asks `solver.ts` whether the board it decoded is actually solvable, and
 * that check holds no matter where the link came from.
 *
 * FNV-1a, 32-bit, folded to three base36 characters: ~1 in 46 656 of
 * passing by accident, which is the right order for catching a mistyped
 * digit and not worth another character.
 */
function checksum(body: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return (h >>> 0).toString(36).slice(-3).padStart(3, '0')
}

function opsMask(ops: readonly Operator[]): number {
  return ALL_OPS.reduce((m, op, i) => (ops.includes(op) ? m | (1 << i) : m), 0)
}

function opsFromMask(mask: number): Operator[] {
  return ALL_OPS.filter((_, i) => (mask & (1 << i)) !== 0)
}

/**
 * The token that goes after `#p=`. Four dot-separated fields: the numbers
 * as bare digits (every puzzle number is 1–9, so they need no separator of
 * their own — `puzzles.ts`'s `randomNumbers`), the target in decimal, the
 * operator mask in base36, and the checksum.
 *
 * Decimal and digits rather than one packed base36 blob: a shared link is
 * a thing people paste into chats and occasionally read, and `6293.48.f`
 * can be recognised as a puzzle by eye. Packing it would save three
 * characters and cost every future debugging session.
 */
export function encodeSharedPuzzle(puzzle: SharedPuzzle): string {
  const body = `${puzzle.numbers.join('')}.${puzzle.target}.${opsMask(puzzle.ops).toString(36)}`
  return `${body}.${checksum(body)}`
}

/** The full link to hand to `navigator.share`. `baseUrl` is the app's own origin + path — the caller's, since `core/` never touches `location`. */
export function sharedPuzzleUrl(puzzle: SharedPuzzle, baseUrl: string): string {
  return `${baseUrl}#${PARAM}=${encodeSharedPuzzle(puzzle)}`
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
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const [digits, targetText, maskText, check] = parts
  if (checksum(`${digits}.${targetText}.${maskText}`) !== check) return null

  if (!/^[1-9]{2,4}$/.test(digits)) return null
  if (!/^[1-9][0-9]{0,4}$/.test(targetText)) return null
  if (!/^[1-9a-f]$/.test(maskText)) return null

  const numbers = [...digits].map(Number)
  const target = Number(targetText)
  const ops = opsFromMask(parseInt(maskText, 36))

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
