// Handing the current board to somebody else as a link (share round, PO).
//
// Two mechanisms, in order: the platform's own share sheet where there is
// one (`navigator.share` — every mobile browser this game is actually
// played in), and the clipboard where there isn't (desktop Firefox, and
// any browser outside a secure context). The fallback is not a lesser
// path: on a desktop, copying the link *is* what a share sheet would have
// ended up doing.
//
// The one thing worth knowing before changing this: a shared link's
// preview card cannot show the shared puzzle. `og:image` is a static file
// and GitHub Pages has no server to render a per-puzzle one, so every link
// renders the same `(6+2)×(9−3)=48` card the SEO round built. The `text`
// below is therefore the only place the actual puzzle is named, which is
// why it carries the digits rather than leaving them to the card.

import { useCallback, useEffect, useRef, useState } from 'react'
import { sharedPuzzleUrl, type SharedPuzzle } from '../core/shareLink'
import { t } from '../core/i18n'
import type { Settings } from '../core/settings'

/** How long the "link copied" confirmation stays up. Long enough to read, short enough not to need dismissing. */
const COPIED_MS = 1800

export interface Share {
  share: () => void
  /** True while the clipboard fallback's confirmation is showing. */
  copied: boolean
}

export function useShare(puzzle: SharedPuzzle, language: Settings['language']): Share {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const share = useCallback(() => {
    // `location.origin + location.pathname` rather than `href`: the player
    // may themselves have arrived on a `#p=` link, and re-sharing must
    // send *this* board, not the one they were sent. (In practice the
    // fragment is already stripped by then — Game.tsx clears it once the
    // shared puzzle opens — but a share button that depends on that
    // having happened would be one ordering change away from broken.)
    const url = sharedPuzzleUrl(puzzle, `${window.location.origin}${window.location.pathname}`)
    const text = `${puzzle.numbers.join(' ')} → ${puzzle.target}\n${t(language, 'sharePrompt')}`

    const copy = () => {
      void navigator.clipboard?.writeText(`${text}\n${url}`).then(() => {
        setCopied(true)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), COPIED_MS)
      }, () => {
        // No clipboard permission and no share sheet: nothing useful is
        // left to do, and a thrown error would be worse than a button that
        // quietly did nothing on a platform that allows neither.
      })
    }

    if (typeof navigator.share === 'function') {
      navigator.share({ title: 'Zahlenkönig', text, url }).catch((err: unknown) => {
        // A cancelled share sheet is a decision, not a failure — copying
        // the link behind the player's back after they dismissed it is
        // exactly the wrong response. Every other failure falls back.
        if (err instanceof Error && err.name === 'AbortError') return
        copy()
      })
      return
    }
    copy()
  }, [puzzle, language])

  return { share, copied }
}
