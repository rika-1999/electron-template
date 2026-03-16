import { BrowserWindow } from 'electron'
import { env } from '@/utils/env'
import { paths } from './utils/paths'
import { channel } from '@/utils/channel'

export function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: paths.getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (env.isDev()) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(paths.getRendererPath())
  }

  channel.init({ webContentsId: win.webContents.id })

  return win
}
