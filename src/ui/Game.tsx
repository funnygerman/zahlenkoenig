// The full game loop (concept 16, step 3: "vollständige Spielschleife").
// Owns settings (concept 15/section 11) and puzzle generation (concept
// 15.10's `nextPuzzle()`), renders the header/selection chip (concept
// 12.7) above the board, and replaces the puzzle 1200ms after a correct
// answer (concept 12.8). Board.tsx — everything this used to be, back
// when the puzzle was concept 12.5's own hardcoded worst case — now owns
// just one puzzle at a time; this is what feeds it a new one.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Header } from './Header'
import { Board } from './Board'
import { useSettings } from './useSettings'
import { nextPuzzle, type Puzzle } from '../core/puzzles'
import './tokens.css'
import styles from './Game.module.css'

export function Game() {
  const { settings, setNumbers, toggleOp, setBand, setUniqueOnly } = useSettings()

  const [puzzle, setPuzzle] = useState<Puzzle>(() => nextPuzzle(settings))
  // A fresh key per puzzle remounts Board — simpler and safer than trying
  // to reset useGame's own expression tree in place, since a stale tree
  // built from the *previous* puzzle's leaf ids would otherwise survive
  // the swap (its `numbers` prop changing doesn't imply its state should).
  const [puzzleKey, setPuzzleKey] = useState(0)

  const draw = useCallback(() => {
    setPuzzle(nextPuzzle(settings))
    setPuzzleKey(k => k + 1)
  }, [settings])

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
      />
      <Board key={puzzleKey} numbers={puzzle.numbers} target={puzzle.target} ops={settings.ops} onSolved={draw} />
    </div>
  )
}
