// Owns Settings state and its LocalStorage round-trip (core/settings.ts)
// for the selection panel (concept 15.6). The one thing this adds on top
// of core/settings.ts's plain load/save is keeping every field mutually
// valid: an operator can't be deselected below two, and uniqueOnly turns
// itself back off the moment the current (numbers, ops) selection has no
// unique puzzles left to offer (concept 15.6's own two "stays honest"
// rules).

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../core/settings'
import { bandCount, uniqueOnlyAvailable } from '../core/puzzles'
import type { Operator } from '../core/expression'

const ALL_OPS: Operator[] = ['+', '-', '*', '/']

/**
 * The one rule that spans two fields: uniqueOnly only means anything for a
 * (numbers, ops) selection that actually has unique-solution puzzles
 * (concept 15.6/15.7). Applied after *every* change and once on load, not
 * only in `toggleOp` — the number count changes the same fact, and
 * `{2 Zahlen, +−, uniqueOnly}` switched to 3 numbers left uniqueOnly on
 * for a selection whose whole search space has zero unique solutions
 * ('3-3' in puzzles.ts's own table), which makes `nextPuzzle` exhaust its
 * 500 attempts and throw — a blank screen, and a *persisted* one, since
 * the impossible combination was saved to LocalStorage and reloaded on
 * every start.
 */
function reconcile(settings: Settings): Settings {
  // A selection can now offer fewer than three bands (puzzles.ts's BandRow),
  // so a band carried over from a wider selection has to be clamped before
  // anything else looks at it.
  const bands = bandCount(settings.numbers, settings.ops)
  const band = Math.min(settings.band, bands - 1) as Settings['band']
  const next = band === settings.band ? settings : { ...settings, band }
  if (!next.uniqueOnly || uniqueOnlyAvailable(next.numbers, next.ops, next.band)) return next
  return { ...next, uniqueOnly: false }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => reconcile(loadSettings()))

  useEffect(() => { saveSettings(settings) }, [settings])

  // The band is deliberately *not* reset here or in `toggleOp` (PO): it is
  // the player's own answer to "wie groß das Ziel", and every selection
  // offers all three bands (concept 15.5: "kein einziges Band leer"), so
  // there is nothing to reset it for. Only the [lo,hi] range behind the
  // chosen band changes with the selection, which is exactly what the
  // panel already shows.
  const setNumbers = useCallback((numbers: Settings['numbers']) => {
    setSettings(s => (s.numbers === numbers ? s : reconcile({ ...s, numbers })))
  }, [])

  const toggleOp = useCallback((op: Operator) => {
    setSettings(s => {
      if (s.ops.includes(op) && s.ops.length <= 2) return s // concept 15.6: at least two operators must stay selected
      const nextSet = new Set(s.ops.includes(op) ? s.ops.filter(o => o !== op) : [...s.ops, op])
      const ops = ALL_OPS.filter(o => nextSet.has(o))
      return reconcile({ ...s, ops })
    })
  }, [])

  const setBand = useCallback((band: Settings['band']) => {
    // Through reconcile like every other change: uniqueOnly's availability
    // is band-aware now, so changing the band alone can invalidate it.
    setSettings(s => (s.band === band ? s : reconcile({ ...s, band })))
  }, [])

  const setUniqueOnly = useCallback((uniqueOnly: boolean) => {
    setSettings(s => (uniqueOnly && !uniqueOnlyAvailable(s.numbers, s.ops) ? s : { ...s, uniqueOnly }))
  }, [])

  const setLanguage = useCallback((language: Settings['language']) => {
    setSettings(s => (s.language === language ? s : { ...s, language }))
  }, [])

  return { settings, setNumbers, toggleOp, setBand, setUniqueOnly, setLanguage }
}

export { DEFAULT_SETTINGS }
