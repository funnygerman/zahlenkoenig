// The full game loop (concept 16, step 3: "vollständige Spielschleife").
// Owns settings (concept 15/section 11) and puzzle generation (concept
// 15.10's `nextPuzzle()`), renders the header/selection chip (concept
// 12.7) above the board, and replaces the puzzle 1200ms after a correct
// answer (concept 12.8). Board.tsx — everything this used to be, back
// when the puzzle was concept 12.5's own hardcoded worst case — now owns
// just one puzzle at a time; this is what feeds it a new one.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Header } from './Header'
import { HistoryNav } from './HistoryNav'
import { UpdateHint } from './UpdateHint'
import { Board, type BoardHandle } from './Board'
import { useSettings } from './useSettings'
import { useUpdateAvailable } from './useUpdateAvailable'
import { nextPuzzle, type Puzzle } from '../core/puzzles'
import { loadRecent, loadRecentShapes, saveRecent, saveRecentShapes, withPuzzle, withShape } from '../core/history'
import { loadSolved, saveSolved, withSolved, type SolvedPuzzle } from '../core/solvedHistory'
import { loadOnboardingStep, onboardingPuzzleAt, saveOnboardingStep } from '../core/onboarding'
import { readSharedPuzzle, type SharedPuzzle } from '../core/shareLink'
import { useShare } from './useShare'
import { Intro } from './Intro'
import { t } from '../core/i18n'
import './tokens.css'
import styles from './Game.module.css'

