// v2 preview harness (index-v2.html) — not part of the shipped v1 app
// (src/main.tsx), and not itself part of v2's implementation. Exists only
// so each v2 step can be clicked through as it lands, ahead of v2 having
// its own settings/routing to reach it from.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Game } from './ui/Game'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Game />
  </StrictMode>,
)
