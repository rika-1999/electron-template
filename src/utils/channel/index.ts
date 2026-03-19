import { deserialize, serialize } from '@/utils/serialize'
import { ChannelTimeoutError } from './error'
import type { ChannelAPI } from '@/shared/channel'
import type { ChannelMessage, ChannelRequest, ChannelResponse } from './types'

export type { ChannelMessage, ChannelRequest, ChannelResponse } from './types'
export type { ChannelAPI, ChannelCenter, Handler, AnyRequestHandler } from '@/shared/channel'

type Handler = (payload: unknown) => Promise<unknown> | unknown
type ResponseHandler = (response: ChannelResponse) => void
type Port = Electron.MessagePortMain | MessagePort

function generateId(method: string): string {
  return `${method}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ─── Channel Registry ─────────────────────────────────────────────────────────

const channelRegistry = new Map<number, Port>()
let handlerRegistered = false

// ─── Channel ────────────────────────────────────────────────────────────────

export interface InitOptions {
  webContentsId?: number
  expose?: boolean
  defaultTimeout?: number
}

export class Channel {
  private port: Port | null = null
  private handlers = new Map<string, Handler>()
  private pending = new Map<string, ResponseHandler>()
  private timeouts = new Map<string, ReturnType<typeof setTimeout>>()
  private webContentsId: number | null = null
  private defaultTimeout: number = 10000

  setPort(port: Port): void {
    this.port = port
    if (process.env.PROCESS_TYPE === 'main') {
      ;(port as Electron.MessagePortMain).on(
        'message',
        (e: Electron.MessageEvent) => void this.dispatch(e.data),
      )
    } else {
      ;(port as MessagePort).onmessage = (e: MessageEvent<ChannelMessage>) =>
        void this.dispatch(e.data)
    }
    port.start()
  }

  private async registerChannelHandler() {
    if (handlerRegistered) return
    handlerRegistered = true
    const { ipcMain } = await import('electron')

    ipcMain.handle('__channel_request_port__', (event) => {
      if (!channelRegistry.has(event.sender.id)) {
        throw new Error('Channel port not initialized')
      }
      return channelRegistry.get(event.sender.id)
    })
  }

  // ─── Message dispatch ────────────────────────────────────────────────────

  private async dispatch(msg: ChannelMessage): Promise<void> {
    if (msg.type === 'request') {
      const handler = this.handlers.get(msg.method)
      let response: ChannelResponse
      if (!handler) {
        response = { id: msg.id, type: 'response', error: `No handler for method: ${msg.method}` }
      } else {
        try {
          const result = await handler(msg.payload)
          response = { id: msg.id, type: 'response', payload: result }
        } catch (err) {
          response = { id: msg.id, type: 'response', error: serialize(err) }
        }
      }
      this.port!.postMessage(response)
    } else {
      const resolve = this.pending.get(msg.id)
      if (resolve) {
        this.pending.delete(msg.id)
        const timeoutId = this.timeouts.get(msg.id)
        if (timeoutId) {
          clearTimeout(timeoutId)
          this.timeouts.delete(msg.id)
        }
        resolve(msg)
      }
    }
  }

  // ─── Setup ───────────────────────────────────────────────────────────────

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

  // ─── Init ────────────────────────────────────────────────────────────────

  async init(options: InitOptions = {}): Promise<void> {
    if (options.defaultTimeout !== undefined) {
      this.defaultTimeout = options.defaultTimeout
    }
    if (process.env.PROCESS_TYPE === 'main') {
      if (options.webContentsId === undefined)
        throw new Error('webContentsId is required in main process')
      await this.setupMain(options.webContentsId)
    } else if (process.env.PROCESS_TYPE === 'preload') {
      await this.setupPreload()
      if (options.expose !== false) {
        const { contextBridge } = await import('electron')
        contextBridge.exposeInMainWorld('__app_channel__', {
          request: (method: string, payload?: unknown, timeout?: number) =>
            this.request(method, payload, timeout),
          onRequest: (method: string, handler: Handler) => this.onRequest(method, handler),
          offRequest: (method: string) => this.offRequest(method),
        })
      }
    }
  }

  // ─── API ─────────────────────────────────────────────────────────────────

  request(method: string, payload?: unknown, timeout?: number): Promise<unknown> {
    if (process.env.PROCESS_TYPE === 'renderer') {
      return window.__app_channel__.request(method, payload, timeout)
    }
    return new Promise((resolve, reject) => {
      if (!this.port) {
        reject(new Error('Channel port not initialized'))
        return
      }
      const id = generateId(method)
      this.pending.set(id, (res) => {
        if (res.error) reject(deserialize<Error>(res.error))
        else resolve(res.payload)
      })
      const msg: ChannelRequest = { id, type: 'request', method, payload }
      this.port.postMessage(msg)

      const actualTimeout = timeout ?? this.defaultTimeout
      const timeoutId = setTimeout(() => {
        this.pending.delete(id)
        this.timeouts.delete(id)
        reject(new ChannelTimeoutError(method))
      }, actualTimeout)
      this.timeouts.set(id, timeoutId)
    })
  }

  onRequest(method: string, handler: Handler): void {
    if (process.env.PROCESS_TYPE === 'renderer') {
      window.__app_channel__.onRequest(method, handler)
      return
    }
    this.handlers.set(method, handler)
  }

  offRequest(method: string): void {
    if (process.env.PROCESS_TYPE === 'renderer') {
      window.__app_channel__.offRequest(method)
      return
    }
    this.handlers.delete(method)
  }

  destroy(): void {
    if (this.port && 'close' in this.port) {
      ;(this.port as Electron.MessagePortMain).close()
    }
    if (this.webContentsId !== null) {
      channelRegistry.delete(this.webContentsId)
    }
    this.timeouts.forEach((timeoutId) => clearTimeout(timeoutId))
    this.timeouts.clear()
    this.pending.forEach((resolve, id) => {
      resolve({ id, type: 'response', error: 'Channel destroyed' })
    })
    this.pending.clear()
    this.handlers.clear()
    this.port = null
  }
}

// ─── Default instance (backward compatibility) ───────────────────────────────

export const channel = new Channel()

// ─── Global type declarations ────────────────────────────────────────────────────

declare global {
  interface Window {
    __app_channel__: ChannelAPI
  }
}
