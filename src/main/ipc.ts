import { autoUpdater } from 'electron-updater'
import { channel } from '@/utils/channel'
import { getUpdater } from './updater'

export function registerUpdaterIpc(): void {
  channel.on('updater:checkForUpdates', () => {
    return getUpdater()?.checkForUpdates()
  })

  channel.on('updater:quitAndInstall', () => {
    getUpdater()?.quitAndInstall()
  })

  autoUpdater.on('update-available', (info) => {
    channel.request('updater:updateAvailable', info)
  })
  autoUpdater.on('update-downloaded', (info) => {
    channel.request('updater:updateDownloaded', info)
  })
}
