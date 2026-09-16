// Catches a crash inside the mounted app and turns it into something a
// player can act on, rather than a blank screen with no way back — the
// same "never a silent dead end" posture core/hints.ts's dead-end border
// and useShare.ts's clipboard fallback already take. This app has no
// analytics, no error-tracking service and no server, so a crash on
// somebody's phone was otherwise completely invisible to anyone but them —
// reportCrash.ts's "Send report" button closes that gap (a player has no
// reliable way to reach us on their own), with "Copy report" alongside it
// for anyone who'd rather send it somewhere else themselves.
//
// This only ever catches a crash *inside the render tree after it mounted*
// (React error boundaries can't catch anything else — not an event
// handler, not a `useEffect`, and not a failure that happens before this
// component's own JS ever runs). index.html's own inline watchdog script
// covers that earlier failure mode; see its comment for why it can't share
// this component's code.
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { collectDiagnostics } from './diagnostics'
import { recoverAppState } from './reset'
import { getAutoSendPreference, sendCrashReport, setAutoSendPreference } from './reportCrash'
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
  // reset.ts's own note: a waiting service worker never activates on its
  // own under registerType: 'prompt', and the header's update pill that
  // would normally trigger it is part of the app that just crashed — so
  // this button has to be able to reach it directly. The report already
  // says "waiting: true" per registration (diagnostics.ts), so reading it
  // back out is cheaper than tracking a second piece of state for the same
  // fact.
  const hasWaitingUpdate = report?.includes('waiting: true') ?? false

  const [reportSent, setReportSent] = useState(false)
  const [autoSend, setAutoSend] = useState(() => getAutoSendPreference())

  // Covers both ways a report ends up sent without a separate "send now"
  // path: the preference was already on from an earlier crash (fires the
  // moment `report` itself becomes available), and the checkbox below
  // being ticked for the first time while a report is already sitting
  // there. sendCrashReport's own sessionStorage dedupe means toggling the
  // checkbox back and forth can't send a duplicate.
  //
  // `sendCrashReport` is called *outside* the state updater deliberately.
  // It is not a pure function of the previous state — it writes its own
  // sessionStorage dedupe flag and returns `false` on every call after the
  // first — and React is allowed to invoke an updater more than once for
  // the same base state (it re-runs them when a render is thrown away).
  // A second invocation from `sent === false` therefore returns
  // `false || false`, collapsing `reportSent` back to false *after the
  // report has already gone out*: the player is shown "Send report" again
  // and never told it was sent. That is also the shape of an intermittent
  // CI failure on this file — `fetch` called once, the button still
  // there — though it could not be reproduced locally to confirm.
  useEffect(() => {
    if (!report || !autoSend) return
    if (sendCrashReport(report)) setReportSent(true)
  }, [report, autoSend])

  const copy = () => {
    void navigator.clipboard?.writeText(text).catch(() => {
      // No Clipboard API, or no permission — the textarea below is still
      // there to select by hand, the same fallback useShare.ts's own
      // clipboard path relies on.
    })
  }

  const sendNow = () => {
    if (!report) return
    // Same reason as the effect above: the send happens here, the state
    // update only records it.
    if (sendCrashReport(report)) setReportSent(true)
  }

  const toggleAutoSend = (checked: boolean) => {
    setAutoSendPreference(checked)
    setAutoSend(checked)
  }

  const recover = () => {
    void recoverAppState().then(() => {
      window.location.href = window.location.pathname
    })
  }

  return (
    <div className={styles.wrap} role="alert">
      <p className={styles.title}>Something went wrong.</p>
      <p className={styles.hint}>
        {reportSent
          ? 'Thanks — a report was sent. Try the button below to get back into the game.'
          : 'Send a report to help us fix this, or copy it and send it yourself. Then try the button below to get back into the game.'}
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
        {!reportSent && (
          <button type="button" onClick={sendNow} disabled={!report}>
            Send report
          </button>
        )}
        <button type="button" onClick={recover}>
          {hasWaitingUpdate ? 'Finish pending update' : 'Reset & reload'}
        </button>
      </div>
      <label className={styles.checkbox}>
        <input type="checkbox" checked={autoSend} onChange={e => toggleAutoSend(e.currentTarget.checked)} />
        Automatically send future crash reports
      </label>
    </div>
  )
}
