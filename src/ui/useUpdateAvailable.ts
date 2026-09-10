// Concept 19.3's update surface: "ein knapper Hinweis in der Kopfzeile
// ('Aktualisieren', 12.7-Menü) statt eines Popup-Dialogs" — no confirm()
// popup, no silent swap-on-reload either. `vite-plugin-pwa`'s own React
// hook already tracks exactly the one flag this needs (`needRefresh`); this
// wrapper only narrows its wider API (offline-ready state, the setters)
// down to the two things Header.tsx actually renders.
import { useRegisterSW } from 'virtual:pwa-register/react'

export function useUpdateAvailable() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  return { available: needRefresh, update: () => { void updateServiceWorker(true) } }
}
