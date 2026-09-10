import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Vitest doesn't auto-detect Testing Library's cleanup the way Jest does —
// without this, DOM from one test's render() leaks into the next.
afterEach(() => cleanup())

// jsdom doesn't implement the Pointer Events capture methods at all (they're
// simply missing from Element.prototype) — useDrag.ts's onPointerDown calls
// setPointerCapture unconditionally (concept 5.1), which real browsers all
// support, so any test that drives it through real DOM events (e.g. via
// userEvent, in a component test) needs these stubbed rather than absent.
// This setup file runs for every test file (vite.config.ts's environment is
// per-glob, not its setupFiles) — `core/`'s tests run under `node`, where
// `Element` doesn't exist at all, so this must guard rather than assume jsdom.
if (typeof Element !== 'undefined' && !Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.hasPointerCapture = () => false
}

// jsdom's own navigator.language defaults to 'en-US', which — now that
// settings.ts's loadSettings() detects a first visit's language from it
// (negative-result-display round's i18n follow-up) — would make every
// component test that renders a fresh `<Game>` (no stored settings) see
// English instead of the German every existing assertion was written
// against. Pinning it to German here keeps those tests exercising exactly
// what they did before detection existed; `core/i18n.test.ts` and
// `core/settings.test.ts` cover English/Russian detection directly,
// independent of this stub, by overriding `navigator.language` themselves
// for the one assertion that needs it.
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'language', { value: 'de-DE', configurable: true })
}
