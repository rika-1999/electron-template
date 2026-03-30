import { ChannelApiImpl, type Port as PortType } from './impl'
import type { ChannelAPI, InitOptions } from './types'

type MessageChannel = { port1: Electron.MessagePortMain; port2: Electron.MessagePortMain }

type ChannelEntry = {
  port2: Electron.MessagePortMain | null
  resetPort: (messageChannel: MessageChannel) => void
}

const channelRegistry = (() => {
  const registry = new Map<number, ChannelEntry>()

  if (process.env.PROCESS_TYPE === 'main') {
    ;(async () => {
      const { ipcMain, webContents } = await import('electron')

      ipcMain.handle('__channel_request_port__', async (event) => {
        const webContentsId = event.sender.id
        let entry = registry.get(webContentsId)

        if (!entry) {
          throw new Error(`Channel not initialized for webContentsId: ${webContentsId}`)
        }

        const wc = webContents.fromId(webContentsId)
        if (!wc) {
          throw new Error('WebContents not found')
        }

        if (entry.port2 === null) {
          const { MessageChannelMain } = await import('electron')
          const { port1, port2 } = new MessageChannelMain()
          entry.resetPort({ port1, port2 })
          entry = registry.get(webContentsId)!
        }

        const portToTransfer = entry.port2!
        entry.port2 = null

        wc.postMessage('__channel_port_transfer__', null, [portToTransfer])
      })
    })()
  }

  return registry
})()

export class Channel implements ChannelAPI {
  private port: PortType | null = null
  private webContentsId: number | null = null
  private api: ChannelApiImpl

  constructor() {
    if (process.env.PROCESS_TYPE === 'renderer') {
      this.api = window.__app_channel__ as unknown as ChannelApiImpl
    } else {
      this.api = new ChannelApiImpl()
    }
  }

  private closePort(port: PortType | null): void {
    if (port && 'close' in port) {
      try {
        ;(port as Electron.MessagePortMain).close()
      } catch {
        // 忽略清理错误
      }
    }
    this.port = null
  }

  setPort(port: PortType): void {
    this.closePort(this.port)
    this.port = port
    this.api.setPort(port)
  }

  private resetPort(messageChannel: MessageChannel): void {
    this.closePort(this.port)
    this.port = messageChannel.port1
    this.api.setPort(messageChannel.port1)
    channelRegistry.set(this.webContentsId!, {
      port2: messageChannel.port2,
      resetPort: this.resetPort.bind(this),
    })
  }

  private async setupMain(webContentsId: number): Promise<void> {
    this.webContentsId = webContentsId
    if (!this.port) {
      const { MessageChannelMain } = await import('electron')
      const { port1, port2 } = new MessageChannelMain()
      this.resetPort({ port1, port2 })
    }
  }

  private async setupPreload(): Promise<void> {
    if (this.port !== null) {
      throw new Error('Channel port already initialized, cannot request again')
    }

    const { ipcRenderer } = await import('electron')

    const portPromise = new Promise<MessagePort>((resolve, reject) => {
      const handler = (event: Electron.IpcRendererEvent) => {
        ipcRenderer.off('__channel_port_transfer__', handler)
        resolve(event.ports[0])
      }

      ipcRenderer.on('__channel_port_transfer__', handler)

      setTimeout(() => {
        ipcRenderer.off('__channel_port_transfer__', handler)
        reject(new Error('Channel port transfer timeout after 5000ms'))
      }, 5000)
    })

    await ipcRenderer.invoke('__channel_request_port__')

    const port = await portPromise
    this.setPort(port)
  }

  async init(options: InitOptions = {}): Promise<void> {
    if (options.defaultTimeout !== undefined) {
      this.api.setDefaultTimeout(options.defaultTimeout)
    }
    if (process.env.PROCESS_TYPE === 'main') {
      if (options.webContentsId === undefined) {
        throw new Error('webContentsId is required in main process')
      }
      await this.setupMain(options.webContentsId)
    } else if (process.env.PROCESS_TYPE === 'preload') {
      await this.setupPreload()
      if (options.expose !== false) {
        const { contextBridge } = await import('electron')
        contextBridge.exposeInMainWorld('__app_channel__', {
          request: this.api.request.bind(this.api),
          onRequest: this.api.onRequest.bind(this.api),
          offRequest: this.api.offRequest.bind(this.api),
          setDefaultTimeout: this.api.setDefaultTimeout.bind(this.api),
        })
      }
    }
  }

  request(method: string, payload?: unknown, timeout?: number): Promise<unknown> {
    return this.api.request(method, payload, timeout)
  }

  onRequest(method: string, handler: (payload: unknown) => unknown): void {
    this.api.onRequest(method, handler)
  }

  offRequest(method: string): void {
    this.api.offRequest(method)
  }

  setDefaultTimeout(timeout: number): void {
    this.api.setDefaultTimeout(timeout)
  }

  destroy(): void {
    if (process.env.PROCESS_TYPE === 'renderer') {
      return
    }
    if (this.webContentsId !== null) {
      channelRegistry.delete(this.webContentsId)
    }
    this.closePort(this.port)
    this.api.clearPending()
    this.port = null
    this.webContentsId = null
  }
}

export const channel = new Channel()

export * from './types'
export * from './error'

declare global {
  interface Window {
    __app_channel__: ChannelAPI
  }
}
