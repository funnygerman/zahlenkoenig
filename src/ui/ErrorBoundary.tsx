// Catches a crash inside the mounted app and turns it into something a
// player can act on, rather than a blank screen with no way back — the
// same "never a silent dead end" posture core/hints.ts's dead-end border
// and useShare.ts's clipboard fallback already take. A report a player can
// copy and hand to us is the whole point: this app has no analytics, no
// error-tracking service and no server, so a crash on somebody's phone is
// otherwise completely invisible to anyone but them.
//
// This only ever catches a crash *inside the render tree after it mounted*
// (React error boundaries can't catch anything else — not an event
// handler, not a `useEffect`, and not a failure that happens before this
// component's own JS ever runs). index.html's own inline watchdog script
// covers that earlier failure mode; see its comment for why it can't share
// this component's code.
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { collectDiagnostics } from './diagnostics'
import { resetAppState } from './reset'
import styles from './ErrorBoundary.module.css'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  report: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, report: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void collectDiagnostics({ message: error.message, stack: error.stack ?? info.componentStack ?? undefined }).then(
      report => this.setState({ report }),
    )
  }

  render() {
    if (!this.state.error) return this.props.children
    return <ErrorFallback report={this.state.report} />
  }
}

function ErrorFallback({ report }: { report: string | null }) {
  const text = report ?? 'Collecting diagnostic details…'

  const copy = () => {
    void navigator.clipboard?.writeText(text).catch(() => {
      // No Clipboard API, or no permission — the textarea below is still
      // there to select by hand, the same fallback useShare.ts's own
      // clipboard path relies on.
    })
  }

  const reset = () => {
    void resetAppState().then(() => {
      window.location.href = window.location.pathname
    })
  }

  return (
    <div className={styles.wrap} role="alert">
      <p className={styles.title}>Something went wrong.</p>
      <p className={styles.hint}>
        Try "Reset &amp; reload" below. If that doesn't help, copy the report and send it to us.
      </p>
      <textarea
        className={styles.report}
        readOnly
        value={text}
        onFocus={e => e.currentTarget.select()}
        aria-label="Crash report"
      />
      <div className={styles.actions}>
        <button type="button" onClick={copy}>
          Copy report
        </button>
        <button type="button" onClick={reset}>
          Reset &amp; reload
        </button>
      </div>
    </div>
  )
}
