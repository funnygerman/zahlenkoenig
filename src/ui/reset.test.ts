import { describe, it, expect, vi, afterEach } from 'vitest'
import { resetAppState, recoverAppState } from './reset'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resetAppState', () => {
  it('unregisters every service worker and empties every cache bucket', async () => {
    const unregister1 = vi.fn().mockResolvedValue(true)
    const unregister2 = vi.fn().mockResolvedValue(true)
    const deleteCache = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: {
        getRegistrations: () => Promise.resolve([{ unregister: unregister1 }, { unregister: unregister2 }]),
      },
    })
    vi.stubGlobal('caches', { keys: () => Promise.resolve(['a', 'b']), delete: deleteCache })

    localStorage.setItem('zahlenkoenig:settings-v2', '{}')
    await resetAppState()

    expect(unregister1).toHaveBeenCalled()
    expect(unregister2).toHaveBeenCalled()
    expect(deleteCache).toHaveBeenCalledWith('a')
    expect(deleteCache).toHaveBeenCalledWith('b')
    expect(localStorage.getItem('zahlenkoenig:settings-v2')).toBeNull()
  })

  it('does nothing and does not throw where serviceWorker/caches are unsupported', async () => {
    localStorage.setItem('zahlenkoenig:settings-v2', '{}')
    await expect(resetAppState()).resolves.toBeUndefined()
    expect(localStorage.getItem('zahlenkoenig:settings-v2')).toBeNull()
  })

  it('still clears storage even when a registration refuses to unregister', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: {
        getRegistrations: () => Promise.reject(new Error('nope')),
      },
    })
    localStorage.setItem('zahlenkoenig:settings-v2', '{}')
    await expect(resetAppState()).resolves.toBeUndefined()
    expect(localStorage.getItem('zahlenkoenig:settings-v2')).toBeNull()
  })
})

// The targeted fix ahead of the full wipe (see this module's own note): a
// waiting worker never activates on its own under registerType: 'prompt',
// and the real-device report that prompted this was a player stuck exactly
// there with no way to reach the header's update pill.
describe('recoverAppState', () => {
  it('activates a waiting worker and skips the full wipe entirely', async () => {
    const postMessage = vi.fn()
    const addEventListener = vi.fn((event: string, cb: () => void) => {
      // Simulates the browser firing `controllerchange` right away, so the
      // test doesn't have to wait out the real 3s timeout fallback.
      if (event === 'controllerchange') cb()
    })
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: {
        getRegistrations: () => Promise.resolve([{ waiting: { postMessage } }]),
        addEventListener,
      },
    })
    localStorage.setItem('zahlenkoenig:settings-v2', '{}')

    const outcome = await recoverAppState()

    expect(outcome).toBe('activated')
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    // The whole point: settings survive, unlike the full wipe.
    expect(localStorage.getItem('zahlenkoenig:settings-v2')).toBe('{}')
  })

  it('falls back to the full wipe when no registration is waiting', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: {
        getRegistrations: () => Promise.resolve([{ waiting: null }]),
        addEventListener: vi.fn(),
      },
    })
    localStorage.setItem('zahlenkoenig:settings-v2', '{}')

    const outcome = await recoverAppState()

    expect(outcome).toBe('reset')
    expect(localStorage.getItem('zahlenkoenig:settings-v2')).toBeNull()
  })

  it('falls back to the full wipe where serviceWorker is unsupported', async () => {
    localStorage.setItem('zahlenkoenig:settings-v2', '{}')
    const outcome = await recoverAppState()
    expect(outcome).toBe('reset')
    expect(localStorage.getItem('zahlenkoenig:settings-v2')).toBeNull()
  })
})
