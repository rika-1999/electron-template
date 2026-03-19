import React from 'react'
import { logger } from '@/utils/log'

const log = logger(__SOURCE_FILE__)

export default function App() {

  log.info('App rendered')
  return (
    <div className="app">
      <h1>Electron App</h1>
    </div>
  )
}
