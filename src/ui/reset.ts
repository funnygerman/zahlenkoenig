// The recovery actions behind an ErrorBoundary's own button (and
// index.html's pre-mount fallback, which duplicates this logic in plain JS
// because it has to survive the very failure this module is meant to fix —
// see that file's own comment).
//
// `registerType: 'prompt'` (vite.config.ts) means a new service worker
// never takes over on its own — it sits `waiting` until every open tab for
// this origin closes, or the header's update pill is tapped. That is
// deliberate for the normal case (concept 19.3: no silent swap), but it is
// also a trap for exactly the failure this file exists to recover from: a
// player stuck on a blank page has no pill to tap, because the pill is
// part of the app that is not rendering. The first real-device report this
// shipped against confirmed it — the crash screen this module drives never
// even got a chance to show, and what actually fixed it was restarting
// Safari outright, which is the one thing guaranteed to close every client
// and let a waiting worker finally activate. `recoverAppState` tries that
// first, because it is the targeted fix and it loses nothing (settings,
// history, onboarding progress all survive it) — the full wipe is the
// fallback for when there is no waiting worker to activate, or activating
// one doesn't actually fix anything.

/**
 * Messages a waiting service worker to skip waiting and resolves once the
 * new one has taken over (or after a timeout, in case `controllerchange`
 * itself is the thing that's stuck — this is recovery code, so it must not
 * be able to hang forever). Returns whether a waiting worker was found at
 * all, which is what tells the caller whether this path did anything.
 */
async function activateWaitingWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  let registration
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    registration = regs.find(r => r.waiting)
  } catch {
    return false
  }
  const worker = registration?.waiting
  if (!worker) return false

  await new Promise<void>(resolve => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    navigator.serviceWorker.addEventListener('controllerchange', finish, { once: true })
    worker.postMessage({ type: 'SKIP_WAITING' })
    setTimeout(finish, 3000)
  })
  return true
}

/** Unregisters every service worker, empties every Cache Storage bucket, and clears localStorage — the full wipe, for when there is nothing waiting to simply activate. The caller decides what happens after; this module never touches `location` itself. */
export async function resetAppState(): Promise<void> {
  const jobs: Promise<unknown>[] = []
  if ('serviceWorker' in navigator) {
    jobs.push(
      navigator.serviceWorker
        .getRegistrations()
        .then(regs => Promise.all(regs.map(r => r.unregister())))
        .catch(() => {}),
    )
  }
  if ('caches' in window) {
    jobs.push(
      caches
        .keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .catch(() => {}),
    )
  }
  try {
    localStorage.clear()
  } catch {
    // Same guard every other storage call in this app already makes —
    // nothing left to undo if it was never writable.
  }
  await Promise.all(jobs)
}

/** The full recovery: activate a waiting worker if there is one (the targeted, lossless fix), otherwise fall back to the full wipe. Returns which path it took, so a caller can show the right message. */
export async function recoverAppState(): Promise<'activated' | 'reset'> {
  if (await activateWaitingWorker()) return 'activated'
  await resetAppState()
  return 'reset'
}
