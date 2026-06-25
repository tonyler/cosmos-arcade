import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import './arcade/arcade.css'
import ArcadeApp from './arcade/ArcadeApp'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ArcadeApp />
  </React.StrictMode>,
)
