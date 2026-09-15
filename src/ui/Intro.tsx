// The first-run introduction card (onboarding round). One card per
// onboarding puzzle (core/onboarding.ts), shown over the board before that
// puzzle is played and dismissed with one button.
//
// Why a card at all, in a game whose whole design argues against words
// (concept 6.4: "für Erstklässler die ganze Anleitung, ohne Worte"): the
// board is genuinely self-explanatory about *shape* — the scaffold shows
// how many chips go where, the target chip shows what to hit, the greyed
// `=` shows when something is missing — and says nothing at all about the
// one actual rule, that every number must be used exactly once. A player
// who has never seen the idea reads `4 6 7 → 14` as "make 14 somehow".
// That sentence is what this card exists to deliver; everything else on it
// is there to get it read.
//
// Three cards rather than one, because they teach different things at
// different moments:
//
//   step 0 — goal, rule, gesture. Over a two-number board where tapping is
//            the whole vocabulary.
//   step 1 — the bracket, at its two-number minimum. One new chip and no
//            new gesture: everything on this card is still a tap.
//   step 2 — growing one. A three-number group is drag-only (concept 6.2),
//            which makes it the one capability in the game that cannot be
//            discovered by trying things: tap can't produce it, and the
//            hint proposes it only as a drag it never has the budget to
//            reach. Scripted instruction is the only honest way to teach
//            it, which is exactly what this card is.
//
// Steps 1 and 2 used to be one card over one board, and a player report is
// why they aren't: the block arrived as two lessons at once — a chip
// nobody had seen, and the game's only drag-only gesture — in the same
// puzzle. Splitting them costs one board and leaves each card with one new
// thing on it.

import { useEffect, useRef } from 'react'
import { Chip } from './Chip'
import { t, type Language } from '../core/i18n'
import styles from './Intro.module.css'

export interface IntroProps {
  /** Which onboarding puzzle this card introduces — an index into core/onboarding.ts's ONBOARDING_PUZZLES. */
  step: number
  language: Language
  onDismiss: () => void
}

export function Intro({ step, language, onDismiss }: IntroProps) {
  const startRef = useRef<HTMLButtonElement>(null)

  // The card is the only thing on screen worth acting on while it's up, so
  // it takes focus on mount: a keyboard or screen-reader user lands on the
  // button that dismisses it rather than having to hunt for it, and Enter
  // works immediately. This is also the one focus move in the app — the
  // board's own chips are deliberately out of tab order (CLAUDE.md's
  // Tastaturbedienung decision), so there is nothing here to restore focus
  // *to* afterwards.
  useEffect(() => { startRef.current?.focus() }, [step])

  // Escape dismisses, matching the selection panel's own behaviour
  // (Header.tsx) — a player who has already worked out what to do
  // shouldn't have to aim at a button to get the board back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" onClick={onDismiss}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <ul className={styles.lines}>
          {step === 0 ? (
            <>
              <li className={styles.line}>{t(language, 'introGoal')}</li>
              <li className={`${styles.line} ${styles.rule}`}>{t(language, 'introRule')}</li>
              <li className={styles.line}>{t(language, 'introHow')}</li>
            </>
          ) : (
            <>
              {/* Both bracket cards open with what is new about their own
                  board, then point at the chip, then name the one gesture
                  that gets the numbers in. The middle line is shared
                  deliberately: it is the same tap on both boards, and a
                  player who has to find that chip twice should be told
                  where it is twice. */}
              <li className={styles.line}>{t(language, step === 1 ? 'introBracketLead' : 'introGrowLead')}</li>
              <li className={styles.line}>
                {/* A real block chip, not a description of one: the player
                    has to recognise this exact shape in the tray a second
                    later. `tabIndex={-1}` and `aria-hidden` keep it out of
                    both tab order and the reading order — it's an
                    illustration of the sentence beside it, and the button
                    that matters here is the one below. */}
                <Chip variant="block" scale="tray" className={styles.icon} tabIndex={-1} aria-hidden="true" />
                {t(language, 'introBracketOpen')}
              </li>
              <li className={styles.line}>{t(language, step === 1 ? 'introBracketFill' : 'introBracketGrow')}</li>
            </>
          )}
        </ul>
        <button ref={startRef} type="button" className={styles.start} onClick={onDismiss}>
          {t(language, 'introStart')}
        </button>
      </div>
    </div>
  )
}
