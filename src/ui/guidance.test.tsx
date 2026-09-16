// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGame } from './useGame'
import { useHint } from './useHint'
import { nextGuidance, type Guidance } from './guidance'
import { blockZoneId } from './Expression'
import { computeHint } from '../core/hints'
import { notate } from '../core/notation'
import { createExpression, createTray, type Operator } from '../core/expression'
import { ONBOARDING_PUZZLES, type OnboardingPuzzle, type ScriptedBeat } from '../core/onboarding'
import type { TrayGuide } from './Tray'

// The first-run introduction's step-by-step guidance (`guidance.ts`).
//
// The test that matters here is the last one — **following the guidance
// blindly solves the board** — and it is the test that would have caught
// this round's one real bug. The first version of the guidance simply
// showed `computeHint`'s next move, which on the second onboarding board
// reads "tap the block chip" at a moment when a *tapped* block lands at
// the player's anchor rather than at the index the plan named: the bracket
// wrapped the `3`, and a beginner following the instructions exactly
// arrived at a dead end. Only playing it move by move shows that; asking
// what the guidance says at any single state does not.

/**
 * Board.tsx's own script matching, repeated here because this file plays a
 * board move by move and a beat is keyed on the board it speaks on. The
 * `fired` set is the part worth stating out loud: undoing a scripted
 * mistake puts the board back in exactly the state the beat names, so
 * without it the undo lesson walks the player back into the mistake for
 * ever — which is a loop this test would hang on rather than fail.
 */
function scriptedFor(
  script: readonly ScriptedBeat[] | undefined,
  notation: string,
  fired: Set<number>,
  trayNumbers: readonly { id: string; value: number; used: boolean }[],
): { guide: TrayGuide | null; index: number } {
  const index = script ? script.findIndex((b, i) => b.at === notation && !fired.has(i)) : -1
  if (index === -1) return { guide: null, index }
  const tap = script![index].tap
  if (tap.kind === 'operator') return { guide: { kind: 'operator', op: tap.op }, index }
  if (tap.kind === 'block') return { guide: { kind: 'block' }, index }
  const slot = trayNumbers.find(n => n.value === tap.value && !n.used)
  return { guide: slot ? { kind: 'number', id: slot.id } : null, index }
}

/** One guided step, driven through the very handlers a real tap or drop calls. */
function playGuided(puzzle: OnboardingPuzzle, maxSteps = 16) {
  const { result } = renderHook(() => {
    const game = useGame({ numbers: puzzle.numbers, target: puzzle.target, ops: puzzle.ops })
    const hint = useHint({
      expr: game.expr,
      tray: game.tray,
      target: puzzle.target,
      opsAllowed: puzzle.ops,
      numbersCount: puzzle.numbers.length,
      onApplyMove: game.applyHintMove,
    })
    return { game, hint }
  })

  const steps: string[] = []
  const fired = new Set<number>()
  for (let i = 0; i < maxSteps; i++) {
    const game = result.current.game
    const { guide, index } = scriptedFor(puzzle.script, notate(game.expr), fired, game.trayNumbers)
    const guidance = guidanceFor(game, puzzle, guide)
    if (guidance === null) break
    if (index !== -1) fired.add(index)
    steps.push(guidance.message)
    act(() => perform(result.current.game, guidance))
    if (guidance.message === 'guideSubmit') break
  }
  return { steps, notation: notate(result.current.game.expr), status: result.current.game.status }
}

/**
 * Do what the guidance says, the way a player would: taps go through the
 * tap handlers, and the one drag goes through `onDrop` with the zone the
 * guidance itself marked — never through `applyHintMove`, which is the
 * hint button's path and can place a block where a tap cannot.
 */
function perform(game: ReturnType<typeof useGame>, guidance: Guidance) {
  switch (guidance.message) {
    case 'guideNumber':
      game.onTapNumber((guidance.tray as { kind: 'number'; id: string }).id)
      return
    case 'guideOperator':
      game.onTapOperator((guidance.tray as { kind: 'operator'; op: Operator }).op)
      return
    case 'guideBlock':
      game.onTapBlock()
      return
    case 'guideBlockDrag':
      game.onDrop(
        { id: 'tray-block', kind: 'operand', data: { role: 'block', origin: 'tray' } },
        { zoneId: guidance.zone!, occupied: false },
      )
      return
    case 'guideGrow':
      game.onDrop(
        { id: (guidance.tray as { kind: 'number'; id: string }).id, kind: 'operand', data: { role: 'number', origin: 'tray' } },
        { zoneId: guidance.zone!, occupied: true },
      )
      return
    case 'guideSubmit':
      game.onSubmit()
      return
    // The three recovery gestures, each performed the way a finger would:
    // the bracket is *dragged* onto the marked position (its own drop
    // handler, not `moveGroup` directly), a wrong chip is *tapped* back,
    // and a bracket with nowhere better to go is dissolved by tapping an
    // edge. None of them goes near `applyHintMove`.
    case 'guideMoveBlock':
      game.onDrop(
        { id: guidance.marked![0], kind: 'operand', data: { role: 'block', origin: 'field' } },
        { zoneId: guidance.zone!, occupied: false },
      )
      return
    case 'guideUndo':
      game.onTapLeaf(guidance.marked![0])
      return
    case 'guideDissolve':
      game.onDissolveGroup(guidance.marked![0])
      return
  }
}

