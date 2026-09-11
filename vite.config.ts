import { defineConfig, type Plugin } from 'vitest/config'
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

// The deployed origin. `base` below is only the path, and a sitemap, a
// canonical link and an og:url all need the absolute URL — so this is the
// one place the host is written down, and index.html repeats it in its
// meta tags (a static HTML file can't read this). `src/seo.test.ts` pins
// the two together so they can't drift.
const siteUrl = 'https://funnygerman.github.io/zahlenkoenig/'

/**
 * Emits `sitemap.xml` at build time.
 *
 * One URL, because the app is one URL: puzzle, language and settings all
 * live in LocalStorage rather than in the address bar, so there is nothing
 * else to list. `lastmod` is the build date rather than a literal in the
 * repo — a hardcoded date is wrong the day after it is written, and this
 * one is right by construction every deploy.
 *
 * Note that this file lands at `/zahlenkoenig/sitemap.xml`, not at the
 * origin root. That is valid: a sitemap may list any URL at or below its
 * own directory, and the single URL here is exactly that. It is not
 * auto-discovered, though — the `Sitemap:` directive would have to live in
 * `https://funnygerman.github.io/robots.txt`, which belongs to the
 * `funnygerman.github.io` repository and not to this one. Submitting the
 * URL once in Google Search Console does the same job.
 */
function sitemap(): Plugin {
  return {
    name: 'zk-sitemap',
    apply: 'build',
    generateBundle() {
      const lastmod = new Date().toISOString().slice(0, 10)
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          '  <url>\n' +
          `    <loc>${siteUrl}</loc>\n` +
          `    <lastmod>${lastmod}</lastmod>\n` +
          '    <changefreq>monthly</changefreq>\n' +
          '  </url>\n' +
          '</urlset>\n',
      })
    },
  }
}

export default defineConfig({
  base: '/zahlenkoenig/',
  plugins: [
    react(),
    sitemap(),
    VitePWA({
      // 'prompt', not the default 'autoUpdate': concept 19.3 explicitly
      // wants an update surfaced as "ein knapper Hinweis... statt eines
      // Popup-Dialogs" rather than either a browser confirm() popup or a
      // silent swap-on-reload — `src/ui/useUpdateAvailable.ts` wires the
      // resulting `needRefresh` flag into that hint.
      registerType: 'prompt',
      injectRegister: null, // registered by hand in main.tsx, alongside the update-hint wiring, not auto-injected
      manifest: {
        name: 'Zahlenkönig – Rechenrätsel und Kopfrechnen-Spiel',
        short_name: 'Zahlenkönig',
        // The same sentence index.html's meta description leads with. An
        // install prompt and an app-store-style listing both surface this,
        // so it states the rule rather than restating the name — and it is
        // German, matching `lang` below and the served HTML, even though
        // the app itself runs in three languages off one URL.
        description:
          'Erreiche mit zwei bis vier Zahlen ein Ziel und benutze dabei jede Zahl genau einmal. Plus, Minus, Mal, Geteilt und Klammern – von der ersten Klasse bis zum Kopfrechen-Profi.',
        lang: 'de',
        dir: 'ltr',
        // Used by app catalogues that read web manifests; both are on the
        // spec's own registered-category list, so neither is invented.
        categories: ['education', 'games'],
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
        // The sharing image is 36 KB that no player ever downloads: it is
        // fetched by link-preview scrapers (Open Graph / Twitter), which
        // never reach the service worker, and it is never rendered inside
        // the app. Left in, it was 13% of the precache for nothing.
        // `sitemap.xml` isn't matched by the patterns above anyway, and
        // shouldn't be — same reasoning.
        globIgnores: ['og-image.png'],
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
