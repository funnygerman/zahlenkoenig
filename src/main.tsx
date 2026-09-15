import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Game } from './ui/Game'
import { ErrorBoundary } from './ui/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Game />
    </ErrorBoundary>
  </StrictMode>,
)
