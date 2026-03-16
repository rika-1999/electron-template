import type { ChannelMessage, ChannelRequest, ChannelResponse } from './types'

export type { ChannelMessage, ChannelRequest, ChannelResponse, ChannelAPI } from './types'

type Handler = (payload: unknown) => Promise<unknown> | unknown
type ResponseHandler = (response: ChannelResponse) => void
type Port = Electron.MessagePortMain | MessagePort

function generateId(method: string): string {
  return `${method}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ─── ChannelInstance ─────────────────────────────────────────────────────────

export interface InitOptions {
  webContentsId?: number
  expose?: boolean
}

export class ChannelInstance {
  private port: Port | null = null
  private handlers = new Map<string, Handler>()
  private pending = new Map<string, ResponseHandler>()

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
          const message = err instanceof Error ? err.message : String(err)
          response = { id: msg.id, type: 'response', error: message }
        }
      }
      this.port!.postMessage(response)
    } else {
      const resolve = this.pending.get(msg.id)
      if (resolve) {
        this.pending.delete(msg.id)
        resolve(msg)
      }
    }
  }

  // ─── Setup ───────────────────────────────────────────────────────────────

  async setupMain(webContentsId: number): Promise<void> {
    const { MessageChannelMain, webContents } = await import('electron')
    const wc = webContents.fromId(webContentsId)
    if (!wc) throw new Error(`webContents not found: ${webContentsId}`)

    const { port1, port2 } = new MessageChannelMain()
    this.port = port1

    port1.on('message', (event) => void this.dispatch(event.data as ChannelMessage))
    port1.start()

    wc.postMessage('__channel_port__', null, [port2])
  }

  async setupRenderer(): Promise<void> {
    const { ipcRenderer } = await import('electron')
    ipcRenderer.on('__channel_port__', (event) => {
      const p = event.ports[0]
      this.port = p
      p.onmessage = (e: MessageEvent<ChannelMessage>) => void this.dispatch(e.data)
      p.start()
    })
  }

  // ─── Init ────────────────────────────────────────────────────────────────

  async init(options: InitOptions = {}): Promise<void> {
    if (process.env.PROCESS_TYPE === 'main') {
      if (options.webContentsId === undefined)
        throw new Error('webContentsId is required in main process')
      await this.setupMain(options.webContentsId)
    } else if (process.env.PROCESS_TYPE === 'preload') {
      await this.setupRenderer()
      if (options.expose !== false) {
        const { contextBridge } = await import('electron')
        contextBridge.exposeInMainWorld('channel', {
          request: (method: string, payload?: unknown) => this.request(method, payload),
          on: (method: string, handler: Handler) => this.on(method, handler),
          off: (method: string) => this.off(method),
        })
      }
    }
  }

  // ─── API ─────────────────────────────────────────────────────────────────

  request(method: string, payload?: unknown): Promise<unknown> {
    if (process.env.PROCESS_TYPE === 'renderer') {
      return window.channel.request(method, payload)
    }
    return new Promise((resolve, reject) => {
      if (!this.port) {
        reject(new Error('Channel port not initialized'))
        return
      }
      const id = generateId(method)
      this.pending.set(id, (res) => {
        if (res.error) reject(new Error(res.error))
        else resolve(res.payload)
      })
      const msg: ChannelRequest = { id, type: 'request', method, payload }
      this.port.postMessage(msg)
    })
  }

  on(method: string, handler: Handler): void {
    if (process.env.PROCESS_TYPE === 'renderer') {
      window.channel.on(method, handler)
      return
    }
    this.handlers.set(method, handler)
  }

  off(method: string): void {
    if (process.env.PROCESS_TYPE === 'renderer') {
      window.channel.off(method)
      return
    }
    this.handlers.delete(method)
  }

  destroy(): void {
    if (this.port && 'close' in this.port) {
      ;(this.port as Electron.MessagePortMain).close()
    }
    for (const [id, resolve] of this.pending) {
      resolve({ id, type: 'response', error: 'Channel destroyed' })
    }
    this.pending.clear()
    this.handlers.clear()
    this.port = null
  }
}

// ─── Default instance (backward compatibility) ───────────────────────────────

const defaultInstance = new ChannelInstance()

export const channel = {
  init: (options?: InitOptions) => defaultInstance.init(options),
  request: (method: string, payload?: unknown) => defaultInstance.request(method, payload),
  on: (method: string, handler: Handler) => defaultInstance.on(method, handler),
  off: (method: string) => defaultInstance.off(method),
}
