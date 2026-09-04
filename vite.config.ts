import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/zahlenkoenig/',
  plugins: [react()],
  test: {
    // core/ is pure TypeScript (CLAUDE.md), no DOM needed for its tests.
    environment: 'node',
  },
})
