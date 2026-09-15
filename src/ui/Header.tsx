// The header (concept 12.7): the selection chip, centered, that both shows
// and changes the current selection — "das anzeigende Element ist das
// ändernde" — plus, as of step 4, the hint icon on the right (concept
// 10.3). Concept 12.7 also puts a menu icon on the left, but that belongs
// to language/rules, and the PO has since closed both halves: the language
// is detected once with no switcher (settings.ts), and the onboarding round
// chose a first-run card over a permanent rules button. The left slot
// holds the share button now (share round, PO); concept 19.3's update pill
// used to sit there and has its own row above HistoryNav instead — see
// UpdateHint.tsx for the measurement that moved it.
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
/** How long the muted chip's explanation stays up — matched to useShare.ts's own confirmation. */
const LOCKED_NOTE_MS = 1800

export interface HeaderProps {
  settings: Settings
  onSetNumbers: (numbers: Settings['numbers']) => void
  onToggleOp: (op: Operator) => void
  onSetBand: (band: Settings['band']) => void
  onSetUniqueOnly: (uniqueOnly: boolean) => void
  /** concept 10.3: one button, the same on every press — see Board.tsx's useHint for what a press actually does. */
  onPressHint: () => void
  /**
   * Whether a press would do nothing at all. Used to be a plain `disabled`
   * button, on the reasoning that this has nothing but its click, unlike
   * the tray's spent operator chips (still droppable targets for a drag).
   * That reasoning missed the actual cost: a `disabled` button gets no
   * pointer events at all, so it can never explain itself, and a crash
   * report investigation that started as "hinting is hanging" traced the
   * complaint to exactly that — a muted icon giving zero feedback. It's
   * `aria-disabled` now, the same choice the share round already made for
   * the muted selection chip, for the same reason: tapping it answers,
   * with `hintMutedReason` below.
   */
  hintMuted?: boolean
  /**
   * Why the icon is muted, shown on tapping it and withdrawn on its own —
   * the same shape as the selection chip's own `selectionLocked` note.
   * `null` whenever `hintMuted` is false (or the one case that can't
   * happen for a generated puzzle — see `useHint.ts`'s own note on
   * `hintReason`).
   */
  hintMutedReason?: 'complete' | 'spent' | null
  /**
   * Whether this puzzle gives no hints at all — two numbers (PO), where
   * three chips is the whole board. The icon is left out entirely rather
   * than shown permanently dead, the same call `HistoryNav` makes about
   * rendering nothing until there is something to browse.
   */
  hintHidden?: boolean
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
  /**
   * Show the selection chip, but muted and inert (share round, PO). The board
   * on screen is a shared link or a replay from the archive: both carry their
   * own numbers and operators, so a selection change cannot reach them — it
   * would apply to the next live puzzle instead, which is what tapping the
   * muted chip says.
   *
   * Muted rather than `disabled`, for the reason the tray's spent operator
   * chips are: a disabled button receives no pointer events at all, so on a
   * phone it could never explain itself — and `title` is a hover tooltip,
   * which touch does not have. This chip stays tappable and answers.
   */
  selectionLocked?: boolean
  /**
   * Hand the board in front of the player to somebody else as a link
   * (share round, PO). `Game.tsx` owns the action itself (`useShare`) —
   * this only places the button and reports the clipboard fallback's
   * confirmation, the same division the hint icon already uses, and for
   * the same reason: what is being shared is whichever board `Game` is
   * showing, which Header has no view of.
   */
  onShare?: () => void
  shareCopied?: boolean
  /**
   * Left out while an onboarding puzzle is on the board, for the reason
   * that round gave about the history arrows: the two fixed lessons are
   * not a player's own puzzle to pass on, and a second control mid-lesson
   * invites a detour out of the one thing there is to do.
   */
  shareHidden?: boolean
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
/**
 * concept 13.2: inline SVG, never emoji.
 *
 * Three nodes and two links — the share glyph Android and the web have
 * settled on — rather than iOS's box-and-arrow, which reads as "upload"
 * on everything that isn't an iPhone. Drawn on the same 24px grid, the
 * same 1.8 stroke and the same round caps as HintIcon beside it, so the
 * two read as one family rather than as two borrowed icons.
 */
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="17.5" cy="5.5" r="2.6" />
      <circle cx="6.5" cy="12" r="2.6" />
      <circle cx="17.5" cy="18.5" r="2.6" />
      <path d="m8.85 10.7 6.3-3.9" />
      <path d="m8.85 13.3 6.3 3.9" />
    </svg>
  )
}

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

