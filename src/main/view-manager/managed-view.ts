import { WebContentsView } from 'electron'
import { ChannelInstance } from '@/utils/channel'
import type { ViewState, ViewType } from '@/shared/view'
import type { ManagedView as IManagedView } from './types'
import { paths } from '../utils/paths'

export class ManagedView implements IManagedView {
  readonly id: string
  type: ViewType
  url: string
  readonly webContentsView: WebContentsView
  readonly channel: ChannelInstance
  hostWindow: Electron.BrowserWindow | Electron.BaseWindow | null = null

  private _loaded = false
  private _onStateChanged: () => void
  private _onReady: () => void

  constructor(
    id: string,
    options: { url: string; type: ViewType },
    onStateChanged: () => void,
    onReady: () => void,
  ) {
    this.id = id
    this.type = options.type
    this.url = options.url
    this._onStateChanged = onStateChanged
    this._onReady = onReady

    this.webContentsView = new WebContentsView({
      webPreferences: {
        preload: paths.getViewPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        ...(options.type === 'background' && { offscreen: true }),
      },
    })

    this.channel = new ChannelInstance()

    this.setupWebContentsListeners()
  }

  private setupWebContentsListeners(): void {
    const wc = this.webContentsView.webContents

    wc.on('did-finish-load', () => {
      this._loaded = true
      this._onReady()
      this._onStateChanged()
    })

    wc.on('focus', () => this._onStateChanged())
    wc.on('blur', () => this._onStateChanged())
  }

  async load(): Promise<void> {
    await this.webContentsView.webContents.loadURL(this.url)
  }

  async initChannel(): Promise<void> {
    await this.channel.setupMain(this.webContentsView.webContents.id)
  }

  get state(): ViewState {
    const wc = this.webContentsView.webContents
    const isDestroyed = wc.isDestroyed()
    return {
      id: this.id,
      type: this.type,
      url: this.url,
      bounds: this.type === 'background' ? null : this.webContentsView.getBounds(),
      visible: this.type !== 'background' && !isDestroyed,
      focused: !isDestroyed && wc.isFocused?.() === true,
      loaded: this._loaded,
    }
  }

  destroy(): void {
    this.channel.destroy()
    const wc = this.webContentsView.webContents
    if (!wc.isDestroyed()) {
      wc.close()
    }
  }
}
