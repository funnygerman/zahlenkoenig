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
   * Three cards, one per onboarding puzzle: the first names the goal, the
   * rule and the gesture; the second opens a bracket at its two-number
   * minimum, all of it by tapping; the third grows one to three numbers,
   * which is drag-only and which nothing else on screen says at all.
   *
   * The second card exists because a player report said the block lesson
   * arrived all at once — see core/onboarding.ts's own note on the puzzle
   * it introduces.
   */
  introGoal: string
  introRule: string
  introHow: string
  introStart: string
  introBracketLead: string
  /** Rendered beside a real block chip, so the sentence never has to name the symbol in words — on both bracket cards, since both start with that tap. */
  introBracketOpen: string
  /**
   * The second card's last line. It used to read "then tap the numbers
   * into it", which the guidance now says live, move by move — so the line
   * says the thing the board actually teaches that nothing else states:
   * a bracket that lands in the wrong place is moved, not undone. It also
   * prepares the scripted mistake, so that the red frame arriving a moment
   * later reads as the promised lesson rather than as a failure.
   */
  introBracketMove: string
  /** The third card's first line — what has changed since the second card, which is the only thing it teaches. */
  introGrowLead: string
  introBracketGrow: string
  /**
   * The first-run introduction's step-by-step guidance (Board's `guided`
   * prop): one line per kind of move, naming the gesture while the chip
   * itself is marked on screen.
   *
   * Split by kind rather than written as one generic "do the next thing"
   * because the kinds are not the same gesture — three of them are a tap
   * and one is a drag, which is the whole difficulty the third onboarding
   * board exists for. `guideBlock` names what the chip *does*, since it is
   * the one chip whose symbol a beginner cannot read.
   */
  guideNumber: string
  guideOperator: string
  guideBlock: string
  /** The same chip, dragged: where the player has already built around the spot the bracket has to go, a tap would land it somewhere else (ui/guidance.ts's own account). */
  guideBlockDrag: string
  guideGrow: string
  guideSubmit: string
  /**
   * The three recovery lines — what to do on a board that can no longer
   * reach the target. They are the guidance's answer to a state it used to
   * meet in silence, and the only lines that talk about a chip already on
   * the board.
   *
   * `guideMoveBlock` names the dead-end frame before naming the gesture,
   * and it is the one line here allowed two sentences: it is the first one
   * a player ever sees (the second onboarding board puts it there on
   * purpose), and a warning nobody explains reads as decoration.
   *
   * It says *orange* rather than red, because that is what `--zk-amber`
   * is — `--zk-red` is the wrong-answer verdict, a different signal
   * entirely. Naming the frame as well ("der orange Rahmen") was measured
   * and cut: it runs to three lines in German and English in landscape,
   * against the guidance round's own two-line budget, and the colour word
   * is a bonus rather than the instruction — the sentence's second half
   * points at a marked chip and a marked spot, which is what a player who
   * cannot tell the colours apart follows anyway.
   */
  guideMoveBlock: string
  guideDissolve: string
  guideUndo: string
  /**
   * The last introduction card's closing aside, rendered beside a real
   * hint icon the way `introBracketOpen` is rendered beside a real block
   * chip. An aside rather than a fourth teaching line: the three lines
   * above are about the board in front of the player, and this one is
   * about every board after it.
   */
  introHint: string
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
  /**
   * Why the selection chip is muted (share round, PO). Shown on tapping it
   * while the board is not the player's own live puzzle — a shared link or a
   * replay out of the archive, both of which carry their own numbers and
   * operators and cannot follow a selection change.
   *
   * Phrased as what the selection *does* rather than as what the player may
   * not do: it is true of both cases without naming either, and it says where
   * a change would land instead of just refusing one.
   */
  selectionLocked: string
  /**
   * Why the hint button is muted (hint round follow-up, PO). Shown on
   * tapping it, the same shape as `selectionLocked` — a `disabled` button
   * gives no feedback at all, which real-device reports read as "hinting
   * is hanging" rather than as a deliberate stop. Two distinct reasons,
   * because they are different facts: `hintSpent` is the budget, and
   * `hintComplete` is "there is nothing left to suggest" (the board is
   * already correct). The old third reason — "the puzzle's last two chips
   * are always yours" — is gone with the rule that produced it: it turned
   * out to be the more common trigger of the two, since it muted the icon
   * with budget still unspent on any puzzle a player mostly built by hand.
   */
  hintSpent: string
  hintComplete: string
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
  selectionLocked: 'Die Auswahl gilt nur für neue Rätsel',
  hintSpent: 'Keine Tipps mehr für dieses Rätsel',
  hintComplete: 'Nichts mehr zu tippen',
  introGoal: 'Erreiche die Zahl im blauen Feld.',
  introRule: 'Benutze jede Zahl genau einmal.',
  introHow: 'Tippe auf eine Zahl, dann auf ein Rechenzeichen.',
  introStart: 'Los geht’s',
  introBracketLead: 'Dieses Rätsel braucht eine Klammer.',
  introBracketOpen: 'Tippe hierauf, um eine zu öffnen.',
  introBracketMove: 'Und wenn sie falsch sitzt, kannst du sie verschieben.',
  introGrowLead: 'Diesmal gehören drei Zahlen in die Klammer.',
  introBracketGrow: 'Zieh eine Zahl auf den Klammerrand, damit sie hineinkommt.',
  guideNumber: 'Tippe auf die leuchtende Zahl.',
  guideOperator: 'Tippe auf das leuchtende Rechenzeichen.',
  guideBlock: 'Tippe auf den leuchtenden Chip — er öffnet eine Klammer.',
  guideBlockDrag: 'Zieh den leuchtenden Chip auf die markierte Stelle — er öffnet dort eine Klammer.',
  guideGrow: 'Zieh die leuchtende Zahl auf den leuchtenden Klammerrand.',
  guideSubmit: 'Tippe auf das leuchtende =.',
  guideMoveBlock: 'Orange heißt: so geht es nicht auf. Zieh die Klammer auf die markierte Stelle.',
  guideDissolve: 'Tippe auf den markierten Klammerrand — die Klammer geht wieder weg.',
  guideUndo: 'Tippe auf den markierten Chip — er geht zurück in die Ablage.',
  introHint: 'Steckst du fest, hilft dir das hier weiter.',
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
  selectionLocked: 'Settings apply to new puzzles only',
  hintSpent: 'No hints left for this puzzle',
  hintComplete: 'Nothing left to hint',
  introGoal: 'Reach the number in the blue field.',
  introRule: 'Use every number exactly once.',
  introHow: 'Tap a number, then an operator.',
  introStart: 'Let’s go',
  introBracketLead: 'This puzzle needs a bracket.',
  introBracketOpen: 'Tap this to open one.',
  introBracketMove: 'And if it lands in the wrong place, you can move it.',
  introGrowLead: 'This time three numbers go inside the bracket.',
  introBracketGrow: 'Drag a number onto the bracket edge to put it inside.',
  guideNumber: 'Tap the glowing number.',
  guideOperator: 'Tap the glowing operator.',
  guideBlock: 'Tap the glowing chip — it opens a bracket.',
  guideBlockDrag: 'Drag the glowing chip onto the marked spot — it opens a bracket there.',
  guideGrow: 'Drag the glowing number onto the glowing bracket edge.',
  guideSubmit: 'Tap the glowing =.',
  guideMoveBlock: 'Orange means it can’t reach the target. Drag the bracket onto the marked spot.',
  guideDissolve: 'Tap the marked bracket edge — the bracket goes away again.',
  guideUndo: 'Tap the marked chip — it goes back to the tray.',
  introHint: 'Stuck on a puzzle? This one helps you on.',
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
  selectionLocked: 'Настройки действуют только для новых задач',
  hintSpent: 'Подсказки для этой задачи закончились',
  hintComplete: 'Больше нечего подсказывать',
  introGoal: 'Получи число в синем поле.',
  introRule: 'Используй каждое число ровно один раз.',
  introHow: 'Нажми на число, потом на знак.',
  introStart: 'Поехали',
  introBracketLead: 'Здесь нужны скобки.',
  introBracketOpen: 'Нажми сюда, чтобы открыть их.',
  introBracketMove: 'А если они встанут не туда, их можно передвинуть.',
  introGrowLead: 'В этот раз в скобках будут три числа.',
  introBracketGrow: 'Перетащи число на край скобки, чтобы оно оказалось внутри.',
  guideNumber: 'Нажми на светящееся число.',
  guideOperator: 'Нажми на светящийся знак.',
  guideBlock: 'Нажми на светящийся чип — он открывает скобки.',
  guideBlockDrag: 'Перетащи светящийся чип на отмеченное место — там откроются скобки.',
  guideGrow: 'Перетащи светящееся число на светящийся край скобки.',
  guideSubmit: 'Нажми на светящееся =.',
  guideMoveBlock: 'Оранжевая рамка: так не выйдет. Перетащи скобки на отмеченное место.',
  guideDissolve: 'Нажми на отмеченный край скобки — скобки уберутся.',
  guideUndo: 'Нажми на отмеченный чип — он вернётся в лоток.',
  introHint: 'Застрял? Вот это поможет.',
}

// `Record<Language, Strings>` is what gives every language compile-time key
// parity — TS refuses to build if `ru` (say) is missing a key `de` has,
// which is the one part of v1's old system worth keeping.
const STRINGS: Record<Language, Strings> = { de, en, ru }

export function t<K extends keyof Strings>(language: Language, key: K): Strings[K] {
  return STRINGS[language][key]
}