export function Header({ settings, onSetNumbers, onToggleOp, onSetBand, onSetUniqueOnly, onPressHint, hintMuted = false, hintMutedReason = null, hintHidden = false, selectionHidden = false, selectionLocked = false, onShare, shareCopied = false, shareHidden = false }: HeaderProps) {
  const [open, setOpen] = useState(false)
  // Why the chip is muted, shown on tapping it and withdrawn on its own —
  // the same shape as the share button's "link copied" confirmation, since
  // both are a one-line answer to a tap rather than a state to dismiss.
  const [showLockedNote, setShowLockedNote] = useState(false)
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Same shape, for the hint icon's own muted explanation — a separate
  // timer since the two notes answer separate taps and shouldn't be able
  // to cancel each other.
  const [showHintNote, setShowHintNote] = useState(false)
  const hintNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => {
    if (noteTimer.current) clearTimeout(noteTimer.current)
    if (hintNoteTimer.current) clearTimeout(hintNoteTimer.current)
  }, [])

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
      {/* Concept 12.7's left slot — reserved for a menu icon no step has
          built (Header.tsx's own top comment) — holds the share button
          (PO). It is the button's own anchor rather than a cluster: concept
          19.3's update pill used to share this slot and has moved out to a
          row of its own above HistoryNav (UpdateHint.tsx), because the two
          could not both fit beside the widest selection chip in any
          language. Nothing else appears here, so the share button never
          moves. */}
      {!shareHidden && onShare && (
        <button type="button" className={`${styles.iconButton} ${styles.shareButton}`} onClick={onShare} aria-label={t(settings.language, 'shareLabel')}>
          <ShareIcon />
        </button>
      )}

      {!selectionHidden && (
      <button
        type="button"
        className={selectionLocked ? `${styles.chip} ${styles.chipLocked}` : styles.chip}
        aria-expanded={selectionLocked ? undefined : open}
        aria-controls={selectionLocked ? undefined : 'zk-selection-panel'}
        aria-disabled={selectionLocked || undefined}
        onClick={() => {
          if (selectionLocked) {
            setShowLockedNote(true)
            if (noteTimer.current) clearTimeout(noteTimer.current)
            noteTimer.current = setTimeout(() => setShowLockedNote(false), LOCKED_NOTE_MS)
            return
          }
          setOpen(o => !o)
        }}
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

      {/* The header's right slot (concept 12.7's "rechts ein Symbol: Tipp"),
          unchanged — the hint is where it has always been. `aria-disabled`,
          not `disabled` (see hintMuted's own note): muted still means "tap
          it and it explains", same as the selection chip. */}
      {!hintHidden && (
        <button
          type="button"
          className={`${styles.iconButton} ${styles.hintButton}`}
          aria-disabled={hintMuted || undefined}
          aria-label={t(settings.language, 'hintLabel')}
          onClick={() => {
            if (hintMuted) {
              setShowHintNote(true)
              if (hintNoteTimer.current) clearTimeout(hintNoteTimer.current)
              hintNoteTimer.current = setTimeout(() => setShowHintNote(false), LOCKED_NOTE_MS)
              return
            }
            onPressHint()
          }}
        >
          <HintIcon />
        </button>
      )}

      {/* Only ever seen where there is no share sheet to take over the job
          (useShare.ts): on a desktop the link goes to the clipboard, and
          without a word saying so the button would look like it did
          nothing. `role="status"` so a screen reader hears it too — it is
          the only confirmation either way. */}
      {shareCopied && (
        <div className={styles.copied} role="status">{t(settings.language, 'shareCopied')}</div>
      )}

      {/* Below the header rather than above it, decided by looking: above is
          where HistoryNav's arrows sit, dead centre, and this note is centred
          on the chip it belongs to. Below, it lies over the top of the
          expression field for a moment — empty scaffold at the one time a
          player can see this, since they just tapped the header. */}
      {showLockedNote && (
        <div className={styles.lockedNote} role="status">{t(settings.language, 'selectionLocked')}</div>
      )}

      {/* Above the header, right-anchored to the hint button — mirrors
          .copied's own placement above the share button, on the opposite
          edge. Not below: measured against a real render and a note
          dropped under the hint icon lands on the target chip one row
          down (Header.module.css's .hintNote has the full account). */}
      {showHintNote && hintMutedReason && (
        <div className={styles.hintNote} role="status">
          {t(settings.language, hintMutedReason === 'complete' ? 'hintComplete' : 'hintSpent')}
        </div>
      )}

      {open && !selectionLocked && (
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
