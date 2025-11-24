import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (import.meta.env.DEV) {
  const ow = console.warn
  console.warn = (...args: unknown[]) => {
    const m = typeof args[0] === 'string' ? args[0] : ''
    if (m.includes('using deprecated parameters for the initialization function')) return
    if (m.includes('using deprecated parameters for `initSync()`')) return
    ow(...args)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
