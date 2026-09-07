// Owns Settings state and its LocalStorage round-trip (core/settings.ts)
// for the selection panel (concept 15.6). The one thing this adds on top
// of core/settings.ts's plain load/save is keeping every field mutually
// valid: an operator can't be deselected below two, and uniqueOnly turns
// itself back off the moment the current (numbers, ops) selection has no
// unique puzzles left to offer (concept 15.6's own two "stays honest"
// rules).

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../core/settings'
import { uniqueOnlyAvailable } from '../core/puzzles'
import type { Operator } from '../core/expression'

const ALL_OPS: Operator[] = ['+', '-', '*', '/']

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  useEffect(() => { saveSettings(settings) }, [settings])

  const setNumbers = useCallback((numbers: Settings['numbers']) => {
    setSettings(s => (s.numbers === numbers ? s : { ...s, numbers, band: 0 }))
  }, [])

  // Changing the operator set can only ever narrow what's reachable, never
  // widen it (concept 15.7 makes the same observation about uniqueOnly) —
  // so a target band that was fine a moment ago can go stale, and this is
  // the one place that knows both facts changed together: reset to band 0
  // and drop uniqueOnly if the new set can no longer offer it.
  const toggleOp = useCallback((op: Operator) => {
    setSettings(s => {
      if (s.ops.includes(op) && s.ops.length <= 2) return s // concept 15.6: at least two operators must stay selected
      const nextSet = new Set(s.ops.includes(op) ? s.ops.filter(o => o !== op) : [...s.ops, op])
      const ops = ALL_OPS.filter(o => nextSet.has(o))
      return { ...s, ops, band: 0, uniqueOnly: s.uniqueOnly && uniqueOnlyAvailable(s.numbers, ops) }
    })
  }, [])

  const setBand = useCallback((band: Settings['band']) => {
    setSettings(s => (s.band === band ? s : { ...s, band }))
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
