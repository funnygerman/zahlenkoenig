import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Game } from './ui/Game'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Game />
  </StrictMode>,
)
