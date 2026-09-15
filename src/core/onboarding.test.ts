// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { ONBOARDING_PUZZLES, loadOnboardingStep, onboardingPuzzleAt, saveOnboardingStep } from './onboarding'
import { computeHint } from './hints'
import { createExpression, createTray } from './expression'
import { reachable } from './solver'

describe('onboarding — the stored step', () => {
  beforeEach(() => localStorage.clear())

  it('starts at zero and survives a round trip', () => {
    expect(loadOnboardingStep()).toBe(0)
    saveOnboardingStep(1)
    expect(loadOnboardingStep()).toBe(1)
  })

  it('clamps a stored value past the end, so a shortened puzzle list can never index off it', () => {
    saveOnboardingStep(99)
    expect(loadOnboardingStep()).toBe(ONBOARDING_PUZZLES.length)
    expect(onboardingPuzzleAt(loadOnboardingStep())).toBeNull()
  })

  it('treats anything unreadable as a fresh start rather than throwing', () => {
    // Same posture as settings.ts's sanitize and history.ts's loaders: a
    // hand-edited or corrupt value restarts the introduction, which is
    // harmless, instead of unmounting the app.
    for (const raw of ['not json', '"1"', '-3', '1.5', 'null']) {
      localStorage.setItem('zahlenkoenig:onboarding-v2', raw)
      expect(loadOnboardingStep()).toBe(0)
    }
  })
})

describe('onboarding — a player who finished the two-puzzle version does not start over', () => {
  // The stored step is an index into ONBOARDING_PUZZLES, so inserting the
  // bracket board at index 1 changed what a stored value means. Without
  // this translation a player who had already been through the whole
  // introduction would meet its hardest board again — card, three-number
  // group and all — on their next visit.
  beforeEach(() => localStorage.clear())

  it('reads a finished v1 step as finished, not as "one board left"', () => {
    localStorage.setItem('zahlenkoenig:onboarding-v1', '2')
    expect(loadOnboardingStep()).toBe(ONBOARDING_PUZZLES.length)
    expect(onboardingPuzzleAt(loadOnboardingStep())).toBeNull()
  })

  it('leaves a half-finished v1 step where it was, which is now the new board', () => {
    // v1's step 1 meant "the two-number board is done". That is still
    // true, and what comes next is the board this round inserted — which
    // is exactly where such a player should pick up.
    localStorage.setItem('zahlenkoenig:onboarding-v1', '1')
    expect(loadOnboardingStep()).toBe(1)
    expect(onboardingPuzzleAt(1)!.numbers).toHaveLength(3)
  })

  it('prefers the current key once it exists, so finishing writes through', () => {
    localStorage.setItem('zahlenkoenig:onboarding-v1', '2')
    saveOnboardingStep(1)
    expect(loadOnboardingStep()).toBe(1)
  })
})

describe('onboarding — the three puzzles are what they claim to be', () => {
  it('both are solvable, and only with the operators their own tray offers', () => {
    for (const p of ONBOARDING_PUZZLES) {
      const entry = reachable(p.numbers, p.ops).find(e => e.target === p.target)
      expect(entry, `${p.numbers} -> ${p.target}`).toBeDefined()
      expect(entry!.wholeSolution).toBe(true)
    }
  })

  it('the first is two numbers and one operator — the scaffold is the whole instruction (concept 6.4)', () => {
    const first = ONBOARDING_PUZZLES[0]
    expect(first.numbers).toHaveLength(2)
    expect(first.ops).toEqual(['+'])
    // Three chips in total, so the canonical continuation from an empty
    // field is the whole board — and `hintBudget` gives two numbers no
    // hints at all (PO), which is why this board shows no hint icon even
    // now that onboarding no longer suppresses one.
    expect(computeHint(createExpression(), createTray(first.numbers), first.target, first.ops, first.numbers.length)!.moves).toHaveLength(3)
  })

  it('the second needs a bracket, and tapping alone can build the whole of it', () => {
    // The board this round inserted, and the reason it is worth a board of
    // its own: one new chip, no new gesture. The plan the hint derives
    // from an empty field contains a `block` move and no `grow`, which is
    // precisely "a player can tap their way through this" — the third
    // board below is where the drag comes in.
    const second = ONBOARDING_PUZZLES[1]
    expect(second.numbers).toEqual([1, 2, 3])
    expect(second.target).toBe(9)
    const hint = computeHint(createExpression(), createTray(second.numbers), second.target, second.ops, second.numbers.length)
    expect(hint).not.toBeNull()
    expect(hint!.moves.some(m => m.kind === 'block')).toBe(true)
    expect(hint!.moves.some(m => m.kind === 'grow')).toBe(false)
  })

  it('the second has no flat route either — its bracket is required, not merely permitted', () => {
    const second = ONBOARDING_PUZZLES[1]
    const entry = reachable(second.numbers, second.ops).find(e => e.target === second.target)
    expect(entry!.pattern).toContain('(')
  })

  it('the third needs a THREE-number group, which tapping alone cannot build', () => {
    // Still the reason this puzzle teaches anything: a three-number group
    // is drag-only (concept 6.2), so no sequence of taps reaches it.
    //
    // **This assertion used to be `toBeNull()`** — the hint could not
    // propose the shape either, and the note here said that if it ever
    // learned to, `Board.tsx`'s `onboarding` suppression should be
    // revisited rather than left standing on a reason that no longer held.
    // It has learned to (the three-number-group round), so it was — and
    // the PO removed the suppression outright: a board with a real budget
    // withholding its hint meant a beginner met the game's hardest gesture
    // with no help at all. The budget does the work instead, stopping four
    // presses in, before the drag the card teaches.
    const third = ONBOARDING_PUZZLES[2]
    expect(third.numbers).toEqual([1, 1, 1, 3])
    expect(third.target).toBe(9)
    const hint = computeHint(createExpression(), createTray(third.numbers), third.target, third.ops, third.numbers.length)
    expect(hint).not.toBeNull()
    expect(hint!.moves.some(m => m.kind === 'grow')).toBe(true)
  })

  it('the third has no flat route either — the bracket is required, not merely permitted', () => {
    // The counter-case this puzzle was chosen over: `(1+2+3)×1 = 6` reads
    // like a bracket lesson but solves flat as `1+2+3×1`, so a player taps
    // straight through it and never meets a block at all. Here every
    // solution goes through a group, which is what makes the lesson stick.
    const third = ONBOARDING_PUZZLES[2]
    const entry = reachable(third.numbers, third.ops).find(e => e.target === third.target)
    expect(entry!.pattern).toContain('(')
  })
})
