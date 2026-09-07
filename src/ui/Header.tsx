// The header (concept 12.7): the selection chip, centered, that both shows
// and changes the current selection — "das anzeigende Element ist das
// ändernde" — plus, as of step 4, the hint icon on the right (concept
// 10.3). Concept 12.7 also puts a menu icon on the left, but that belongs
// to language/rules, which no step has built yet: a button with no handler
// is worse than no button, so this still renders only the chip and the
// hint icon.
//
// The panel it opens is concept 15.6's selection UI — three rows the
// player can change independently, plus the uniqueOnly switch — laid over
// the board rather than a separate screen. It stays open across changes
// and only closes on an outside tap or Escape (concept 15.6's own rules).

import { useEffect, useRef, useState } from 'react'
import type { Settings } from '../core/settings'
import { bandRanges, uniqueOnlyAvailable } from '../core/puzzles'
import { operatorGlyph, type Operator } from '../core/expression'
import styles from './Header.module.css'

const ALL_OPS: Operator[] = ['+', '-', '*', '/']
const BAND_LABELS = ['klein', 'mittel', 'groß']
const NUMBER_OPTIONS: Settings['numbers'][] = [2, 3, 4]

export interface HeaderProps {
  settings: Settings
  onSetNumbers: (numbers: Settings['numbers']) => void
  onToggleOp: (op: Operator) => void
  onSetBand: (band: Settings['band']) => void
  onSetUniqueOnly: (uniqueOnly: boolean) => void
  /** concept 10.3: one button, the same on every press — see Board.tsx's useHint for what a press actually does. */
  onPressHint: () => void
}

/** concept 13.2: inline SVG, never emoji. */
function HintIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.3 9.6a2.7 2.7 0 1 1 4 2.35c-.85.5-1.3 1-1.3 2.05" />
      <circle cx="12" cy="17.2" r=".1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function Header({ settings, onSetNumbers, onToggleOp, onSetBand, onSetUniqueOnly, onPressHint }: HeaderProps) {
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

  return (
    <div className={styles.header} ref={rootRef}>
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
      </button>

      <button type="button" className={styles.hintButton} onClick={onPressHint} aria-label="Tipp">
        <HintIcon />
      </button>

      {open && (
        <div className={styles.backdrop} onClick={() => setOpen(false)}>
          <div
            id="zk-selection-panel"
            className={styles.panel}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.row}>
              <span className={styles.label}>Wie viele Zahlen</span>
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
              <span className={styles.label}>Welche Rechenzeichen</span>
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
              <span className={styles.label}>Wie groß das Ziel</span>
              <div className={styles.options}>
                {ranges.map(([bandLo, bandHi], i) => (
                  <button
                    key={i}
                    type="button"
                    className={cx(styles.opt, styles.band)}
                    aria-pressed={settings.band === i}
                    onClick={() => onSetBand(i as Settings['band'])}
                  >
                    <span className={styles.bandLabel}>{BAND_LABELS[i]}</span>
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
              <span>nur Rätsel mit <b>einer</b> Lösung{!uniqueAvailable && ' (für diese Auswahl nicht verfügbar)'}</span>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