/**
 * The guidance for a board, asked exactly the way Board.tsx asks it — the
 * real `useGame`, so the block preview is the real one.
 *
 * Deliberately not a hand-built `blockTap`: the first version of this file
 * passed one, and it agreed with the fixed code for the wrong reason. The
 * preview has to come from `useGame`, because what makes it correct is
 * that it is trimmed the same way every real edit is (`blockTapResult`'s
 * own note).
 */
function guidanceFor(game: ReturnType<typeof useGame>, puzzle: OnboardingPuzzle, scripted: TrayGuide | null = null) {
  return nextGuidance({
    plan: computeHint(game.expr, game.tray, puzzle.target, puzzle.ops, puzzle.numbers.length)?.moves ?? null,
    children: game.expr.root.children,
    tray: game.tray,
    target: puzzle.target,
    opsAllowed: puzzle.ops,
    numbersCount: puzzle.numbers.length,
    blockTap: game.blockTap,
    submitEnabled: game.submitEnabled,
    scripted,
  })
}

describe('guidance — what it points at', () => {
  const onEmptyBoard = (puzzle: OnboardingPuzzle) => {
    const { result } = renderHook(() => useGame({ numbers: puzzle.numbers, target: puzzle.target, ops: puzzle.ops }))
    return guidanceFor(result.current, puzzle)
  }

  it('points at a number on the board that needs no bracket', () => {
    expect(onEmptyBoard(ONBOARDING_PUZZLES[0]))
      .toEqual({ tray: { kind: 'number', id: expect.any(String) }, zone: null, marked: null, message: 'guideNumber' })
  })

  it('offers the bracket first wherever the plan needs one, before the chips that sit around it', () => {
    // Not the plan's own first move: `computeHint` opens `3 × (1 + 2)` with
    // the `3`. A bracket has to exist before chips can be tapped into it,
    // because a tapped block lands at the anchor — see guidance.ts's header.
    //
    // And a *tap*, not a drag: on an untouched field the anchor is the
    // start, which is where a first bracket belongs. The drag instruction
    // turning up here was this round's second bug, and it came from a
    // preview tree the game never actually holds.
    for (const puzzle of [ONBOARDING_PUZZLES[1], ONBOARDING_PUZZLES[2]]) {
      expect(onEmptyBoard(puzzle)?.message).toBe('guideBlock')
    }
  })

  it('says nothing at all on a dead end, rather than "press ="', () => {
    // A complete board that misses the target looks exactly like this from
    // here — plan null — and telling a player to submit it would be the one
    // piece of advice the guidance must never give. The dead-end border and
    // the blocker marks are the honest answer.
    const puzzle = ONBOARDING_PUZZLES[1]
    const tray = createTray(puzzle.numbers)
    expect(nextGuidance({
      plan: null,
      children: createExpression().root.children,
      tray,
      target: puzzle.target,
      opsAllowed: puzzle.ops,
      numbersCount: puzzle.numbers.length,
      blockTap: null,
      submitEnabled: true,
      scripted: null,
    })).toBeNull()
  })

  it('points at "=" once the plan is empty and the board is submittable', () => {
    const puzzle = ONBOARDING_PUZZLES[0]
    const tray = createTray(puzzle.numbers)
    const args = {
      plan: [],
      children: createExpression().root.children,
      tray,
      target: puzzle.target,
      opsAllowed: puzzle.ops,
      numbersCount: puzzle.numbers.length,
      blockTap: null,
      scripted: null,
    }
    expect(nextGuidance({ ...args, submitEnabled: true })?.message).toBe('guideSubmit')
    // …and not while `=` is still refused (concept 9.1's two conditions):
    // a line telling a player to press a dead button is worse than none.
    expect(nextGuidance({ ...args, submitEnabled: false })).toBeNull()
  })

  it('names the drag, and the bracket edge it lands on, for the one move tapping cannot make', () => {
    const puzzle = ONBOARDING_PUZZLES[2]
    const { result } = renderHook(() => useGame({ numbers: puzzle.numbers, target: puzzle.target, ops: puzzle.ops }))
    // Build `(1 + 1)` the way the card asks, by tapping.
    act(() => result.current.onTapBlock())
    act(() => result.current.onTapNumber(result.current.tray[0].id))
    act(() => result.current.onTapOperator('+'))
    act(() => result.current.onTapNumber(result.current.tray[1].id))

    const game = result.current
    const guidance = guidanceFor(game, puzzle)

    const group = game.expr.root.children.find(c => c !== null && c.kind === 'group')!
    expect(guidance?.message).toBe('guideGrow')
    // The 'after' side, because that is the end `growGroupAt` inserts on.
    expect(guidance?.zone).toBe(blockZoneId(group.id, 'after'))
  })

  it('tells the player to drag the bracket where a tap would land it somewhere else', () => {
    // Off the guided path: a player who builds `3 ×` by hand needs a
    // bracket at position 2, and a tap would wrap the `3` instead. This is
    // the state the first version of the guidance got wrong.
    const puzzle = ONBOARDING_PUZZLES[1]
    const { result } = renderHook(() => useGame({ numbers: puzzle.numbers, target: puzzle.target, ops: puzzle.ops }))
    act(() => result.current.onTapNumber(result.current.tray[2].id)) // the 3
    act(() => result.current.onTapOperator('*'))

    expect(guidanceFor(result.current, puzzle)?.message).toBe('guideBlockDrag')
    expect(guidanceFor(result.current, puzzle)?.zone).toBe('root-2')
  })
})

