// The header (concept 12.7): the selection chip, centered, that both shows
// and changes the current selection — "das anzeigende Element ist das
// ändernde" — plus, as of step 4, the hint icon on the right (concept
// 10.3). Concept 12.7 also puts a menu icon on the left, but that belongs
// to language/rules, and the PO has since closed both halves: the language
// is detected once with no switcher (settings.ts), and the onboarding round
// chose a first-run card over a permanent rules button. So the left slot
// stays unbuilt on purpose, and hosts only concept 19.3's update pill.
//
// The chip itself is hidden while an onboarding puzzle is on the board
// (`selectionHidden`) — see that prop's own note.
//
// The panel it opens is concept 15.6's selection UI — three rows the
// player can change independently, plus the uniqueOnly switch — laid over
// the board rather than a separate screen. It stays open across changes
// and only closes on an outside tap or Escape (concept 15.6's own rules).

import { useEffect, useRef, useState } from 'react'
import type { Settings } from '../core/settings'
import { bandRanges, uniqueOnlyAvailable } from '../core/puzzles'
import { operatorGlyph, type Operator } from '../core/expression'
import { t } from '../core/i18n'
import styles from './Header.module.css'

const ALL_OPS: Operator[] = ['+', '-', '*', '/']
/**
 * Band names (target-ranges-display round, PO decision, puzzles.ts's
 * BandRow): a single band spanning the selection's whole range gets its
 * own single translated label (`anyBand`, "beliebig"/"any"/"любая") —
 * calling it "klein" would be a lie. A × selection's fixed cut points are
 * positional (M, then L, then XL, then XXL if there is one) rather than
 * looked up by how many bands a selection has, and stay untranslated —
 * they're language-neutral size shorthand, not German words: 4 numbers get
 * all four (1–50/51–100/101–250/251–max), 3 numbers stop at XL
 * (101–150 — no XXL, negative-result-display round's follow-up: measured,
 * everything a 3-number pool holds above 150 is nearly pure-× and not
 * worth a band). `ranges.length` is 1, 3 or 4 in practice; indexing
 * `MULT_BAND_LABELS` directly by position handles 3 and 4 alike with no
 * separate entry needed for 3.
 */
const MULT_BAND_LABELS = ['M', 'L', 'XL', 'XXL']
function bandLabels(language: Settings['language']): Record<number, string[]> {
  return { 1: [t(language, 'anyBand')] }
}
const NUMBER_OPTIONS: Settings['numbers'][] = [2, 3, 4]

export interface HeaderProps {
  settings: Settings
  onSetNumbers: (numbers: Settings['numbers']) => void
  onToggleOp: (op: Operator) => void
  onSetBand: (band: Settings['band']) => void
  onSetUniqueOnly: (uniqueOnly: boolean) => void
  /** concept 10.3: one button, the same on every press — see Board.tsx's useHint for what a press actually does. */
  onPressHint: () => void
  /**
   * Whether a press would do nothing at all, in which case the button says
   * so rather than looking live (the hint round's own report was "sometimes
   * clicking hint does nothing"). `disabled`, not merely dimmed like the
   * tray's spent operator chips: those stay droppable targets for a drag,
   * and this is a plain button with nothing but its click — the same reason
   * the `=` chip is genuinely disabled, and rejoins the tab order the
   * moment it isn't.
   */
  hintMuted?: boolean
  /**
   * Whether this puzzle gives no hints at all — two numbers (PO), where
   * three chips is the whole board. The icon is left out entirely rather
   * than shown permanently dead, the same call `HistoryNav` makes about
   * rendering nothing until there is something to browse.
   */
  hintHidden?: boolean
  /**
   * Concept 19.3's update surface — "ein knapper Hinweis in der
   * Kopfzeile... statt eines Popup-Dialogs". Optional: `Game.tsx` always
   * passes both (from `useUpdateAvailable`), but nothing here requires a
   * service worker to exist, which keeps `Game.test.tsx`/`Game.loop.test.tsx`
   * free of PWA-registration concerns they were never about.
   */
  updateAvailable?: boolean
  onUpdate?: () => void
  /**
   * Hide the selection chip entirely (onboarding round). An onboarding
   * board is fixed — its numbers and its deliberately narrow tray come
   * from core/onboarding.ts, not from `settings` — so the chip would be
   * displaying a selection that is not what is on screen (three numbers
   * and four operators over a two-number, one-operator board), and, worse,
   * changing it would visibly do nothing. Concept 12.7 calls the chip
   * "zugleich Anzeige und Bedienelement"; while neither half is true it
   * should not be there at all.
   *
   * The update pill keeps its own slot regardless: a waiting service-worker
   * update is not part of the puzzle and shouldn't wait for onboarding to
   * finish.
   */
  selectionHidden?: boolean
}

/**
 * concept 13.2: inline SVG, never emoji.
 *
 * A lightbulb, not the circled question mark this used to be (onboarding
 * round). The old icon was `?` in a ring — which is the universal glyph
 * for *help* — so a first-time player looking for "what do I do here?"
 * tapped the one thing on screen that looked like an explanation and got a
 * chip silently placed on their board instead, one hint poorer. A bulb is
 * what "hint" means everywhere, and it is what v1's own copy already said
 * ("Tippe auf 💡 wenn du nicht weiterkommst") — as an inline SVG stroke
 * symbol here, since concept 13.2 rules out the emoji.
 *
 * With this, no `?` remains anywhere in the app, which is the other half of
 * the fix: there is now nothing that promises help and doesn't give it.
 */
function HintIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.9a5.75 5.75 0 0 0-3.4 10.4c.6.45.95 1.15.95 1.9v.25h4.9v-.25c0-.75.35-1.45.95-1.9A5.75 5.75 0 0 0 12 2.9Z" />
      <path d="M9.55 18.4h4.9" />
      <path d="M10.6 21h2.8" />
    </svg>
  )
}

/**
 * The selection chip's "this is a button" mark (onboarding round). Reported
 * by the PO from the same first-time feedback as the rest of this round:
 * the chip is a flat filled pill showing the current selection, and it
 * reads as a status badge rather than as the control that changes it —
 * which matters more than it looks, because it is also the only route to
 * "two numbers, only +", the selection that makes the game legible to a
 * beginner. A chevron is the cheapest fix that needs no translation and no
 * extra width worth measuring (the chip sits at ~128px inside a ~367px
 * header).
 */
function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9.5 12 15.5l6-6" />
    </svg>
  )
}

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function Header({ settings, onSetNumbers, onToggleOp, onSetBand, onSetUniqueOnly, onPressHint, hintMuted = false, hintHidden = false, updateAvailable = false, onUpdate, selectionHidden = false }: HeaderProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Concept 15.6: "Geschlossen wird durch Tippen daneben oder Esc" — never
  // by a change inside it, which is why this isn't just onBlur on the panel.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  const ranges = bandRanges(settings.numbers, settings.ops)
  const [lo, hi] = ranges[settings.band]
  const uniqueAvailable = uniqueOnlyAvailable(settings.numbers, settings.ops)
  const bandLabelsForLanguage = bandLabels(settings.language)

  return (
    <div className={styles.header} ref={rootRef}>
      {updateAvailable && (
        // Concept 12.7's left slot — reserved for a menu icon no step has
        // built (Header.tsx's own top comment) — hosts this instead,
        // conditionally: not a menu, just concept 19.3's "knapper Hinweis"
        // taking the one empty spot the layout already had.
        <button type="button" className={styles.updateHint} onClick={onUpdate}>
          {t(settings.language, 'updateHint')}
        </button>
      )}

      {!selectionHidden && (
      <button
        type="button"
        className={styles.chip}
        aria-expanded={open}
        aria-controls="zk-selection-panel"
        onClick={() => setOpen(o => !o)}
      >
        <span className={styles.mini}>
          {Array.from({ length: settings.numbers }, (_, i) => <i key={i} className={styles.square} />)}
        </span>
        <span className={styles.mini}>
          {settings.ops.map(op => <i key={op} className={styles.circle} />)}
        </span>
        <span className={styles.range}>{lo}–{hi}</span>
        <span className={styles.chevron}><ChevronIcon /></span>
      </button>
      )}

      {!hintHidden && (
        <button type="button" className={styles.hintButton} onClick={onPressHint} disabled={hintMuted} aria-label={t(settings.language, 'hintLabel')}>
          <HintIcon />
        </button>
      )}

      {open && (
        <div className={styles.backdrop} onClick={() => setOpen(false)}>
          <div
            id="zk-selection-panel"
            className={styles.panel}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.row}>
              <span className={styles.label}>{t(settings.language, 'numbersLabel')}</span>
              <div className={styles.options}>
                {NUMBER_OPTIONS.map(n => (
                  <button
                    key={n}
                    type="button"
                    className={styles.opt}
                    aria-pressed={settings.numbers === n}
                    onClick={() => onSetNumbers(n)}
                  >
                    {Array.from({ length: n }, (_, i) => <i key={i} className={styles.sq} />)}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.row}>
              <span className={styles.label}>{t(settings.language, 'opsLabel')}</span>
              <div className={styles.options}>
                {ALL_OPS.map(op => (
                  <button
                    key={op}
                    type="button"
                    className={styles.opt}
                    aria-pressed={settings.ops.includes(op)}
                    onClick={() => onToggleOp(op)}
                  >
                    <span className={styles.ci}>{operatorGlyph(op)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.row}>
              <span className={styles.label}>{t(settings.language, 'targetLabel')}</span>
              <div className={styles.options}>
                {ranges.map(([bandLo, bandHi], i) => (
                  <button
                    key={i}
                    type="button"
                    className={cx(styles.opt, styles.band)}
                    aria-pressed={settings.band === i}
                    onClick={() => onSetBand(i as Settings['band'])}
                  >
                    <span className={styles.bandLabel}>{(bandLabelsForLanguage[ranges.length] ?? MULT_BAND_LABELS)[i]}</span>
                    <span className={styles.bandRange}>{bandLo}–{bandHi}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className={styles.footer}>
              <input
                type="checkbox"
                checked={settings.uniqueOnly}
                disabled={!uniqueAvailable}
                onChange={e => onSetUniqueOnly(e.target.checked)}
              />
              <span>
                {t(settings.language, 'uniqueOnlyPrefix')}
                <b>{t(settings.language, 'uniqueOnlyBold')}</b>
                {t(settings.language, 'uniqueOnlySuffix')}
                {!uniqueAvailable && t(settings.language, 'uniqueOnlyUnavailable')}
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
