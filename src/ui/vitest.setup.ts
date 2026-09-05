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
