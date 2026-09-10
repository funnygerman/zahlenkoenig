// The puzzle-history strip (footer/history round): two arrows above the
// header that step backward into the last SOLVED_LIMIT solved puzzles
// (core/solvedHistory.ts) and forward again, back to whatever puzzle is
// currently live. Its own small component rather than folded into
// Header.tsx: Header owns the selection chip and the hint icon (concept
// 12.7), a different concern from browsing what's already been solved —
// and Header's own left/right slots are already spoken for (the
// update-hint pill, the hint icon).
//
// Purely numeric position indicator ("2/8"), no translated label: digits
// need no i18n and read the same to a first-grader as to an adult, the
// same reasoning Header's own mini number/operator chips already follow.
//
// Renders nothing until at least one puzzle has been solved — a row of
// two permanently-disabled arrows on a brand-new install has nothing to
// do, and appearing the moment there's something to browse doubles as a
// small "look, now you can review" cue.

import styles from './HistoryNav.module.css'

export interface HistoryNavProps {
  /** null while showing the live, currently-being-solved puzzle. */
  index: number | null
  /** how many puzzles are in the archive — 0 hides the whole strip. */
  total: number
  onBack: () => void
  onForward: () => void
  backLabel: string
  forwardLabel: string
}

/** concept 13.2: inline SVG, never emoji — mirrors Header.tsx's own HintIcon. */
function ArrowIcon({ direction }: { direction: 'back' | 'forward' }) {
  const d = direction === 'back' ? 'M14.5 5.5 8 12l6.5 6.5' : 'M9.5 5.5 16 12l-6.5 6.5'
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export function HistoryNav({ index, total, onBack, onForward, backLabel, forwardLabel }: HistoryNavProps) {
  if (total === 0) return null

  // Back always has somewhere to go except at the oldest entry; forward
  // only exists at all once browsing has started (index !== null) — from
  // the live puzzle there is nothing "ahead" of it yet.
  const canGoBack = index === null || index > 0
  const canGoForward = index !== null

  return (
    <div className={styles.nav}>
      <button type="button" className={styles.arrow} onClick={onBack} disabled={!canGoBack} aria-label={backLabel}>
        <ArrowIcon direction="back" />
      </button>
      <span className={styles.position}>{index !== null ? `${index + 1}/${total}` : ''}</span>
      <button type="button" className={styles.arrow} onClick={onForward} disabled={!canGoForward} aria-label={forwardLabel}>
        <ArrowIcon direction="forward" />
      </button>
    </div>
  )
}
