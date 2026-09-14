// Bug fix (device report): the footer sat partially off-screen in
// landscape on a real Android phone (Pixel 8a), with the browser's own
// address bar still visible and no way to scroll down to it — concept
// 12.6's "kein Scrollen" (tokens.css's `overflow: hidden`) removes exactly
// the gesture that would otherwise nudge Chrome into recomputing layout.
// `--cell`'s formula (tokens.css) and `.page`'s own height (Game.module.css)
// both size themselves off `dvh`, which is *supposed* to track the
// currently-visible viewport — but real Android Chrome does not always
// repaint it promptly after an orientation change, so the board can be laid
// out against a taller value than what is actually on screen. A headless
// browser can't reproduce this: `dvh` is exactly right there because there
// is no real browser chrome animating around it, which is why this looked
// fine in every Playwright check before a real device caught it.
//
// The fix is the classic one that predates `dvh` and is still the reliable
// belt for this exact class of bug: measure the real, currently-visible
// height ourselves and write it into a custom property, re-measuring on
// every event that could mean the visible area changed. `visualViewport` is
// preferred over `window.innerHeight` where available — it is the browser's
// own live account of what's actually on screen (keyboard, toolbar and all),
// rather than the layout viewport, which is one more value that can lag.
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
