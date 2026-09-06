// @vitest-environment jsdom
// core/ itself has no DOM dependency, but this file exercises the actual
// localStorage this module reads and writes — node has no such global
// (vite.config.ts's own note on why core/ defaults to 'node').
import { describe, it, expect, beforeEach } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './settings'

describe('settings persistence (concept section 11)', () => {
  beforeEach(() => localStorage.clear())

  it('falls back to defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips a saved selection', () => {
    const settings: Settings = { language: 'de', numbers: 4, ops: ['+', '-'], band: 2, uniqueOnly: true }
    saveSettings(settings)
    expect(loadSettings()).toEqual(settings)
  })

  it('sanitizes a corrupt stored value instead of throwing', () => {
    localStorage.setItem('zahlenkoenig:settings-v2', '{"numbers": 7, "ops": ["+", "%"], "band": 9}')
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, ops: ['+'] })
  })

  it('falls back to defaults on unparseable JSON', () => {
    localStorage.setItem('zahlenkoenig:settings-v2', 'not json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})
