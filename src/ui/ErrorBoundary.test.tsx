import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Bomb(): never {
  throw new Error('kaboom')
}

// React logs the caught error to the console by default; these tests
// trigger it on purpose, so the noise is silenced rather than left to
// clutter a passing run.
function silenceConsoleError() {
  return vi.spyOn(console, 'error').mockImplementation(() => {})
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response()))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all fine</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('all fine')).toBeInTheDocument()
  })

  it('shows a crash report instead of unmounting the whole app when a child throws', async () => {
    const spy = silenceConsoleError()
    try {
      render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      )
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Something went wrong.')).toBeInTheDocument()

      // componentDidCatch kicks the diagnostic collection off asynchronously.
      await waitFor(() => {
        expect((screen.getByLabelText('Crash report') as HTMLTextAreaElement).value).toContain('Error: kaboom')
      })
    } finally {
      spy.mockRestore()
    }
  })

  it('does not send a report on its own — "Send report" stays manual by default', async () => {
    const spy = silenceConsoleError()
    try {
      render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      )
      await waitFor(() => {
        expect((screen.getByLabelText('Crash report') as HTMLTextAreaElement).value).toContain('Error: kaboom')
      })
      expect(fetch).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Send report' })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: 'Automatically send future crash reports' })).not.toBeChecked()
    } finally {
      spy.mockRestore()
    }
  })

  it('sends the report when "Send report" is pressed, and hides the button afterward', async () => {
    const spy = silenceConsoleError()
    try {
      render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      )
      const user = (await import('@testing-library/user-event')).default.setup()
      await waitFor(() => screen.getByRole('button', { name: 'Send report' }))

      await user.click(screen.getByRole('button', { name: 'Send report' }))

      expect(fetch).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('button', { name: 'Send report' })).not.toBeInTheDocument()
      expect(screen.getByText(/a report was sent/i)).toBeInTheDocument()
    } finally {
      spy.mockRestore()
    }
  })

  it('sends immediately, with no button needed, once the device has opted into auto-send', async () => {
    const spy = silenceConsoleError()
    try {
      localStorage.setItem('zahlenkoenig:auto-send-crash-reports', '1')
      render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      )
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(1)
      })
      expect(screen.queryByRole('button', { name: 'Send report' })).not.toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: 'Automatically send future crash reports' })).toBeChecked()
    } finally {
      spy.mockRestore()
    }
  })

  it('ticking the checkbox sends the already-collected report and remembers the preference', async () => {
    const spy = silenceConsoleError()
    try {
      render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      )
      const user = (await import('@testing-library/user-event')).default.setup()
      await waitFor(() => screen.getByRole('button', { name: 'Send report' }))
      expect(fetch).not.toHaveBeenCalled()

      await user.click(screen.getByRole('checkbox', { name: 'Automatically send future crash reports' }))

      expect(fetch).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('button', { name: 'Send report' })).not.toBeInTheDocument()
      expect(localStorage.getItem('zahlenkoenig:auto-send-crash-reports')).toBe('1')
    } finally {
      spy.mockRestore()
    }
  })

  it('offers a reset action that does not throw even with no service worker/caches support', async () => {
    const spy = silenceConsoleError()
    try {
      render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      )
      const user = (await import('@testing-library/user-event')).default.setup()
      // None of these should throw when pressed, even in an environment
      // (jsdom) with no Clipboard API and no service worker — the same
      // "answer, never crash" posture the rest of the app's fallbacks take.
      await user.click(screen.getByRole('button', { name: 'Copy report' }))
      await waitFor(() => screen.getByRole('button', { name: 'Send report' }))
      await user.click(screen.getByRole('button', { name: 'Send report' }))
      await user.click(screen.getByRole('button', { name: 'Reset & reload' }))
    } finally {
      spy.mockRestore()
    }
  })

  it('offers to finish a pending update instead, when one is stuck waiting', async () => {
    const spy = silenceConsoleError()
    try {
      vi.stubGlobal('navigator', {
        ...navigator,
        serviceWorker: {
          getRegistrations: () => Promise.resolve([{ scope: '/zahlenkoenig/', active: {}, waiting: {}, installing: null }]),
          addEventListener: vi.fn(),
        },
      })
      render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      )
      // Same fact reset.ts's recoverAppState acts on, read back out of the
      // report rather than the mock directly — this is pinning what the
      // player sees, not the diagnostics module's own internals.
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Finish pending update' })).toBeInTheDocument()
      })
    } finally {
      spy.mockRestore()
    }
  })
})
