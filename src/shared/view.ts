import type { Channel } from '@/utils/channel'

export type ViewType = 'embedded' | 'detached' | 'background'

export interface ViewState {
  id: string
  type: ViewType
  url: string
  bounds: Electron.Rectangle | null
  visible: boolean
  focused: boolean
  loaded: boolean
}

export interface ViewOptions {
  url: string
  type?: ViewType
  bounds?: Electron.Rectangle
  channel?: Channel
  preload?: string
  id?: string
}

export interface ManagedViewEventMap {
  'state-changed': (state: ViewState) => void
  'ready': () => void
}

export interface ViewEventMap {
  'view-created': (viewId: string, state: ViewState) => void
  'view-destroyed': (viewId: string) => void
  'view-state-changed': (viewId: string, state: ViewState) => void
  'view-ready': (viewId: string) => void
}
