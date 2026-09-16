// The playable board itself: wires useGame (state), useDrag (gestures),
// Tray and Expression (rendering) together for one puzzle. Split out of
// what used to be Game.tsx (v2 step 2) once step 3 needed Game.tsx to own
// something bigger — settings, generation, the header — while this part
// stays exactly what it was: a fixed puzzle, played. Game.test.tsx's own
// interaction tests import this directly for that reason: they exercise
// tap/drag wiring against a known, fixed puzzle and don't need (or want)
// a random one from the generator.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useGame } from './useGame'
import { useHint } from './useHint'
import { useFlip } from './useFlip'
import { useDrag, type DragItem, type DropOutcome } from './useDrag'
import { Tray, type TrayGuide } from './Tray'
import { Expression } from './Expression'
import { nextGuidance } from './guidance'
import { Chip } from './Chip'
import { formatResult, notate } from '../core/notation'
import type { Operator } from '../core/expression'
import type { ScriptedBeat } from '../core/onboarding'
import { t, type Language } from '../core/i18n'
import './tokens.css'
import styles from './Game.module.css'

export interface BoardProps {
  numbers: number[]
  target: number
  ops: Operator[]
  /** called 1200ms after a correct submit (concept 12.8) — the caller's cue to bring in the next puzzle. */
  onSolved?: () => void
  /**
   * Defaults to German — Game.tsx always passes the real `settings.language`
   * (detected once, no switcher — see settings.ts's `detectLanguage`); the
   * default only matters for tests that render `Board` directly with a
   * fixed puzzle and don't care which language its one translated
   * aria-label comes out in.
   */
  language?: Language
  /**
   * How the header's hint icon should stand: `offered` false means this
   * puzzle has no hints at all (two numbers — PO) and the icon is hidden
   * rather than shown dead; `available` false means a press would do
   * nothing right now (budget spent, or nothing left to hint about) and the
   * icon mutes. `reason` is which of those two it is, for the header to
   * explain on a tap instead of just sitting muted (`null` whenever
   * `available` is true). See the effect in Board that reports it.
   */
  onHintState?: (state: { offered: boolean; available: boolean; reason: 'complete' | 'spent' | null }) => void
  /**
   * Walk the player through this board one move at a time: the chip to use
   * next is marked in the tray and a line names the gesture (PO, after the
   * report that the introduction's boards still leave a newcomer guessing
   * which button to press).
   *
   * Only ever true for the first-run introduction. On a generated puzzle
   * this would hand over the solution, which is what the hint button and
   * its budget are for.
   */
  guided?: boolean
  /**
   * The scripted departures from that advice, for the boards that teach
   * recovery (`core/onboarding.ts`'s `ScriptedBeat`). Each beat names the
   * board it speaks on, so matching is a string comparison against the
   * notation this component already computes — and a board the script does
   * not name is guided the derived way, which is what a player who wanders
   * off it gets.
   */
  script?: readonly ScriptedBeat[]
}

/** Imperative handle so the header's hint icon (concept 12.7), rendered by a sibling in Game.tsx, can trigger a press on the board it belongs to (concept 10.3). */
export interface BoardHandle {
  pressHint: () => void
}

interface DragPayload {
  role: 'number' | 'operator' | 'block'
  operator?: Operator
  /** what the ghost has to show while this chip is in the air — the chip it came from isn't reachable from an id alone. */
  value?: number
  /**
   * Which half of the board this chip was picked up from. Tapping means
   * opposite things on the two sides — the tray places, the field returns
   * (concept 6.6: "die exakte Umkehrung des Platzierens") — and `role`
   * alone can't tell them apart, so a tapped operator on the board placed
   * a second one; numbers escaped it only because `onTapNumber` happens to
   * check whether the id is already placed.
   *
   * It doubles as the chip's scale, which is the same fact: field chips
   * are smaller than tray chips (concept 12.5).
   */
  origin: 'tray' | 'field'
}

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Concept 6.7's own number: "die getönte Fläche fällt über rund 150 ms in
 * den Feldhintergrund zurück". `.dissolving` in Expression.module.css uses
 * the same 150 — the two aren't derived from one shared constant (CSS
 * modules can't read a JS value), so a change to one has to carry over to
 * the other by hand.
 */
