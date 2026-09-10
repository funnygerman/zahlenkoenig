import { describe, it, expect } from 'vitest'
import { LANGUAGES, t } from './i18n'

describe('t (i18n round: eight strings, three languages, no interpolation)', () => {
  it('has every language return a non-empty string for every key', () => {
    // Compile-time key parity already comes from `Record<Language, Strings>`
    // in i18n.ts — this is the runtime half of that guarantee: no language
    // ships an accidentally empty string for a key another one has real
    // text for.
    const keys = [
      'numbersLabel', 'opsLabel', 'targetLabel', 'hintLabel', 'anyBand',
      'uniqueOnlyPrefix', 'uniqueOnlyBold', 'uniqueOnlySuffix', 'uniqueOnlyUnavailable', 'dissolveGroup',
    ] as const
    for (const language of LANGUAGES) {
      for (const key of keys) {
        expect(t(language, key), `${language}.${key}`).not.toBe('')
      }
    }
  })

  it('returns the known German copy unchanged (concept 15.6/9.2/6.5\'s own wording)', () => {
    expect(t('de', 'numbersLabel')).toBe('Wie viele Zahlen')
    expect(t('de', 'opsLabel')).toBe('Welche Rechenzeichen')
    expect(t('de', 'targetLabel')).toBe('Wie groß das Ziel')
    expect(t('de', 'hintLabel')).toBe('Tipp')
    expect(t('de', 'anyBand')).toBe('beliebig')
    expect(t('de', 'dissolveGroup')).toBe('Klammer auflösen')
  })

  it('the three uniqueOnly fragments concatenate into the original German sentence', () => {
    expect(t('de', 'uniqueOnlyPrefix') + t('de', 'uniqueOnlyBold') + t('de', 'uniqueOnlySuffix'))
      .toBe('nur Rätsel mit einer Lösung')
  })

  it('English and Russian differ from German for every key (nothing left untranslated by accident)', () => {
    const keys = [
      'numbersLabel', 'opsLabel', 'targetLabel', 'hintLabel', 'anyBand',
      'uniqueOnlyPrefix', 'uniqueOnlyBold', 'uniqueOnlySuffix', 'uniqueOnlyUnavailable', 'dissolveGroup',
    ] as const
    for (const key of keys) {
      expect(t('en', key), `en.${key}`).not.toBe(t('de', key))
      expect(t('ru', key), `ru.${key}`).not.toBe(t('de', key))
    }
  })
})
