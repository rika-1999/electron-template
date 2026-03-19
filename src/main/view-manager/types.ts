import type { WebContentsView, BrowserWindow, BaseWindow } from 'electron'
import type { Channel } from '@/utils/channel'
import type { ViewState, ViewType, ManagedViewEventMap } from '@/shared/view'

export interface ManagedView {
  readonly id: string
  readonly type: ViewType
  readonly url: string
  readonly webContentsView: WebContentsView
  readonly channel: Channel
  hostWindow: BrowserWindow | BaseWindow | null
  state: ViewState
  on<K extends keyof ManagedViewEventMap>(event: K, listener: ManagedViewEventMap[K]): void
  off<K extends keyof ManagedViewEventMap>(event: K, listener: ManagedViewEventMap[K]): void
  once<K extends keyof ManagedViewEventMap>(event: K, listener: ManagedViewEventMap[K]): void
  attachTo(window: BrowserWindow | BaseWindow, bounds?: Electron.Rectangle): void
  detach(): void
  toggleDevTools(): void
}
