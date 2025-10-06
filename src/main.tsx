
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// Optional: try to register SW if available at site root
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
  })
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