const DISSOLVE_FADE_MS = 150

const GHOST_VARIANT: Record<DragPayload['role'], 'number' | 'operator' | 'block'> = {
  number: 'number',
  operator: 'operator',
  block: 'block',
}

/**
 * A scripted beat, resolved against the tray this board actually has.
 *
 * A beat names a number by its **value** rather than by a leaf id (ids are
 * minted per puzzle, and the third board's three `1`s are interchangeable),
 * so the first unused slot of that value is the chip to mark. A value the
 * tray has already spent resolves to nothing and the derived guidance
 * answers instead, which is the same fallback a board the script does not
 * name gets.
 */
function resolveBeat(beat: ScriptedBeat, trayNumbers: readonly { id: string; value: number; used: boolean }[]): TrayGuide | null {
  const tap = beat.tap
  if (tap.kind === 'operator') return { kind: 'operator', op: tap.op }
  if (tap.kind === 'block') return { kind: 'block' }
  const slot = trayNumbers.find(n => n.value === tap.value && !n.used)
  return slot ? { kind: 'number', id: slot.id } : null
}

/** The dragged chip, redrawn inside the ghost — same variant, same scale, so what follows the finger looks like what was picked up. */
function GhostChip({ payload }: { payload: DragPayload }) {
  return (
    <Chip
      variant={GHOST_VARIANT[payload.role]}
      value={payload.value}
      operator={payload.operator}
      scale={payload.origin}
      tabIndex={-1}
    />
  )
}

