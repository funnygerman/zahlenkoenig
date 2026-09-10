import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// concept 19: manifest (19.1), icons (19.2 — public/*.png, generated from
// public/crown.svg by pwa-assets.config.ts, `npx pwa-assets-generator`),
// service worker (19.3). `vite-plugin-pwa` is build tooling, not a runtime
// dependency of the game itself (concept 19.3's own case for it over a
// hand-written ~20-line worker), so it doesn't touch decisions.md's "no
// library for the core" rule the way a runtime dependency would.
//
// background_color/theme_color are --zk-bg/--zk-accent (tokens.css, hue
// 214) as fixed hex — a manifest can't read a CSS custom property, and a
// PWA manifest parser is safer targeted with plain hex than the modern
// space-separated hsl() syntax tokens.css itself uses. If --hue ever
// changes, these two values (and index.html's own theme-color meta, and
// pwa-assets.config.ts's maskable background) have to change by hand along
// with it — tokens.css's own --hue line has a comment pointing here.
const themeColor = '#2962ae' // --zk-accent
const backgroundColor = '#fafbfc' // --zk-bg

export default defineConfig({
  base: '/zahlenkoenig/',
  plugins: [
    react(),
    VitePWA({
      // 'prompt', not the default 'autoUpdate': concept 19.3 explicitly
      // wants an update surfaced as "ein knapper Hinweis... statt eines
      // Popup-Dialogs" rather than either a browser confirm() popup or a
      // silent swap-on-reload — `src/ui/useUpdateAvailable.ts` wires the
      // resulting `needRefresh` flag into that hint.
      registerType: 'prompt',
      injectRegister: null, // registered by hand in main.tsx, alongside the update-hint wiring, not auto-injected
      manifest: {
        name: 'Zahlenkönig',
        short_name: 'Zahlenkönig',
        description: 'Zahlenkönig – Mathematisches Rätselspiel',
        start_url: '/zahlenkoenig/',
        scope: '/zahlenkoenig/',
        display: 'standalone',
        background_color: backgroundColor,
        theme_color: themeColor,
        // concept 19.1: "nicht portrait: 12.6 unterstützt Quer- und
        // Hochformat gleichwertig, das Manifest darf das nicht einschränken."
        orientation: 'any',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App-shell only (concept 19.3: "kein Runtime-Caching von Daten" —
        // core/ generates puzzles offline from pure JS, there's no data to
        // cache). Everything the build emits, precached; no runtime
        // caching rules at all.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  test: {
    // core/ is pure TypeScript (CLAUDE.md), no DOM needed for its tests.
    // ui/ hooks (useDrag.ts and friends) touch real DOM APIs — pointer
    // capture, getBoundingClientRect — so they get jsdom instead.
    environment: 'node',
    environmentMatchGlobs: [['src/ui/**', 'jsdom']],
    setupFiles: ['src/ui/vitest.setup.ts'],
  },
})
