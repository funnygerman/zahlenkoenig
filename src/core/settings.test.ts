// @vitest-environment jsdom
// core/ itself has no DOM dependency, but this file exercises the actual
// localStorage this module reads and writes — node has no such global
// (vite.config.ts's own note on why core/ defaults to 'node').
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DEFAULT_SETTINGS, detectLanguage, loadSettings, saveSettings, type Settings } from './settings'

describe('settings persistence (concept section 11)', () => {
  beforeEach(() => localStorage.clear())

  it('falls back to defaults when nothing is stored, with the language detected from the browser', () => {
    // vitest.setup.ts stubs navigator.language to 'de-DE' for jsdom tests —
    // see detectLanguage's own dedicated tests below for en/ru/unsupported.
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, language: 'de' })
  })

  it('round-trips a saved selection', () => {
    const settings: Settings = { language: 'de', numbers: 4, ops: ['+', '-'], band: 2, uniqueOnly: true }
    saveSettings(settings)
    expect(loadSettings()).toEqual(settings)
  })

  it('sanitizes a corrupt stored value instead of throwing', () => {
    localStorage.setItem('zahlenkoenig:settings-v2', '{"numbers": 7, "ops": ["+", "%"], "band": 9}')
    // "%" is filtered out, leaving only one valid op — below the minimum of
    // two (concept 15.6, revised), so this falls back the same way an empty
    // ops array does.
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to defaults for a value saved before ops required at least two (concept 15.6, revised)', () => {
    localStorage.setItem('zahlenkoenig:settings-v2', JSON.stringify({ ...DEFAULT_SETTINGS, ops: ['+'] }))
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to defaults on unparseable JSON', () => {
    localStorage.setItem('zahlenkoenig:settings-v2', 'not json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})

describe('detectLanguage (i18n round: no language switcher — the browser decides once)', () => {
  const original = navigator.language

  function stubNavigatorLanguage(value: string) {
    Object.defineProperty(navigator, 'language', { value, configurable: true })
  }

  afterEach(() => stubNavigatorLanguage(original))

  it('detects German', () => {
    stubNavigatorLanguage('de-DE')
    expect(detectLanguage()).toBe('de')
  })

  it('detects Russian', () => {
    stubNavigatorLanguage('ru-RU')
    expect(detectLanguage()).toBe('ru')
  })

  it('detects English', () => {
    stubNavigatorLanguage('en-GB')
    expect(detectLanguage()).toBe('en')
  })

  it('falls back to English for an unsupported browser language', () => {
    stubNavigatorLanguage('fr-FR')
    expect(detectLanguage()).toBe('en')
  })

  it('is case-insensitive', () => {
    stubNavigatorLanguage('DE-de')
    expect(detectLanguage()).toBe('de')
  })
})
