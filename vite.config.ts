import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/zahlenkoenig/',
  plugins: [react()],
  test: {
    // core/ is pure TypeScript (CLAUDE.md), no DOM needed for its tests.
    // ui/ hooks (useDrag.ts and friends) touch real DOM APIs — pointer
    // capture, getBoundingClientRect — so they get jsdom instead.
    environment: 'node',
    environmentMatchGlobs: [['src/ui/**', 'jsdom']],
    setupFiles: ['src/ui/vitest.setup.ts'],
  },
})