describe('guidance — following it blindly solves the board', () => {
  // The invariant, and the whole reason this file exists. Each step is
  // performed through the handler the instruction actually names — a tap
  // through the tap handler, the drag through `onDrop` — so a step that
  // only works when applied as a *hint* fails here, which is exactly what
  // this round's bug did.
  for (const [i, puzzle] of ONBOARDING_PUZZLES.entries()) {
    it(`board ${i + 1}: ${puzzle.numbers.join(', ')} → ${puzzle.target}`, () => {
      const { steps, notation, status } = playGuided(puzzle)
      expect(status, `${notation} (steps: ${steps.join(' → ')})`).toBe('correct')
      expect(steps[steps.length - 1]).toBe('guideSubmit')
    })
  }

  it('walks the second board into a misplaced bracket and out again by moving it', () => {
    // The scripted mistake and its repair, as one sequence. `guideBlock`
    // here is the mistake — a *tapped* block lands at the player's anchor,
    // which on `3 ×` is the `3` — and `guideMoveBlock` is the lesson the
    // board exists for: a bracket in the wrong place is moved, not undone.
    // Measured before it was written: on this board any wrong bracket
    // placement is unreachable at once, so the repair follows the mistake
    // immediately rather than after four more taps and a red `=`.
    expect(playGuided(ONBOARDING_PUZZLES[1]).steps).toEqual([
      'guideNumber', 'guideOperator', 'guideBlock', 'guideMoveBlock',
      'guideNumber', 'guideOperator', 'guideNumber', 'guideSubmit',
    ])
  })

  it('walks the third board into a wrong operator and out again by tapping it back', () => {
    // The undo beat, and where it sits: *after* `guideGrow`, so the player
    // meets it having already managed the one gesture this board is for.
    const { steps } = playGuided(ONBOARDING_PUZZLES[2])
    expect(steps.indexOf('guideUndo')).toBeGreaterThan(steps.indexOf('guideGrow'))
    expect(steps).toEqual([
      'guideBlock', 'guideNumber', 'guideOperator', 'guideNumber', 'guideGrow',
      'guideOperator', 'guideOperator', 'guideUndo',
      'guideOperator', 'guideNumber', 'guideSubmit',
    ])
  })

  it('shows each scripted mistake once, so undoing one does not walk back into it', () => {
    // Undoing the third board's wrong operator puts the board back in
    // exactly the state the beat is keyed on. Without Board's `fired` set
    // the beat would fire again, the undo would follow again, and the
    // player would never leave — so this is a loop check as much as a
    // count: one mistake, one repair.
    const { steps } = playGuided(ONBOARDING_PUZZLES[2])
    expect(steps.filter(m => m === 'guideUndo')).toHaveLength(1)
    expect(playGuided(ONBOARDING_PUZZLES[1]).steps.filter(m => m === 'guideMoveBlock')).toHaveLength(1)
  })

  it('teaches the drag on the third board and on no other', () => {
    // The progression the boards exist for, stated as one assertion: two
    // tap-only lessons, then the one gesture tapping cannot make.
    expect(playGuided(ONBOARDING_PUZZLES[0]).steps).not.toContain('guideGrow')
    expect(playGuided(ONBOARDING_PUZZLES[1]).steps).not.toContain('guideGrow')
    expect(playGuided(ONBOARDING_PUZZLES[2]).steps).toContain('guideGrow')
  })

  it('never asks for a drag on either bracket board while the player stays on the guided path', () => {
    // `guideBlockDrag` is the honest instruction for a board someone has
    // already built around the bracket's own spot — it should never appear
    // to a player who has only ever done what the line told them to.
    expect(playGuided(ONBOARDING_PUZZLES[1]).steps).not.toContain('guideBlockDrag')
    expect(playGuided(ONBOARDING_PUZZLES[2]).steps).not.toContain('guideBlockDrag')
  })
})
