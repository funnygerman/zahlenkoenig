// Originally written against a device report: the footer sat partially
// off-screen in landscape on a real Android phone (Pixel 8a), with the
// browser's own address bar still visible and no way to scroll down to it
// — concept 12.6's "kein Scrollen" (tokens.css's `overflow: hidden`)
// removes exactly the gesture that would otherwise nudge a browser into
// recomputing layout. The working theory was that `dvh` (which `--cell`'s
// formula and `.page`'s own height both sized themselves off) was stale —
// not repainted promptly after rotation — so the board laid out against a
// taller value than what was actually on screen.
//
// That theory didn't survive contact with a second report at an exact,
// reproducible size (661×322, Firefox's responsive mode): a headless check
// at that same size, with this fix already in place, rendered the footer
// fully visible with margin to spare — so the measured viewport height was
// never the problem. The real cause turned out to be font metrics: this
// repo's own headless-Chromium checks render `--font-board`'s `system-ui`
// stack with whatever generic font the sandboxed environment substitutes,
// which sits shorter than the real system fonts a desktop Firefox or a
// phone's real Chrome render it with — and the header/history/footer text
// is sized in fixed `rem` values that don't shrink with `--cell` the way
// the board does, unlike the board. Game.module.css's `.footer` has the
// fix that actually addresses it (a landscape-only layout change, not a
// viewport-height one).
//
// This hook is kept regardless: `dvh` genuinely can lag on some real
// mobile browsers after an orientation change (a documented, separate
// class of bug from the one above), and measuring the real, currently-
// visible height ourselves — the classic fix that predates `dvh` — is a
// strictly more-defensive fallback than trusting it blindly, even though
// it wasn't what either report actually needed. `visualViewport` is
// preferred over `window.innerHeight` where available — it is the
// browser's own live account of what's actually on screen (keyboard,
// toolbar and all), rather than the layout viewport, which is one more
// value that can lag.
import { useEffect } from 'react'

export function useAppViewportHeight() {
  useEffect(() => {
    const viewport = window.visualViewport
    const setHeight = () => {
      const height = viewport?.height ?? window.innerHeight
      document.documentElement.style.setProperty('--app-vh', `${height}px`)
    }
    setHeight()

    const target: { addEventListener: typeof window.addEventListener; removeEventListener: typeof window.removeEventListener } = viewport ?? window
    target.addEventListener('resize', setHeight)
    // orientationchange fires on `window`/`screen`, never on visualViewport,
    // and is worth listening to directly: it is the one signal that fires
    // right as rotation happens, ahead of whichever resize event follows.
    window.addEventListener('orientationchange', setHeight)
    return () => {
      target.removeEventListener('resize', setHeight)
      window.removeEventListener('orientationchange', setHeight)
    }
  }, [])
}
