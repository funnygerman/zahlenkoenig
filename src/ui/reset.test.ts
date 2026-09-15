import { describe, it, expect, vi, afterEach } from 'vitest'
import { resetAppState } from './reset'

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