export function Game() {
  const { settings, setNumbers, toggleOp, setBand, setUniqueOnly } = useSettings()
  const { available: updateAvailable, update: onUpdate } = useUpdateAvailable()

  // `<html lang>` matters to a screen reader (it picks pronunciation from
  // it) independent of anything this app itself renders, and there's no
  // language switcher to leave this in the wrong state for long — it's set
  // once per detected/stored language, same as everything else in
  // `settings.language` (no menu, PO decision — see settings.ts's own note).
  useEffect(() => {
    document.documentElement.lang = settings.language
  }, [settings.language])

  // The last few puzzles played, so the generator can draw around them
  // (history.ts): without it an immediate repeat is just how a memoryless
  // draw behaves, and in a thin selection — two numbers, a narrow band —
  // it happens often enough to notice (PO). A ref, not state: nothing
  // renders it, and a draw needs the value at the moment it draws.
  const recentRef = useRef<string[] | null>(null)
  const shapesRef = useRef<string[] | null>(null)
  if (recentRef.current === null) recentRef.current = loadRecent() // lazily: a useRef *argument* is evaluated on every render, and this one reads storage
  if (shapesRef.current === null) shapesRef.current = loadRecentShapes()
  const [puzzle, setPuzzle] = useState<Puzzle>(() => nextPuzzle(settings, recentRef.current ?? [], shapesRef.current ?? []))
  const boardRef = useRef<BoardHandle>(null)
  // A fresh key per puzzle remounts Board — simpler and safer than trying
  // to reset useGame's own expression tree in place, since a stale tree
  // built from the *previous* puzzle's leaf ids would otherwise survive
  // the swap (its `numbers` prop changing doesn't imply its state should).
  const [puzzleKey, setPuzzleKey] = useState(0)
  // Board's own hint state, reported upward so the header icon (a sibling,
  // not a child) can mute itself once a press would do nothing — this
  // puzzle's hints are spent, or it is already correctly built — and hide
  // itself entirely on a puzzle that has no hints to give (two numbers, PO).
  const [hintState, setHintState] = useState({ offered: true, available: true })

  const draw = useCallback(() => {
    setPuzzle(nextPuzzle(settings, recentRef.current ?? [], shapesRef.current ?? []))
    setPuzzleKey(k => k + 1)
  }, [settings])

  // The solved-puzzle archive (footer/history round, core/solvedHistory.ts)
  // and where in it the player is currently browsing. `null` means "showing
  // the live puzzle" — the normal state; a number is an index into `solved`
  // (oldest first), set by HistoryNav's arrows below. Loaded with the same
  // "state, not a ref" choice history.ts's own windows deliberately don't
  // make: those never render anything, this drives whether the arrows are
  // enabled and what position they show.
  const [solved, setSolved] = useState<SolvedPuzzle[]>(() => loadSolved())
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const historyEntry = historyIndex !== null ? solved[historyIndex] : null

  // The first-run introduction (onboarding round, core/onboarding.ts): two
  // fixed puzzles shown before the generator is ever consulted, because a
  // player who has never seen the idea can't tell what the first screen
  // wants. `step` counts the ones already finished, so it is also the
  // index of the one to show now.
  //
  // Browsing the archive suspends onboarding rather than ending it: an
  // archived entry is a real replay of a real puzzle and has nothing to do
  // with the introduction, so it must not inherit the card, the hidden
  // selection chip or the nudge line. Solving one doesn't advance the step
  // either —
  // handleSolved's replay branch returns before reaching the onboarding
  // branch, the same way it already returns before the live one.
  const [onboardingStep, setOnboardingStep] = useState<number>(() => loadOnboardingStep())
  const onboardingPuzzle = historyIndex === null ? onboardingPuzzleAt(onboardingStep) : null

  // Which step's card the player has already dismissed. Deliberately *not*
  // persisted: a reload mid-onboarding shows the card again, which is the
  // recovery path for a card dismissed by accident before it was read —
  // the reason this round chose "until the puzzles are solved" over a
  // one-shot "seen" flag in the first place.
  const [introDismissedAt, setIntroDismissedAt] = useState<number | null>(null)
  const showIntro = onboardingPuzzle !== null && introDismissedAt !== onboardingStep

  // A puzzle somebody sent as a link (share round, core/shareLink.ts).
  // Read once, from the fragment this page was opened with — `null` for
  // every ordinary visit, and equally for a link that is damaged,
  // hand-edited or decodes to a board that cannot actually be solved, all
  // of which decodeSharedPuzzle refuses so that the failure is simply "an
  // ordinary game" rather than an error a player can do nothing about.
  //
  // It waits for onboarding rather than pre-empting it (PO). A first-time
  // player arriving on a friend's link is precisely the person the two
  // fixed lessons exist for: the board never states the one real rule, so
  // dropping them straight onto a four-number puzzle would hand them the
  // hardest first screen in the game. Somebody who has played before is
  // already past onboarding and sees the shared puzzle immediately.
  const [sharedPuzzle, setSharedPuzzle] = useState<SharedPuzzle | null>(() => readSharedPuzzle(window.location.hash))


  const handleHistoryBack = useCallback(() => {
    setHistoryIndex(i => (i === null ? solved.length - 1 : Math.max(0, i - 1)))
  }, [solved.length])

  const handleHistoryForward = useCallback(() => {
    // Already live: nothing "ahead" to go to (HistoryNav disables the
    // button in that case, but stay a no-op regardless). Otherwise step
    // toward the newest entry, and one step past it is back to live.
    setHistoryIndex(i => (i === null ? null : i < solved.length - 1 ? i + 1 : null))
  }, [solved.length])

  // Recorded when a puzzle is actually shown rather than when it is drawn:
  // StrictMode runs a state initializer twice in development, and this way
  // the history holds what the player saw either way (`withPuzzle` drops
  // an older sighting of the same puzzle, so running twice changes
  // nothing).
  useEffect(() => {
    recentRef.current = withPuzzle(recentRef.current ?? [], puzzle)
    saveRecent(recentRef.current)
    shapesRef.current = withShape(shapesRef.current ?? [], puzzle.pattern)
    saveRecentShapes(shapesRef.current)
  }, [puzzle])

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

  // Board's own onSolved (concept 12.8) fires once, 1200ms after a correct
  // answer, whichever puzzle it was given — Board.tsx doesn't know or care
  // whether that puzzle came from a fresh draw or the archive, so this is
  // the one place the two paths diverge. Browsing (historyEntry set): this
  // was a replay, and re-solving one keeps the player moving *through* the
  // archive rather than bouncing them out to live the moment they solve
  // whichever entry they happened to land on first — the same step
  // `handleHistoryForward`'s own arrow takes, all the way to the newest
  // entry, and only past that back to live. (First reported after browsing
  // all the way back to the oldest entry and solving it: landing on live —
  // "the newest one the player hasn't solved yet" — skipped over every
  // other already-solved entry in between, when stepping to the next one
  // in the archive is what continuing a review actually means.) Live (the
  // normal case): log the puzzle just solved and draw the next one, same
  // as before this round existed.
  const handleSolved = useCallback(() => {
    if (historyEntry) {
      handleHistoryForward()
      return
    }
    // An onboarding puzzle is archived like any other solved puzzle — it
    // genuinely was one, and browsing back to it later should work — but it
    // does *not* draw a replacement: the next board is the next onboarding
    // puzzle, or (once they run out) the live one already drawn at mount.
    // `ops` comes from the puzzle rather than from `settings.ops`, which
    // is the whole reason solvedHistory stores it per entry: an onboarding
    // board deliberately offers a narrower tray than the player's own
    // selection, and a replay has to match the solution it actually has.
    if (onboardingPuzzle) {
      setSolved(prev => {
        const next = withSolved(prev, { numbers: onboardingPuzzle.numbers, target: onboardingPuzzle.target, ops: onboardingPuzzle.ops })
        saveSolved(next)
        return next
      })
      const next = onboardingStep + 1
      setOnboardingStep(next)
      saveOnboardingStep(next)
      return
    }
    // A shared puzzle is archived like any other solved one — it genuinely
    // was one, and browsing back to it later should work — and, like an
    // onboarding puzzle, it draws no replacement: clearing it reveals the
    // live puzzle drawn at mount, which has been waiting behind it and was
    // never shown.
    if (sharedPuzzle) {
      setSolved(prev => {
        const next = withSolved(prev, sharedPuzzle)
        saveSolved(next)
        return next
      })
      setSharedPuzzle(null)
      return
    }
    setSolved(prev => {
      const next = withSolved(prev, { numbers: puzzle.numbers, target: puzzle.target, ops: settings.ops })
      saveSolved(next)
      return next
    })
    draw()
  }, [historyEntry, handleHistoryForward, onboardingPuzzle, onboardingStep, sharedPuzzle, puzzle, settings.ops, draw])

  // A fresh key whenever *what's displayed* changes identity — a new live
  // puzzle (puzzleKey, as before) or a different point in the archive —
  // so Board.tsx always remounts onto the puzzle it's now showing rather
  // than reusing a tree built around a different one's leaf ids.
  //
  // Browsing into the archive and back therefore starts the live puzzle
  // from an empty field: the key goes `live-N → hist-0 → live-N`, and React
  // unmounts on *any* key change, so the Board that comes back is a new
  // instance. This line used to claim the opposite — that the same key on
  // the way back kept Board's in-progress tree — and a browser QA pass
  // disproved it. **PO: not a bug.** Browsing away is a deliberate step out
  // of the puzzle, and coming back to a clean board is a fine thing for it
  // to mean. Keeping the tree would take leaving the live Board mounted
  // (hidden) beside the archived one instead of swapping keys; there is no
  // reason to.
  // Three sources now, in priority order: an archived entry being browsed,
  // an onboarding puzzle, or the live draw. Each gets its own key prefix so
  // Board remounts onto whichever it is showing — including on the step
  // from one onboarding puzzle to the next, which is a different puzzle
  // even though neither `puzzleKey` nor `historyIndex` moved.
  // Which of the four possible boards is on screen, decided **once**.
  //
  // There are now four sources — an archived entry being browsed, an
  // onboarding lesson, a puzzle that arrived on a link, and the live draw —
  // and everything downstream keys off the same answer: the remount key,
  // the board's own props, which operators the tray offers, whether the
  // selection chip can tell the truth, and whether the fragment may be
  // cleared. This used to be three separate expressions that each
  // re-stated the precedence, and they could disagree: a mutation test of
  // the onboarding-before-shared rule changed one of them and produced a
  // board showing the onboarding puzzle with the *shared* puzzle's tray
  // and remount key. One conditional, so that state cannot be expressed.
  //
  // `onboardingPuzzle` is already null while browsing, so the order below
  // is the whole of the precedence rule.
  const source = historyEntry
    ? { kind: 'history' as const, key: `hist-${historyIndex}`, puzzle: historyEntry, ops: historyEntry.ops }
    : onboardingPuzzle
      ? { kind: 'onboarding' as const, key: `onb-${onboardingStep}`, puzzle: onboardingPuzzle, ops: onboardingPuzzle.ops }
      : sharedPuzzle
        ? { kind: 'shared' as const, key: 'shared', puzzle: sharedPuzzle, ops: sharedPuzzle.ops }
        : { kind: 'live' as const, key: `live-${puzzleKey}`, puzzle, ops: settings.ops }

  const boardKey = source.key
  const displayed = source.puzzle
  const displayedOps = source.ops

  // Clear the fragment once the shared puzzle is actually *on screen*
  // (PO), not when the page loads — with onboarding ahead of it the link
  // has to survive both lessons, and a reload mid-onboarding has to find
  // it still there (the step is persisted, the fragment is the only record
  // of the puzzle). `replaceState` rather than assigning `location.hash`:
  // no reload, and no history entry for a Back button to land on.
  // Afterwards a reload draws an ordinary puzzle, which is the same thing
  // browsing away from a board already means here.
  const showingShared = source.kind === 'shared'
  useEffect(() => {
    if (!showingShared || !window.location.hash) return
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [showingShared])

  // What the share button sends is whatever is on the board — a live
  // puzzle, an archived one being browsed, or a puzzle that arrived on a
  // link and is being passed along. `displayedOps` rather than
  // `settings.ops` for the same reason solvedHistory.ts stores ops per
  // entry: the receiver's tray has to match the solution the shared board
  // actually has, which is not necessarily the sender's current selection.
  const { share, copied } = useShare({ numbers: displayed.numbers, target: displayed.target, ops: displayedOps }, settings.language)

  return (
    <div className={styles.page}>
      {/* The page's heading and its one-sentence description. Visually
          hidden (.srOnly) rather than absent: the board explains its own
          shape completely but never names the game or states the one real
          rule, so without this the rendered DOM has no heading at all —
          a gap a screen reader and a JavaScript-rendering crawler feel the
          same way. index.html's static fallback carries the same two facts
          for a crawler that does not run JavaScript.

          The sentences are `introGoal`/`introRule`, the onboarding card's
          own words, rather than two new i18n keys — they are already the
          shortest true statement of the rule in all three languages, and
          reusing them means there is only one place to change if the
          wording ever does. */}
      <h1 className={styles.srOnly}>Zahlenkönig</h1>
      <p className={styles.srOnly}>
        {t(settings.language, 'introGoal')} {t(settings.language, 'introRule')}
      </p>

      {/* Everything the game itself needs (concept 12.1) lives in its own
          flexible area, separate from the footer below — see .gameArea's
          own comment in Game.module.css for why: without this split, a
          viewport taller than the game (any desktop window) centers the
          footer along with the board as one block, landing it right under
          the board instead of down at the bottom of the page where a
          footer belongs. */}
      <div className={styles.gameArea}>
        {/* Hidden while the introduction is running: after the first
            onboarding puzzle the archive is no longer empty, so the arrows
            would appear mid-lesson and invite a detour out of the one
            thing there is to do — and browsing away empties the board
            (Board remounts on any key change, documented behaviour since
            the hint round). They come back with the first generated
            puzzle, which is also the first one worth browsing back to. */}
        {/* Concept 19.3's update hint, on its own centered row above the
            arrows (PO). It was in the header until the share round, and
            moved because the header row cannot hold a word-pill and an icon
            beside the widest selection chip — UpdateHint.tsx carries the
            measurement. It stays visible during onboarding, unchanged from
            when it sat in the header: a waiting service-worker update is
            not part of the puzzle and shouldn't wait for the introduction
            to finish. */}
        <UpdateHint available={updateAvailable} onUpdate={onUpdate} language={settings.language} />
        <HistoryNav
          index={historyIndex}
          total={source.kind === 'onboarding' ? 0 : solved.length}
          onBack={handleHistoryBack}
          onForward={handleHistoryForward}
          backLabel={t(settings.language, 'historyBackLabel')}
          forwardLabel={t(settings.language, 'historyForwardLabel')}
        />
        <Header
          settings={settings}
          onSetNumbers={setNumbers}
          onToggleOp={toggleOp}
          onSetBand={setBand}
          onSetUniqueOnly={setUniqueOnly}
          onPressHint={() => boardRef.current?.pressHint()}
          hintHidden={!hintState.offered}
          hintMuted={!hintState.available}
          selectionHidden={source.kind === 'onboarding' || source.kind === 'shared'}
          onShare={share}
          shareCopied={copied}
          shareHidden={source.kind === 'onboarding'}
        />
        <Board
          ref={boardRef}
          key={boardKey}
          numbers={displayed.numbers}
          target={displayed.target}
          ops={displayedOps}
          language={settings.language}
          onSolved={handleSolved}
          onHintState={setHintState}
          nudge={source.kind === 'onboarding' ? t(settings.language, 'nudgeTapNumber') : undefined}
        />
      </div>

      {/* footer/history round (PO): attribution only, no rules/legal
          content asked for. `footerCoffee` is the one link on the page —
          the PO's own ko-fi page, given directly rather than guessed —
          `rel="noopener noreferrer"` since it's an external target=_blank
          link; "made with ❤️ and Claude" stays plain text regardless. */}
      <footer className={styles.footer}>
        <span>{t(settings.language, 'footerMade')}</span>
        <a href="https://ko-fi.com/funnygerman" target="_blank" rel="noopener noreferrer" className={styles.footerCoffee}>
          {t(settings.language, 'footerCoffee')}
        </a>
      </footer>

      {/* Last in the tree, so it paints over the board and the header's own
          panel without either needing to know it exists. */}
      {showIntro && (
        <Intro step={onboardingStep} language={settings.language} onDismiss={() => setIntroDismissedAt(onboardingStep)} />
      )}
    </div>
  )
}
