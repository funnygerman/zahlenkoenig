// The full game loop (concept 16, step 3: "vollständige Spielschleife").
// Owns settings (concept 15/section 11) and puzzle generation (concept
// 15.10's `nextPuzzle()`), renders the header/selection chip (concept
// 12.7) above the board, and replaces the puzzle 1200ms after a correct
// answer (concept 12.8). Board.tsx — everything this used to be, back
// when the puzzle was concept 12.5's own hardcoded worst case — now owns
// just one puzzle at a time; this is what feeds it a new one.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Header } from './Header'
import { Board, type BoardHandle } from './Board'
import { useSettings } from './useSettings'
import { useUpdateAvailable } from './useUpdateAvailable'
import { nextPuzzle, type Puzzle } from '../core/puzzles'
import { loadRecent, loadRecentShapes, saveRecent, saveRecentShapes, withPuzzle, withShape } from '../core/history'
import './tokens.css'
import styles from './Game.module.css'

export function Game() {
  const { settings, setNumbers, toggleOp, setBand, setUniqueOnly } = useSettings()
  const { available: updateAvailable, update: onUpdate } = useUpdateAvailable()

  // `<html lang>` matters to a screen reader (it picks pronunciation from
  // it) independent of anything this app itself renders, and there's no
  // language switcher to leave this in the wrong state for long — it's set
  // once per detected/stored language, same as everything else in
  // `settings.language` (no menu, PO decision — see settings.ts's own note).
  useEffect(() => {
    document.documentElement.lang = settings.language
  }, [settings.language])

  // The last few puzzles played, so the generator can draw around them
  // (history.ts): without it an immediate repeat is just how a memoryless
  // draw behaves, and in a thin selection — two numbers, a narrow band —
  // it happens often enough to notice (PO). A ref, not state: nothing
  // renders it, and a draw needs the value at the moment it draws.
  const recentRef = useRef<string[] | null>(null)
  const shapesRef = useRef<string[] | null>(null)
  if (recentRef.current === null) recentRef.current = loadRecent() // lazily: a useRef *argument* is evaluated on every render, and this one reads storage
  if (shapesRef.current === null) shapesRef.current = loadRecentShapes()
  const [puzzle, setPuzzle] = useState<Puzzle>(() => nextPuzzle(settings, recentRef.current ?? [], shapesRef.current ?? []))
  const boardRef = useRef<BoardHandle>(null)
  // A fresh key per puzzle remounts Board — simpler and safer than trying
  // to reset useGame's own expression tree in place, since a stale tree
  // built from the *previous* puzzle's leaf ids would otherwise survive
  // the swap (its `numbers` prop changing doesn't imply its state should).
  const [puzzleKey, setPuzzleKey] = useState(0)

  const draw = useCallback(() => {
    setPuzzle(nextPuzzle(settings, recentRef.current ?? [], shapesRef.current ?? []))
    setPuzzleKey(k => k + 1)
  }, [settings])

  // Recorded when a puzzle is actually shown rather than when it is drawn:
  // StrictMode runs a state initializer twice in development, and this way
  // the history holds what the player saw either way (`withPuzzle` drops
  // an older sighting of the same puzzle, so running twice changes
  // nothing).
  useEffect(() => {
    recentRef.current = withPuzzle(recentRef.current ?? [], puzzle)
    saveRecent(recentRef.current)
    shapesRef.current = withShape(shapesRef.current ?? [], puzzle.pattern)
    saveRecentShapes(shapesRef.current)
  }, [puzzle])

  // Re-draw whenever a setting that defines the puzzle space changes —
  // `language` doesn't, so it's deliberately not in this list. Skips its
  // own first run: the initial puzzle above already drew one for the
  // settings loaded from storage, and running this on mount too would
  // silently throw that first draw away and remount before the player
  // ever saw it.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.numbers, settings.ops.join(''), settings.band, settings.uniqueOnly])

  return (
    <div className={styles.page}>
      <Header
        settings={settings}
        onSetNumbers={setNumbers}
        onToggleOp={toggleOp}
        onSetBand={setBand}
        onSetUniqueOnly={setUniqueOnly}
        onPressHint={() => boardRef.current?.pressHint()}
        updateAvailable={updateAvailable}
        onUpdate={onUpdate}
      />
      <Board ref={boardRef} key={puzzleKey} numbers={puzzle.numbers} target={puzzle.target} ops={settings.ops} language={settings.language} onSolved={draw} />
    </div>
  )
}
