// The whole of v2's i18n surface (concept 12.7's "Menü (Sprache, Regeln)" —
// minus the menu itself and minus "Regeln", neither in scope here). v1 had
// its own hand-rolled system (`src/i18n/`, deleted in step 5 along with the
// rest of v1) with nested dotted keys, `{{param}}` interpolation and a
// module-singleton + listener-Set for React updates — none of that fits or
// is needed here. v2's whole translatable surface is eight short strings
// (Header.tsx's four panel labels, the uniqueOnly checkbox's three-part
// sentence, the "beliebig" band label, and Expression.tsx's "Klammer
// auflösen" aria-label, used twice) — a flat key/value map and a plain
// lookup function is all this needs. No interpolation, no pluralization:
// grepping the whole UI tree found no locale-sensitive number formatting
// either (numbers are small integers, rendered with plain `String()`) and
// none of these keys take a parameter. `updateHint` (step 6, concept 19.3)
// is the ninth: the service worker's own "a new version is ready" nudge,
// concept 19.3's own word for it ("Aktualisieren").
//
// No language switcher is built (PO decision): the player's language is
// detected once, from the browser, and that's it — see settings.ts's
// `detectLanguage()`. Math notation itself (×, ÷, −) is locale-invariant
// and never goes through this file — see notation.ts/expression.ts's own
// `operatorGlyph`.

export type Language = 'de' | 'en' | 'ru'

export const LANGUAGES: readonly Language[] = ['de', 'en', 'ru']

interface Strings {
  /** Header.tsx's "wie viele Zahlen" panel row label. */
  numbersLabel: string
  /** Header.tsx's "welche Rechenzeichen" panel row label. */
  opsLabel: string
  /** Header.tsx's "wie groß das Ziel" panel row label. */
  targetLabel: string
  /** The hint button's aria-label (concept 10.3). */
  hintLabel: string
  /** The band label for a selection with only one band (puzzles.ts's BandRow) — "beliebig". */
  anyBand: string
  /**
   * The uniqueOnly checkbox's sentence, split around the one word concept
   * 15.6's own copy bolds ("nur Rätsel mit **einer** Lösung") — three
   * fragments rather than one string, so the emphasis survives translation
   * without HTML-in-a-string tricks.
   */
  uniqueOnlyPrefix: string
  uniqueOnlyBold: string
  uniqueOnlySuffix: string
  /** Appended when the current selection has no unique-solution puzzles (concept 15.6/15.7). */
  uniqueOnlyUnavailable: string
  /** Expression.tsx's bracket-edge aria-label (concept 6.5/6.6) — same text on both edges. */
  dissolveGroup: string
  /** The service-worker-update hint (concept 19.3: "ein knapper Hinweis... statt eines Popup-Dialogs"). */
  updateHint: string
  /** HistoryNav.tsx's back arrow (footer/history round) — steps into the archive of already-solved puzzles. */
  historyBackLabel: string
  /** HistoryNav.tsx's forward arrow — steps toward the live puzzle again. */
  historyForwardLabel: string
  /** The page footer's attribution line. */
  footerMade: string
  /** The page footer's second line — no link exists yet (PO, footer/history round), so this renders as plain text; see Game.tsx's own note on where a real link would go. */
  footerCoffee: string
}

const de: Strings = {
  numbersLabel: 'Wie viele Zahlen',
  opsLabel: 'Welche Rechenzeichen',
  targetLabel: 'Wie groß das Ziel',
  hintLabel: 'Tipp',
  anyBand: 'beliebig',
  uniqueOnlyPrefix: 'nur Rätsel mit ',
  uniqueOnlyBold: 'einer',
  uniqueOnlySuffix: ' Lösung',
  uniqueOnlyUnavailable: ' (für diese Auswahl nicht verfügbar)',
  dissolveGroup: 'Klammer auflösen',
  updateHint: 'Aktualisieren',
  historyBackLabel: 'Vorheriges gelöstes Rätsel',
  historyForwardLabel: 'Nächstes Rätsel',
  footerMade: 'Mit ❤️ und Claude gemacht',
  footerCoffee: 'Kaffee spendieren ☕',
}

const en: Strings = {
  numbersLabel: 'How many numbers',
  opsLabel: 'Which operators',
  targetLabel: 'How big the target',
  hintLabel: 'Hint',
  anyBand: 'any',
  uniqueOnlyPrefix: 'only puzzles with ',
  uniqueOnlyBold: 'one',
  uniqueOnlySuffix: ' solution',
  uniqueOnlyUnavailable: ' (not available for this selection)',
  dissolveGroup: 'Dissolve bracket',
  updateHint: 'Update',
  historyBackLabel: 'Previous solved puzzle',
  historyForwardLabel: 'Next puzzle',
  footerMade: 'Made with ❤️ and Claude',
  footerCoffee: 'Buy me a coffee ☕',
}

const ru: Strings = {
  numbersLabel: 'Сколько чисел',
  opsLabel: 'Какие знаки',
  targetLabel: 'Размер цели',
  hintLabel: 'Подсказка',
  anyBand: 'любая',
  uniqueOnlyPrefix: 'только задачи с ',
  uniqueOnlyBold: 'единственным',
  uniqueOnlySuffix: ' решением',
  uniqueOnlyUnavailable: ' (недоступно для этого выбора)',
  dissolveGroup: 'Убрать скобки',
  updateHint: 'Обновить',
  historyBackLabel: 'Предыдущая решённая задача',
  historyForwardLabel: 'Следующая задача',
  footerMade: 'Сделано с ❤️ и Claude',
  footerCoffee: 'Угостить кофе ☕',
}

// `Record<Language, Strings>` is what gives every language compile-time key
// parity — TS refuses to build if `ru` (say) is missing a key `de` has,
// which is the one part of v1's old system worth keeping.
const STRINGS: Record<Language, Strings> = { de, en, ru }

export function t<K extends keyof Strings>(language: Language, key: K): Strings[K] {
  return STRINGS[language][key]
}
