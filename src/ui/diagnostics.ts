// A plain-text snapshot of enough browser state to make sense of a report
// like "the page won't load" without remote-debugging access to the device
// it happened on — this app has no analytics and no error-tracking
// service, so a crash on somebody's phone is otherwise completely
// invisible to anyone but them, and this audience (concept: "vom
// Erstklässler bis zum Erwachsenen") mostly has no idea how to pull a
// console log off an iPhone. It renders text on screen for a player to
// copy and hand to us; nothing here is ever sent anywhere on its own.
//
// Lives in ui/, not core/, on purpose — every field it reads (`navigator`,
// `caches`, `location`) is a browser global core/'s own node-environment
// tests don't have (CLAUDE.md: "core/ is pure TypeScript... ui/ hooks touch
// real DOM APIs").

export interface DiagnosticError {
  message: string
  stack?: string
}

async function storageWritable(): Promise<boolean> {
  try {
    localStorage.setItem('__zk_diag__', '1')
    localStorage.removeItem('__zk_diag__')
    return true
  } catch {
    return false
  }
}

async function serviceWorkerInfo(): Promise<string> {
  if (!('serviceWorker' in navigator)) return 'unsupported'
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    if (regs.length === 0) return 'none registered'
    return regs
      .map(r => `${r.scope} (active: ${!!r.active}, waiting: ${!!r.waiting}, installing: ${!!r.installing})`)
      .join('; ')
  } catch (e) {
    return `error reading registrations: ${String(e)}`
  }
}

async function cacheStorageInfo(): Promise<string> {
  if (!('caches' in window)) return 'unsupported'
  try {
    const keys = await caches.keys()
    return keys.length ? keys.join(', ') : 'empty'
  } catch (e) {
    return `error reading caches: ${String(e)}`
  }
}

/** A multi-line plain-text report, meant for a `<textarea>` a player copies out of. `error`, when given, is appended last so the fixed environment lines always come first. */
export async function collectDiagnostics(error?: DiagnosticError): Promise<string> {
  const [storage, sw, cacheKeys] = await Promise.all([storageWritable(), serviceWorkerInfo(), cacheStorageInfo()])
  const lines = [
    'Zahlenkönig crash report',
    `Time: ${new Date().toISOString()}`,
    `URL: ${location.href}`,
    `User agent: ${navigator.userAgent}`,
    `Online: ${navigator.onLine}`,
    `localStorage writable: ${storage}`,
    `Service worker controller: ${navigator.serviceWorker?.controller?.scriptURL ?? 'none'}`,
    `Service worker registrations: ${sw}`,
    `Cache Storage keys: ${cacheKeys}`,
  ]
  if (error) {
    lines.push(`Error: ${error.message}`)
    if (error.stack) lines.push(`Stack:\n${error.stack}`)
  }
  return lines.join('\n')
}