export const Board = forwardRef<BoardHandle, BoardProps>(function Board({ numbers, target, ops, onSolved, language = 'de', onHintState, guided = false, script }, ref) {
  const game = useGame({ numbers, target, ops })
  const hint = useHint({
    expr: game.expr,
    tray: game.tray,
    target,
    opsAllowed: ops,
    numbersCount: numbers.length,
    onApplyMove: game.applyHintMove,
  })
  useImperativeHandle(ref, () => ({ pressHint: hint.onPressHint }), [hint.onPressHint])

  // The header's hint icon is a sibling in Game.tsx's tree, so it can't read
  // this board's hint state the way the imperative `pressHint` above lets it
  // *write* to it — and it has to mute itself once a press would do nothing
  // (the two-hint budget spent, or the puzzle already correctly built).
  // Reported upward rather than lifted: the hint still belongs to the board
  // it is about, and Board is remounted per puzzle while Header is not.
  //
  // There used to be an `onboarding` prop here that forced `offered` false,
  // so neither first-run puzzle ever showed a hint. It is gone (PO): once
  // the three-number-group round gave `(1+1+1) × 3` a real budget,
  // withholding the hint meant a beginner met the game's hardest gesture
  // with no help at all. An onboarding board is treated exactly like any
  // other now, and the ordinary rules land in the right place by
  // themselves — the two-number board still offers nothing (`hintBudget`
  // gives two numbers none, the PO's own rule), and the bracket board
  // offers four of the eight chips it takes, stopping well before the drag
  // the card is teaching.
  useEffect(() => {
    onHintState?.({ offered: hint.offered, available: hint.available, reason: hint.hintReason })
  }, [hint.offered, hint.available, hint.hintReason, onHintState])

  // Concept 6.7's dissolve fade: the real trigger is a tap detected by
  // useDrag (handleTap below), not Expression's own onClick (that path
  // only fires in tests that don't wire drag) — so the fade's timing has
  // to live here, one level above where the trigger actually is. Holding
  // the group open under its own id for DISSOLVE_FADE_MS lets Expression
  // render `.dissolving` on it before useGame actually removes the group
  // and the chips fall back to root level.
  const [dissolvingId, setDissolvingId] = useState<string | null>(null)
  const dissolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (dissolveTimer.current) clearTimeout(dissolveTimer.current) }, [])

  const handleDissolve = useCallback((groupId: string) => {
    if (dissolvingId === groupId) return // already fading, a second tap on the same edge shouldn't restart or double-apply it
    if (prefersReducedMotion()) {
      game.onDissolveGroup(groupId)
      return
    }
    setDissolvingId(groupId)
    dissolveTimer.current = setTimeout(() => {
      game.onDissolveGroup(groupId)
      setDissolvingId(null)
    }, DISSOLVE_FADE_MS)
  }, [dissolvingId, game])

  // concept 12.8: a correct answer waits 1200ms — the value carried over
  // from v1 — before the next puzzle replaces this board; a wrong one
  // changes nothing, and there's no "gave up" path yet (concept 10, step 4).
  useEffect(() => {
    if (game.status !== 'correct') return
    const timer = setTimeout(() => onSolved?.(), 1200)
    return () => clearTimeout(timer)
  }, [game.status, onSolved])

  // useDrag only ever hands back what this app itself put into `data`
  // (concept 5: onTap and onDrop both feed the same handful of game
  // actions, just triggered differently) — the `!` reflects that
  // invariant, not a gap in it.
  const handleTap = useCallback((item: DragItem<DragPayload>) => {
    const { role, operator, origin } = item.data!
    // Anything already on the board goes back where it came from, whatever
    // kind of chip it is (concept 6.6). Only the tray places — except a
    // placed block, which isn't a leaf at all: tapping its bracket edge
    // dissolves the group (concept 6.5), the same as ever, just routed
    // through the shared drag layer's tap detection now that the edge is
    // also a drag handle.
    if (origin === 'field') {
      if (role === 'block') handleDissolve(item.id)
      else game.onTapLeaf(item.id)
      return
    }
    if (role === 'number') game.onTapNumber(item.id)
    else if (role === 'block') game.onTapBlock()
    else if (role === 'operator' && operator) game.onTapOperator(operator)
  }, [game, handleDissolve])

  const handleDrop = useCallback((item: DragItem<DragPayload>, target: DropOutcome) => {
    game.onDrop({ id: item.id, kind: item.kind, data: item.data! }, target)
  }, [game])

  const drag = useDrag<DragPayload>({ onTap: handleTap, onDrop: handleDrop })
  // Concept 13.3's FLIP animation — one registry shared by Tray and
  // Expression below, since a number's id is the same whichever of the two
  // currently renders it (useFlip.ts's own note on why).
  const flipRef = useFlip()

  // ------------------------------------------------------- guidance (guided)
  // The first-run introduction's step-by-step help: the chip to use next is
  // marked in the tray, a line names the gesture, and the two moves that
  // have a destination (a dragged block, a number grown into a bracket)
  // mark that too. `ui/guidance.ts` makes the choice and carries the whole
  // account of why it is not simply "the hint's next move"; everything here
  // is wiring.
  //
  // Withheld while a verdict is on screen (`status !== 'idle'`): a board
  // that has just been judged is not waiting for a next move, and the
  // readout above is what the player is reading in that moment.
  //
  // Withheld only while a *correct* answer is on screen: that board is
  // finished and the next puzzle is already on its way. A **wrong** one is
  // the opposite — it is a board waiting to be repaired, and the recovery
  // lines below are exactly what it is waiting for. (Both were withheld
  // until this round, which left the line blank at the one moment a
  // beginner most needs it.)
  const notation = notate(game.expr)

  // Which scripted beat, if any, speaks on this board. `-1` for every board
  // the script does not name, which is every board on the first lesson and
  // most boards on the other two.
  //
  // `fired` is the one piece of ordering state here, and it earns its
  // place: undoing a scripted mistake puts the board back in exactly the
  // state the beat is keyed on, so without it the undo lesson would walk
  // the player straight back into the mistake, for ever. A beat is spent
  // once the board has *left* it.
  const [fired, setFired] = useState<ReadonlySet<number>>(() => new Set())
  const beat = script && guided
    ? script.findIndex((b, i) => b.at === notation && !fired.has(i))
    : -1
  const lastBeat = useRef<number | null>(null)
  useEffect(() => {
    if (beat !== -1) { lastBeat.current = beat; return }
    const spent = lastBeat.current
    if (spent === null) return
    lastBeat.current = null
    setFired(prev => (prev.has(spent) ? prev : new Set(prev).add(spent)))
  }, [beat])

  const guidance = guided && game.status !== 'correct'
    ? nextGuidance({
        plan: hint.plan,
        children: game.expr.root.children,
        tray: game.tray,
        target,
        opsAllowed: ops,
        numbersCount: numbers.length,
        blockTap: game.blockTap,
        submitEnabled: game.submitEnabled,
        scripted: beat === -1 ? null : resolveBeat(script![beat], game.trayNumbers),
      })
    : null
  // Concept 9.2's notation line, revised (PO): the result only ever meant
  // anything to a player who had already committed to the expression, so
  // it's withheld until `=` is pressed rather than appearing live as the
  // tree happens to become complete — `game.status` already goes back to
  // 'idle' on any edit (useGame's own "a verdict doesn't outlive the
  // expression it was about"), which is exactly "judged and unedited since".
  // `game.result` can be negative now (result-on-submit round): a wrong
  // attempt shows its own "= −3" rather than hiding behind bare notation.
  const readout = game.status !== 'idle' && game.result !== null ? `${notation} = ${formatResult(game.result)}` : notation

  return (
    <div className={styles.board}>
      <div className={styles.fieldRow}>
        <Expression
          expr={game.expr}
          scaffoldOperands={game.scaffoldOperands}
          scaffoldOperators={game.scaffoldOperators}
          onTapLeaf={game.onTapLeaf}
          onDissolveGroup={handleDissolve}
          dissolveLabel={t(language, 'dissolveGroup')}
          registerZone={drag.registerZone}
          dragHandlers={drag.dragHandlers}
          activeZoneId={drag.activeZoneId}
          guideZoneId={guidance?.zone ?? null}
          deadEnd={hint.deadEnd}
          // The guidance's own marks win where it has any: a recovery line
          // says "the marked chip", so the chip it means has to be the one
          // that is marked, and one `findBlockers` call produces both.
          // Where there is no guidance — every ordinary puzzle — this is
          // the hint button's own marking, unchanged.
          blockingIds={guidance?.marked ?? hint.blockingIds}
          verdict={game.status === 'idle' ? null : game.status}
          flipRef={flipRef}
          dissolvingGroupId={dissolvingId}
        />
        {/* Display-only — no onClick at all, so it's never had a keyboard
            path; out of tab order for the same reason as the tray/field
            chips below (CLAUDE.md's open Tastaturbedienung question). */}
        <Chip variant="target" value={target} tabIndex={-1} />
      </div>

      {/* concept 9.2's notation line, moved (PO): directly under the field
          being built, above the tray, rather than below it — real notation
          as the tree grows, "= result" appended only once `=` has been
          pressed on it. */}
      <div className={cx(styles.readout, game.status === 'wrong' && styles.wrong, game.status === 'correct' && styles.correct)} role="status">
        {readout}
      </div>

      <Tray
        numberSlots={game.trayNumbers}
        blockDisabled={game.blockDisabled}
        operatorsMuted={game.operatorsMuted}
        operators={game.operators}
        submitEnabled={game.submitEnabled}
        onTapNumber={game.onTapNumber}
        onTapBlock={game.onTapBlock}
        onTapOperator={game.onTapOperator}
        onSubmit={game.onSubmit}
        dragHandlers={drag.dragHandlers}
        flipRef={flipRef}
        guide={guidance?.tray ?? null}
      />

      {/* Rendered as an empty line rather than not at all once the board
          is solved, so finishing a guided board doesn't shift everything
          above it by a line's height. It exists on no board but these. */}
      {guided && (
        <div className={styles.guideLine} role="status">
          {guidance ? t(language, guidance.message) : ''}
        </div>
      )}

      {/* concept 5.1's "Geisterelement": the chip itself stays put and
          dims, a copy follows the finger. useDrag writes the transform
          straight onto this node — React only ever decides *what* is in
          it, never where it is. */}
      <div
        ref={drag.ghostRef}
        className={styles.ghost}
        style={{ display: drag.isDragging ? 'grid' : 'none' }}
        aria-hidden="true"
      >
        {drag.draggingItem && <GhostChip payload={drag.draggingItem.data!} />}
      </div>
    </div>
  )
})
