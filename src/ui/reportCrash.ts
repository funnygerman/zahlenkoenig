// Sends the crash report ErrorBoundary.tsx/index.html's watchdog already
// build, to a Google Form the PO created for this — a receiving end this
// app didn't have when the report itself shipped: a player has no
// reliable way to reach us on their own (no account, no support channel
// in the app), and this is the one no-backend way to close that gap
// without this static, server-less site growing an actual server.
// Confirmed with the PO directly: no player data goes in the report
// beyond what diagnostics.ts already collects (environment facts, never
// localStorage's contents) — see that file's own note.
//
// Manual by default, on the PO's own call: a crash is (hopefully) rare
// enough that a one-tap "Send report" button is no real burden, and this
// app has never sent anything anywhere on its own before — auto-sending
// the very first time would be a bigger, more surprising step than the
// PO wanted to take without a player choosing it. `getAutoSendPreference`/
// `setAutoSendPreference` back a checkbox on the crash screen itself that
// opts a player's *device* into sending future reports without asking
// again — a real preference, not a one-off, so it has to survive the
// reload every recovery path here ends in.
//
// `fetch(..., { mode: 'no-cors' })` is the only way to submit a Google
// Form from a page that isn't Google's own: Forms sends no CORS headers,
// so a normal cross-origin fetch would be rejected before the request
// even reaches the network. `no-cors` still sends the request, it just
// returns an opaque response this code can never read — meaning this can
// only ever report "a send was attempted", never "the form actually
// accepted it". That's an accepted limitation, not an oversight: the
// alternative (a real backend that can read the response) is exactly the
// infrastructure this project has avoided everywhere else.
const FORM_ID = '1FAIpQLSdnnobn9AuedkMb3xfHOGrOQF4sYehl-IKy2O5ixu0pfCXdoA'
const ENTRY_ID = '1500158176'
const SESSION_KEY = 'zahlenkoenig:crash-report-sent'
const PREFERENCE_KEY = 'zahlenkoenig:auto-send-crash-reports'

/** Whether this device has opted into sending future crash reports without being asked each time. */
export function getAutoSendPreference(): boolean {
  try {
    return localStorage.getItem(PREFERENCE_KEY) === '1'
  } catch {
    return false
  }
}

export function setAutoSendPreference(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(PREFERENCE_KEY, '1')
    else localStorage.removeItem(PREFERENCE_KEY)
  } catch {
    // Same guard every other storage call in this app already makes — the
    // checkbox just won't remember its state across a reload.
  }
}

/**
 * Fire-and-forget submit of `text` to the crash-report form. Returns
 * whether a send was actually attempted — `false` when one already went
 * out earlier this tab session (a `sessionStorage` flag, not a `Set` in
 * memory, so it survives the reload the "Reset & reload"/"Finish pending
 * update" buttons trigger) — so pressing "Send report" twice, or a crash
 * loop with auto-send on, can't spam the sheet with duplicates of the
 * same failure.
 */
export function sendCrashReport(text: string): boolean {
  try {
    if (sessionStorage.getItem(SESSION_KEY) === '1') return false
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // No sessionStorage (private mode) — can't dedupe, but that's a reason
    // to still send once, not to give up on sending at all.
  }

  try {
    void fetch(`https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ [`entry.${ENTRY_ID}`]: text }).toString(),
    }).catch(() => {
      // A hard network failure (offline, blocked) — the opaque no-cors
      // response can't distinguish "delivered" from "Forms rejected it"
      // regardless, so there is nothing more useful to do with a caught
      // rejection than swallow it, same as every other best-effort call
      // in this app.
    })
  } catch {
    // `fetch` itself missing or throwing synchronously (very old browser).
  }
  return true
}
