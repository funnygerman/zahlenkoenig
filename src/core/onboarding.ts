// The first-run introduction (onboarding round, after a report that a
// player who has never seen the idea can't tell what to do on the first
// screen). Three fixed puzzles, played before the generator is ever asked
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

// The stored step is an *index into `ONBOARDING_PUZZLES`*, so inserting a
// puzzle changes what every stored value means. The key is versioned for
// exactly that reason, and the old one is still read: under v1 there were
// two puzzles and `2` meant "finished", while under v2 `2` is the third
// board — so a player who had already been through the whole introduction
// would have been handed its hardest board again, card and all, on their
// next visit. `LEGACY_DONE` is that one value's translation.
//
// Nothing else needs translating: the new puzzle was inserted at index 1,
// so a v1 step of 0 or 1 already points at the board it always pointed at
// (0 — the two-number board, and 1 — which is now the new bracket board,
// which is the whole point of adding it there).
const STORAGE_KEY = 'zahlenkoenig:onboarding-v2'
const LEGACY_KEY = 'zahlenkoenig:onboarding-v1'
const LEGACY_DONE = 2

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
  /**
   * A short scripted departure from the guidance's own advice, for the two
   * boards that teach recovery (PO: "demo for wrong expression", and the
   * undo beat on the last board).
   *
   * The guidance is otherwise *derived* — it shows the very move the hint
   * button would perform — and that is deliberate: one expression, one
   * answer (ui/guidance.ts's header). A mistake cannot be derived, because
   * the search will never advise one, so it has to be written down. What
   * keeps the two from becoming a second source of truth is that a beat is
   * keyed on the **board it speaks on** rather than on a step counter: it
   * applies only while the board reads exactly `at`, and the moment the
   * player is anywhere else the derived guidance answers again. A beginner
   * who wanders off the script is therefore never following a line written
   * for a board they are not on.
   */
  script?: readonly ScriptedBeat[]
}

/** One scripted instruction: the board it speaks on, and the chip to ask for there. */
export interface ScriptedBeat {
  /**
   * The board this beat applies to, exactly as `notation.ts`'s `notate()`
   * prints it — `''` is the untouched field. A canonical string rather
   * than a tree, so a beat can be read, written and compared in a test
   * without building an expression.
   */
  at: string
  /**
   * What to ask for, instead of what the search would advise. A number
   * names its **value**, not a leaf id: ids are minted per puzzle, and the
   * three `1`s of the last board are interchangeable anyway — Board.tsx
   * resolves it against the tray it actually has.
   */
  tap:
    | { kind: 'number'; value: number }
    | { kind: 'operator'; op: Operator }
    | { kind: 'block' }
}

/**
 * The three boards a first-time player meets, in order.
 *
 * **1. `⬚ + ⬚` at two numbers.** Not teaching arithmetic — teaching "I
 * touched a thing and it worked". Concept 6.4's own promise ("A1 erklärt
 * sich selbst … für Erstklässler die ganze Anleitung, ohne Worte") is
 * literally true at two numbers and one operator: the scaffold *is* the
 * instruction. The app's real default (3 numbers, all four operators)
 * never delivered that on a cold open.
 *
 * **2. `(1+2) × 3 = 9`.** The bracket, at its two-number minimum — the
 * whole of it built by tapping, which is the vocabulary the first board
 * just taught. It was added after a player report that the block lesson
 * arrived all at once: the board below asks a beginner to open a bracket
 * *and* grow it past its minimum with the game's one drag-only gesture, in
 * the same puzzle, having never seen a bracket at all. This board splits
 * that in two. Its solution is unique and needs the bracket (`(n+n)×n`,
 * pinned in onboarding.test.ts) — a bracket that is merely permitted
 * teaches nothing, which is the same test the PO's own rejected candidate
 * for board 3 failed.
 *
 * **3. `(1+1+1) × 3 = 9`.** The PO's own choice, and the only shape that
 * teaches growing a block: a three-number group, which is the one thing in
 * the game that tapping structurally cannot build (concept 6.2 — growing a
 * group past its two-number minimum is drag-only, because the tap after a
 * complete group is ambiguous between "grow this" and "start the next
 * one"). Left to discovery it is never found; scripted, with the intro
 * card naming the gesture, it is the lesson.
 *
 * It keeps board 2's target and its outer `× 3` deliberately: the only
 * thing that changes between the two boards is how many numbers go inside
 * the bracket, which is exactly the thing this board exists to teach.
 *
 * That third puzzle used to need two supports in Board.tsx, and needs
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
  {
    numbers: [1, 2, 3],
    target: 9,
    ops: ['+', '*'],
    // Three taps into a bracket in the wrong place, and then the repair.
    // Measured before it was written: on this board *any* wrong bracket
    // placement makes the target unreachable at once, so the red frame and
    // the mark on the bracket arrive on the third tap rather than at `=`.
    // That is why the mistake is three beats and not seven: the longer
    // version (fill the board out to `(3 × 1) + 2`, press `=` for a red 5,
    // then repair) has the guidance directing four more taps while the
    // game is already objecting, which rehearses tapping past a warning.
    // The `=` verdict needs no lesson — it is a verdict, not a gesture,
    // and every wrong answer on a real puzzle delivers it.
    script: [
      { at: '', tap: { kind: 'number', value: 3 } },
      { at: '3', tap: { kind: 'operator', op: '*' } },
      // The mistake itself. A *tapped* block lands at the player's own
      // anchor (concept 6.1) — here the `3` — while this board needs one
      // at position 2, so this single tap produces `(3 ×)` and the board
      // is unreachable. The derived guidance takes it from here.
      { at: '3 ×', tap: { kind: 'block' } },
    ],
  },
  {
    numbers: [1, 1, 1, 3],
    target: 9,
    ops: ['+', '*'],
    // The undo beat, placed *after* the drag this board exists for, so the
    // player meets it having already succeeded at the hard part. `+`
    // instead of `×` outside the bracket is a dead end with exactly one
    // chip to blame, which is what lets `findBlockers` mark it and the
    // guidance name it.
    script: [{ at: '(1 + 1 + 1)', tap: { kind: 'operator', op: '+' } }],
  },
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
 *
 * Falls back to the v1 key when the v2 one is absent (see its comment
 * above), and deliberately does not write the translated value back: a
 * load with a side effect is a load that can fail in private mode for no
 * gain, and re-deriving it costs one `getItem` per visit.
 */
export function loadOnboardingStep(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return readStep(raw)
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (!legacy) return 0
    const step = readStep(legacy)
    return step >= LEGACY_DONE ? ONBOARDING_PUZZLES.length : step
  } catch {
    return 0
  }
}

function readStep(raw: string): number {
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed < 0) return 0
  return Math.min(parsed, ONBOARDING_PUZZLES.length)
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
