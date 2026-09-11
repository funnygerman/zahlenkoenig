// The first-run introduction (onboarding round, after a report that a
// player who has never seen the idea can't tell what to do on the first
// screen). Two fixed puzzles, played before the generator is ever asked
// for one, plus the single number that says how far through them a player
// is.
//
// Why a module and a LocalStorage key of its own rather than a sixth
// `Settings` field or a count read off `solvedHistory`: the progress
// through onboarding is its own concern, the same way history.ts's
// repeat-avoidance window and solvedHistory.ts's archive are — each owns
// one key and one question. Deriving it from the archive's length would
// couple two unrelated things and silently restart onboarding if the
// archive were ever cleared or its cap lowered.

import type { Operator } from './expression'

const STORAGE_KEY = 'zahlenkoenig:onboarding-v1'

export interface OnboardingPuzzle {
  numbers: number[]
  target: number
  /**
   * The tray this puzzle offers, deliberately narrower than the player's
   * own `settings.ops`: an onboarding board should hold the chips its own
   * solution needs and nothing else to sift through. Board.tsx takes `ops`
   * as a plain prop, so this needs no special path — it's the same
   * mechanism solvedHistory.ts already uses to replay an archived puzzle
   * with the operators it was solved under.
   */
  ops: Operator[]
}

/**
 * The two boards a first-time player meets, in order.
 *
 * **1. `⬚ + ⬚` at two numbers.** Not teaching arithmetic — teaching "I
 * touched a thing and it worked". Concept 6.4's own promise ("A1 erklärt
 * sich selbst … für Erstklässler die ganze Anleitung, ohne Worte") is
 * literally true at two numbers and one operator: the scaffold *is* the
 * instruction. The app's real default (3 numbers, all four operators)
 * never delivered that on a cold open.
 *
 * **2. `(1+1+1) × 3 = 9`.** The PO's own choice, and the only shape that
 * teaches the block: a three-number group, which is the one thing in the
 * game that tapping structurally cannot build (concept 6.2 — growing a
 * group past its two-number minimum is drag-only, because the tap after a
 * complete group is ambiguous between "grow this" and "start the next
 * one"). Left to discovery it is never found; scripted, with the intro
 * card naming the gesture, it is the lesson.
 *
 * That second puzzle used to need two supports in Board.tsx, and needs
 * neither now — worth recording, because both were removed by rounds that
 * were not about onboarding at all.
 *
 *   - The **dead-end border** was lit on its empty field, because
 *     `computeHint` returned null on it and `useHint`'s `deadEnd` was
 *     exactly that. Fixed generally (the verdict is withheld wherever the
 *     search is blind), then made moot entirely when the search stopped
 *     being blind.
 *   - The **hint was hidden**, first because the budget came out zero and
 *     then by an explicit `onboarding` prop. The three-number-group round
 *     gave this board a real budget, and the PO then chose to show the
 *     hint: withholding it meant a beginner met the game's hardest gesture
 *     with no help at all. The budget keeps it honest without a special
 *     case — four presses of the eight chips, stopping before the `grow`
 *     drag, which is the lesson the card is asking for.
 */
export const ONBOARDING_PUZZLES: readonly OnboardingPuzzle[] = [
  { numbers: [1, 2], target: 3, ops: ['+'] },
  { numbers: [1, 1, 1, 3], target: 9, ops: ['+', '*'] },
]

/**
 * How many onboarding puzzles this player has finished. At or past
 * `ONBOARDING_PUZZLES.length` means onboarding is over and the generator
 * takes back over for good.
 *
 * Same defend-against-anything posture as settings.ts's `sanitize` and
 * history.ts's loaders: a missing key, a disabled localStorage (private
 * mode throws on read, not just on write) or a hand-edited value all come
 * back as "start at the beginning" rather than throwing.
 */
export function loadOnboardingStep(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return 0
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed < 0) return 0
    return Math.min(parsed, ONBOARDING_PUZZLES.length)
  } catch {
    return 0
  }
}

export function saveOnboardingStep(step: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(step))
  } catch {
    // Without storage a player would meet the introduction again on every
    // visit. Annoying, not broken — and the same trade every other
    // persisted value in this app already makes.
  }
}

/** The puzzle for this step, or `null` once onboarding is behind the player. */
export function onboardingPuzzleAt(step: number): OnboardingPuzzle | null {
  return ONBOARDING_PUZZLES[step] ?? null
}
