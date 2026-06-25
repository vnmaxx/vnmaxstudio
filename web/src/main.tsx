import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const accent = localStorage.getItem('cfg_accent')
const bg     = localStorage.getItem('cfg_bg')
const font   = localStorage.getItem('cfg_font')
if (accent) document.documentElement.style.setProperty('--accent', accent)
if (bg)     { document.documentElement.style.setProperty('--bg', bg); document.documentElement.style.setProperty('--bg-primary', bg) }
if (font)   document.body.style.fontSize = font

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
