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
      localStorage.setItem('zahlenkoenig:onboarding-v1', raw)
      expect(loadOnboardingStep()).toBe(0)
    }
  })
})

describe('onboarding — the two puzzles are what they claim to be', () => {
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

  it('the second needs a THREE-number group, which tapping alone cannot build', () => {
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
    const second = ONBOARDING_PUZZLES[1]
    expect(second.numbers).toEqual([1, 1, 1, 3])
    expect(second.target).toBe(9)
    const hint = computeHint(createExpression(), createTray(second.numbers), second.target, second.ops, second.numbers.length)
    expect(hint).not.toBeNull()
    expect(hint!.moves.some(m => m.kind === 'grow')).toBe(true)
  })

  it('the second has no flat route either — the bracket is required, not merely permitted', () => {
    // The counter-case this puzzle was chosen over: `(1+2+3)×1 = 6` reads
    // like a bracket lesson but solves flat as `1+2+3×1`, so a player taps
    // straight through it and never meets a block at all. Here every
    // solution goes through a group, which is what makes the lesson stick.
    const second = ONBOARDING_PUZZLES[1]
    const entry = reachable(second.numbers, second.ops).find(e => e.target === second.target)
    expect(entry!.pattern).toContain('(')
  })
})
