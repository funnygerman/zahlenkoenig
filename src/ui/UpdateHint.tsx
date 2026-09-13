// Concept 19.3's update surface — "ein knapper Hinweis... statt eines
// Popup-Dialogs" — as its own row above the history arrows, centered.
//
// It lived in the header's left slot until the share round, and was moved
// out on the PO's call for a reason that was measured rather than argued:
// the header row cannot hold a word-pill and an icon at once. At 390px with
// the widest selection (4 numbers, 4 operators, 251–max) the selection chip
// starts at 107px, while the pill alone ends at 84px in English, 103 in
// Russian and 121 in German — so `Aktualisieren` already overlapped the chip
// before the share button existed, and adding a 34px icon beside it put
// every language over. Moving it out of the header removes the competition
// instead of rationing it: the pill gets a full centered row, the header's
// left slot belongs to sharing, and the German overlap is gone with no
// shortening, abbreviation or icon-instead-of-word compromise.
//
// This is a deliberate, PO-approved departure from concept 19.3's own
// wording ("in der Kopfzeile"). What that line is actually asking for is a
// quiet, non-modal hint the player can ignore; a row of its own directly
// above the header is at least as quiet, and it is the only placement that
// survives all three languages at the narrowest width.
//
// Renders nothing when there is no update, the same call HistoryNav makes
// about having nothing to browse — not a permanently disabled control.

import type { Settings } from '../core/settings'
import { t } from '../core/i18n'
import styles from './UpdateHint.module.css'

export interface UpdateHintProps {
  available: boolean
  onUpdate?: () => void
  language: Settings['language']
}

export function UpdateHint({ available, onUpdate, language }: UpdateHintProps) {
  if (!available) return null

  return (
    <div className={styles.row}>
      <button type="button" className={styles.pill} onClick={onUpdate}>
        {t(language, 'updateHint')}
      </button>
    </div>
  )
}
