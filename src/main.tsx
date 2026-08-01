import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { requestPersistentStorage } from './storage/db'

// Fire-and-forget: ask the browser to make IndexedDB eviction-proof.
// The grant status is surfaced on the Overview screen.
void requestPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
