import type { WebContentsView, BrowserWindow, BaseWindow } from 'electron'
import type { ChannelInstance } from '@/utils/channel'
import type { ViewState, ViewType } from '@/shared/view'

export interface ManagedView {
  id: string
  type: ViewType
  url: string
  webContentsView: WebContentsView
  channel: ChannelInstance
  hostWindow: BrowserWindow | BaseWindow | null
  state: ViewState
}

export type Handler = (payload: unknown) => Promise<unknown> | unknown
export type AnyMessageHandler = (viewId: string, payload: unknown) => Promise<unknown> | unknown
