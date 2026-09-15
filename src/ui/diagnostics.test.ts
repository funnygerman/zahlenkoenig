import { describe, it, expect, vi, afterEach } from 'vitest'
import { collectDiagnostics } from './diagnostics'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('collectDiagnostics', () => {
  it('reports the environment even with no error and no service worker/caches support', async () => {
    const report = await collectDiagnostics()
    expect(report).toContain('Zahlenkönig crash report')
    expect(report).toContain('URL: ')
    expect(report).toContain('User agent: ')
    expect(report).toContain('localStorage writable: true')
    // jsdom implements neither API, which is itself a real, useful report
    // rather than a test artifact to work around.
    expect(report).toContain('Service worker registrations: unsupported')
    expect(report).toContain('Cache Storage keys: unsupported')
    expect(report).not.toContain('Error:')
  })

  it('appends the error message and stack last, when given one', async () => {
    const report = await collectDiagnostics({ message: 'boom', stack: 'at foo.ts:1:1' })
    expect(report.endsWith('Stack:\nat foo.ts:1:1')).toBe(true)
    expect(report).toContain('Error: boom')
  })

  it('reports registered service workers and cache buckets when present', async () => {
    const registration = { scope: '/zahlenkoenig/', active: {}, waiting: null, installing: null }
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: { getRegistrations: () => Promise.resolve([registration]), controller: null },
      onLine: true,
    })
    vi.stubGlobal('caches', { keys: () => Promise.resolve(['workbox-precache-v1']) })

    const report = await collectDiagnostics()
    expect(report).toContain('/zahlenkoenig/ (active: true, waiting: false, installing: false)')
    expect(report).toContain('Cache Storage keys: workbox-precache-v1')
  })

  it('falls back to false rather than throwing when localStorage is unavailable', async () => {
    const original = window.localStorage
    // @ts-expect-error -- simulating a private-browsing tab, same case settings.ts's own loadSettings guards against
    delete window.localStorage
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    try {
      const report = await collectDiagnostics()
      expect(report).toContain('localStorage writable: false')
    } finally {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: original })
    }
  })
})
