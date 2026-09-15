import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { sendCrashReport, getAutoSendPreference, setAutoSendPreference } from './reportCrash'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sendCrashReport', () => {
  it('POSTs the report to the form as a no-cors, form-urlencoded request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response())
    vi.stubGlobal('fetch', fetchMock)

    const sent = sendCrashReport('the report text')

    expect(sent).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('docs.google.com/forms/d/e/')
    expect(url).toContain('/formResponse')
    expect(init.method).toBe('POST')
    expect(init.mode).toBe('no-cors')
    expect(init.body).toContain('the+report+text')
  })

  it('only sends once per tab session, even across separate calls', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response())
    vi.stubGlobal('fetch', fetchMock)

    expect(sendCrashReport('first')).toBe(true)
    expect(sendCrashReport('second')).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not throw when fetch itself is unavailable', () => {
    vi.stubGlobal('fetch', undefined)
    expect(() => sendCrashReport('text')).not.toThrow()
  })
})

describe('auto-send preference', () => {
  it('defaults to off', () => {
    expect(getAutoSendPreference()).toBe(false)
  })

  it('persists across reads once set, and clears when turned off', () => {
    setAutoSendPreference(true)
    expect(getAutoSendPreference()).toBe(true)
    setAutoSendPreference(false)
    expect(getAutoSendPreference()).toBe(false)
  })

  it('reads back false rather than throwing where localStorage is unavailable', () => {
    const original = window.localStorage
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    try {
      expect(getAutoSendPreference()).toBe(false)
      expect(() => setAutoSendPreference(true)).not.toThrow()
    } finally {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: original })
    }
  })
})
