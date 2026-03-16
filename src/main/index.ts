import { app, BrowserWindow } from 'electron'
import { initLog } from '@/utils/log'
import { initUpdater } from './updater'
import { createWindow } from './window'
import { registerUpdaterIpc } from './ipc'
import { viewManager } from './view-manager'

initLog()

export { viewManager }

app.whenReady().then(() => {
  const win = createWindow()

  registerUpdaterIpc()

  initUpdater({
    updateServerURL: process.env.UPDATE_SERVER_URL ?? '',
    autoCheckOnStartup: process.env.AUTO_CHECK_ON_STARTUP !== 'false',
    autoDownload: process.env.AUTO_DOWNLOAD === 'true',
    checkInterval: parseInt(process.env.UPDATE_CHECK_INTERVAL ?? '3600000', 10),
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
