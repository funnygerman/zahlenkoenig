import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Vitest doesn't auto-detect Testing Library's cleanup the way Jest does —
// without this, DOM from one test's render() leaks into the next.
afterEach(() => cleanup())
