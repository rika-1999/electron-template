import { UpdaterApi } from '@/shared/services'
import { autoUpdater } from 'electron-updater'

class UpdaterService extends UpdaterApi {
  async checkForUpdates(): Promise<void> {
    await autoUpdater.checkForUpdates()
  }

  async quitAndInstall(): Promise<void> {
    autoUpdater.quitAndInstall()
  }
}

export const updaterService = new UpdaterService()
