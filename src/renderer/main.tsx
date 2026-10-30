import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

if (!/Mac/.test(navigator.platform)) {
  document.documentElement.style.setProperty('--link-hint', "'Ctrl+click to open'")
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}
