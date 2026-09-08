import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSettings } from './useSettings'
import { nextPuzzle } from '../core/puzzles'
import { DEFAULT_SETTINGS, type Settings } from '../core/settings'

const STORAGE_KEY = 'zahlenkoenig:settings-v2'

function store(settings: Partial<Settings>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }))
}

beforeEach(() => localStorage.clear())

describe('useSettings — the band is the player’s own choice (PO)', () => {
  it('survives a change of the number count', () => {
    const { result } = renderHook(() => useSettings())
    act(() => result.current.setBand(2))
    act(() => result.current.setNumbers(4))
    expect(result.current.settings.band).toBe(2)
  })

  it('survives an operator being switched off and on again', () => {
    const { result } = renderHook(() => useSettings())
    act(() => result.current.setBand(1))
    act(() => result.current.toggleOp('/'))
    expect(result.current.settings.band).toBe(1)
    act(() => result.current.toggleOp('/'))
    expect(result.current.settings.band).toBe(1)
  })

  it('is restored from storage rather than reset on load', () => {
    store({ band: 2 })
    const { result } = renderHook(() => useSettings())
    expect(result.current.settings.band).toBe(2)
  })
})

// '2-3' (two numbers, + and −) has unique-solution puzzles; '3-3' and
// '4-3' have none at all, so carrying uniqueOnly across a change of the
// number count left a selection nextPuzzle() cannot serve — it exhausts
// its attempts and throws, taking the whole app down with it, and the
// impossible combination is persisted, so every reload throws again.
describe('useSettings — uniqueOnly stays honest across every change', () => {
  it('switches itself off when the new number count has no unique puzzles', () => {
    const { result } = renderHook(() => useSettings())
    act(() => { result.current.toggleOp('*'); })
    act(() => { result.current.toggleOp('/'); })
    act(() => result.current.setNumbers(2))
    act(() => result.current.setUniqueOnly(true))
    expect(result.current.settings.uniqueOnly).toBe(true) // available for 2 numbers

    act(() => result.current.setNumbers(3))
    expect(result.current.settings.uniqueOnly).toBe(false)
    expect(() => nextPuzzle(result.current.settings)).not.toThrow()
  })

  it('switches itself off when an operator change takes the last unique puzzles away', () => {
    const { result } = renderHook(() => useSettings())
    act(() => result.current.setUniqueOnly(true))
    expect(result.current.settings.uniqueOnly).toBe(true) // 3 numbers, all four operators
    act(() => { result.current.toggleOp('*'); })
    act(() => { result.current.toggleOp('/'); })
    expect(result.current.settings.uniqueOnly).toBe(false)
    expect(() => nextPuzzle(result.current.settings)).not.toThrow()
  })

  it('switches itself off on load, for a combination already persisted', () => {
    store({ numbers: 3, ops: ['+', '-'], uniqueOnly: true })
    const { result } = renderHook(() => useSettings())
    expect(result.current.settings.uniqueOnly).toBe(false)
    expect(() => nextPuzzle(result.current.settings)).not.toThrow()
  })

  it('cannot be switched on for a selection that has nothing to offer', () => {
    store({ numbers: 4, ops: ['+', '-'] })
    const { result } = renderHook(() => useSettings())
    act(() => result.current.setUniqueOnly(true))
    expect(result.current.settings.uniqueOnly).toBe(false)
  })
})

describe('useSettings — every reachable selection is one nextPuzzle can serve', () => {
  it('holds across a walk through number counts and operator toggles', () => {
    const { result } = renderHook(() => useSettings())
    const ops = ['+', '-', '*', '/'] as const
    for (const op of ops) {
      for (const numbers of [2, 3, 4] as const) {
        // uniqueOnly asked for *first*, then the two things that can take
        // it away — the order the crash needed.
        act(() => result.current.setUniqueOnly(true))
        act(() => result.current.toggleOp(op))
        act(() => result.current.setNumbers(numbers))
        for (const band of [0, 1, 2] as const) {
          act(() => result.current.setBand(band))
          expect(() => nextPuzzle(result.current.settings)).not.toThrow()
        }
        act(() => result.current.toggleOp(op)) // back on, whichever way it went
      }
    }
  })
})

describe('useSettings — at least two operators stay selected (concept 15.6)', () => {
  it('refuses the third deselection', () => {
    const { result } = renderHook(() => useSettings())
    act(() => result.current.toggleOp('/'))
    act(() => result.current.toggleOp('*'))
    act(() => result.current.toggleOp('-'))
    expect(result.current.settings.ops).toEqual(['+', '-'])
  })
})
