// The recovery action behind an ErrorBoundary's "Reset & reload" button
// (and index.html's own pre-mount fallback, which duplicates this logic in
// plain JS because it has to survive the very failure this module is meant
// to fix — see that file's own comment). Undoes everything a stuck service
// worker or a corrupted localStorage value could be responsible for:
// unregisters every service worker, empties every Cache Storage bucket,
// and clears localStorage. The caller decides what happens after — this
// module never touches `location` itself.
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
