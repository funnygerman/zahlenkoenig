import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  base: '/zahlenkoenig/',
  plugins: [react()],
  build: {
    // index-v2.html is the v2 preview harness (main-v2.tsx's own note on
    // why) — building it alongside v1's index.html means every push to
    // main deploys it too, at /zahlenkoenig/index-v2.html, so a v2 step can
    // be tried on a real device instead of only through an Artifact's
    // sandboxed iframe.
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        v2: resolve(__dirname, 'index-v2.html'),
      },
    },
  },
  test: {
    // core/ is pure TypeScript (CLAUDE.md), no DOM needed for its tests.
    // ui/ hooks (useDrag.ts and friends) touch real DOM APIs — pointer
    // capture, getBoundingClientRect — so they get jsdom instead.
    environment: 'node',
    environmentMatchGlobs: [['src/ui/**', 'jsdom']],
    setupFiles: ['src/ui/vitest.setup.ts'],
  },
})
