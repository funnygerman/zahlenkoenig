// Generates public/*.png (and favicon.ico) from public/crown.svg (concept
// 19.2, the app-icon blocker CLAUDE.md's "Next v2 step" resolved). Run with
// `npx pwa-assets-generator`; re-run after any change to crown.svg.
//
// Based on the package's own `minimal` preset (transparent 64/192/512,
// maskable 512, apple-touch 180, favicon.ico) — the one addition is a solid
// background on the maskable icon. Its default (bare `minimal` preset) left
// the padding transparent, which a maskable icon can't afford: an Android
// launcher's mask reveals whatever's behind that padding, not a deliberate
// color, so a transparent one shows through to the system's own background
// rather than the app's. `--zk-bg` (tokens.css, hue 214) is what the
// manifest's own `background_color` already is (concept 19.1) — same value
// here, in hex, since sharp's `resizeOptions.background` can't read a CSS
// custom property.
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { fit: 'contain', background: '#fafbfc' },
    },
  },
  images: ['public/crown.svg'],
})
