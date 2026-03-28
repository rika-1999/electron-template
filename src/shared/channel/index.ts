import { ChannelApiImpl, type Port as Port_ } from './impl'
import { ChannelTimeoutError } from './error'
import type { ChannelAPI, Handler, InitOptions } from './types'

const channelRegistry = new Map<number, Port_>()

export class Channel implements ChannelAPI {
  private port: Port_ | null = null
  private webContentsId: number | null = null
  private api: ChannelApiImpl

  constructor() {
    if (process.env.PROCESS_TYPE === 'renderer') {
      this.api = window.__app_channel__ as unknown as ChannelApiImpl
    } else {
      this.api = new ChannelApiImpl()
    }
  }

  setPort(port: Port_): void {
    this.port = port
    this.api.setPort(port)
  }

  private async registerChannelHandler() {
    const { ipcMain } = await import('electron')

    ipcMain.handle('__channel_request_port__', (event) => {
      if (!channelRegistry.has(event.sender.id)) {
        throw new Error('Channel port not initialized')
      }
      return channelRegistry.get(event.sender.id)
    })
  }

  private async setupMain(webContentsId: number): Promise<void> {
    await this.registerChannelHandler()
    this.webContentsId = webContentsId
    if (!this.port) {
      const { MessageChannelMain } = await import('electron')
      const { port1, port2 } = new MessageChannelMain()
      this.setPort(port1)
      channelRegistry.set(webContentsId, port2)
    }
  }

  private async setupPreload(): Promise<void> {
    const { ipcRenderer } = await import('electron')
    const port = (await ipcRenderer.invoke('__channel_request_port__')) as MessagePort
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
    if (this.port && 'close' in this.port) {
      ;(this.port as Electron.MessagePortMain).close()
    }
    if (this.webContentsId !== null) {
      channelRegistry.delete(this.webContentsId)
    }
    this.api.clearPending()
    this.port = null
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
