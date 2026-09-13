// The whole of v2's i18n surface (concept 12.7's "Menü (Sprache, Regeln)" —
// minus the menu itself and minus "Regeln", neither in scope here). v1 had
// its own hand-rolled system (`src/i18n/`, deleted in step 5 along with the
// rest of v1) with nested dotted keys, `{{param}}` interpolation and a
// module-singleton + listener-Set for React updates — none of that fits or
// is needed here. v2's translatable surface started as eight short strings
// (Header.tsx's four panel labels, the uniqueOnly checkbox's three-part
// sentence, the "beliebig" band label, and Expression.tsx's "Klammer
// auflösen" aria-label, used twice) — a flat key/value map and a plain
// lookup function is all this needs, and still is. No interpolation, no
// pluralization: grepping the whole UI tree found no locale-sensitive
// number formatting either (numbers are small integers, rendered with
// plain `String()`) and none of these keys take a parameter. `updateHint`
// (step 6, concept 19.3) came next: the service worker's own "a new
// version is ready" nudge, concept 19.3's own word for it
// ("Aktualisieren"). The footer/history round added four more, and the
// onboarding round eight — the first *sentences* in the app rather than
// labels, and the one place where the wording is the feature.
//
// The onboarding strings are the reason to keep resisting HTML-in-a-string:
// `introBracketOpen` has to point at the block chip, and it does it by
// being rendered *beside a real one* (Intro.tsx) rather than by naming the
// symbol or embedding markup — the same trick the uniqueOnly sentence uses
// for its bolded word, which is split into three plain fragments instead.
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
  /**
   * The first-run introduction (onboarding round, core/onboarding.ts).
   * Two cards, one per onboarding puzzle: the first names the goal, the
   * rule and the gesture; the second teaches the block, because a
   * three-number group is drag-only and nothing else on screen says so.
   */
  introGoal: string
  introRule: string
  introHow: string
  introStart: string
  introBracketLead: string
  /** Rendered beside a real block chip, so the sentence never has to name the symbol in words. */
  introBracketOpen: string
  introBracketGrow: string
  /** Board.tsx's nudge in the otherwise-empty notation line, while onboarding and the field is untouched. */
  nudgeTapNumber: string
  /** The page footer's second line — the label of a link to the PO's ko-fi page (footer/history round; the URL itself lives in Game.tsx, not here). */
  footerCoffee: string
  /**
   * Sharing the board in front of the player as a link (share round).
   *
   * `sharePrompt` is the only translated part of the shared message: the
   * puzzle itself travels as bare digits (`6 2 9 3 → 48`), the same
   * reasoning HistoryNav's own "2/8" position indicator already follows —
   * digits read the same to a first-grader as to an adult and need no
   * i18n. That is also what keeps this file free of its first
   * parameterized string.
   */
  shareLabel: string
  sharePrompt: string
  /** Shown briefly where the platform has no share sheet and the link went to the clipboard instead. */
  shareCopied: string
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
  footerCoffee: 'Auf einen Kaffee einladen ☕',
  shareLabel: 'Rätsel teilen',
  sharePrompt: 'Schaffst du das?',
  shareCopied: 'Link kopiert',
  introGoal: 'Erreiche die Zahl im blauen Feld.',
  introRule: 'Benutze jede Zahl genau einmal.',
  introHow: 'Tippe auf eine Zahl, dann auf ein Rechenzeichen.',
  introStart: 'Los geht’s',
  introBracketLead: 'Dieses Rätsel braucht eine Klammer.',
  introBracketOpen: 'Tippe hierauf, um eine zu öffnen.',
  introBracketGrow: 'Zieh eine Zahl auf den Klammerrand, damit sie hineinkommt.',
  nudgeTapNumber: 'Tippe auf eine Zahl',
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
  shareLabel: 'Share this puzzle',
  sharePrompt: 'Can you solve it?',
  shareCopied: 'Link copied',
  introGoal: 'Reach the number in the blue field.',
  introRule: 'Use every number exactly once.',
  introHow: 'Tap a number, then an operator.',
  introStart: 'Let’s go',
  introBracketLead: 'This puzzle needs a bracket.',
  introBracketOpen: 'Tap this to open one.',
  introBracketGrow: 'Drag a number onto the bracket edge to put it inside.',
  nudgeTapNumber: 'Tap a number',
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
  shareLabel: 'Поделиться задачей',
  sharePrompt: 'А ты сможешь?',
  shareCopied: 'Ссылка скопирована',
  introGoal: 'Получи число в синем поле.',
  introRule: 'Используй каждое число ровно один раз.',
  introHow: 'Нажми на число, потом на знак.',
  introStart: 'Поехали',
  introBracketLead: 'Здесь нужны скобки.',
  introBracketOpen: 'Нажми сюда, чтобы открыть их.',
  introBracketGrow: 'Перетащи число на край скобки, чтобы оно оказалось внутри.',
  nudgeTapNumber: 'Нажми на число',
}

// `Record<Language, Strings>` is what gives every language compile-time key
// parity — TS refuses to build if `ru` (say) is missing a key `de` has,
// which is the one part of v1's old system worth keeping.
const STRINGS: Record<Language, Strings> = { de, en, ru }

export function t<K extends keyof Strings>(language: Language, key: K): Strings[K] {
  return STRINGS[language][key]
}
