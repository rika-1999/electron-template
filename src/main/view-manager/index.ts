import { BaseWindow } from 'electron'
import { TypedEmitter } from '@/utils/typed-emitter'
import { ManagedView } from './managed-view'
import type { ViewOptions, ViewState, ViewEventMap } from '@/shared/view'
import type { Handler, AnyMessageHandler } from './types'

function generateViewId(): string {
  return `view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export class ViewManager extends TypedEmitter<ViewEventMap> {
  private views = new Map<string, ManagedView>()
  private anyMessageHandlers = new Map<string, AnyMessageHandler>()

  // ─── View lifecycle ────────────────────────────────────────────────────

  async createView(options: ViewOptions): Promise<string> {
    const id = generateViewId()
    const type = options.type ?? 'embedded'

    const view = new ManagedView(
      id,
      { url: options.url, type },
      () => this.emit('view-state-changed', id, view.state),
      () => this.emit('view-ready', id),
    )

    this.views.set(id, view)

    // Attach to window based on type
    if (type === 'embedded' && options.parentWindow) {
      ;(options.parentWindow.contentView as { addChildView: (v: unknown) => void }).addChildView(
        view.webContentsView,
      )
      view.hostWindow = options.parentWindow
      if (options.bounds) {
        view.webContentsView.setBounds(options.bounds)
      }
    } else if (type === 'detached') {
      const baseWin = new BaseWindow(options.windowOptions ?? {})
      baseWin.setContentView(view.webContentsView)
      view.hostWindow = baseWin
    }
    // background: no window attachment

    // Load URL and init channel
    await view.load()
    await view.initChannel()

    // Apply any registered onAnyMessage handlers
    for (const [method, handler] of this.anyMessageHandlers) {
      view.channel.on(method, (payload: unknown) => handler(id, payload))
    }

    this.emit('view-created', id, view.state)
    return id
  }

  destroyView(viewId: string): void {
    const view = this.views.get(viewId)
    if (!view) return

    // Remove from host window
    if (view.hostWindow && view.type === 'embedded') {
      const contentView = view.hostWindow.contentView as {
        removeChildView?: (v: unknown) => void
      }
      contentView.removeChildView?.(view.webContentsView)
    } else if (view.hostWindow && view.type === 'detached') {
      ;(view.hostWindow as BaseWindow).destroy()
    }

    view.destroy()
    this.views.delete(viewId)
    this.emit('view-destroyed', viewId)
  }

  // ─── Query ─────────────────────────────────────────────────────────────

  getView(viewId: string): ManagedView | undefined {
    return this.views.get(viewId)
  }

  getViewState(viewId: string): ViewState | undefined {
    return this.views.get(viewId)?.state
  }

  listViews(): ViewState[] {
    return Array.from(this.views.values()).map((v) => v.state)
  }

  // ─── Window operations ─────────────────────────────────────────────────

  attachToWindow(
    viewId: string,
    window: Electron.BrowserWindow,
    bounds?: Electron.Rectangle,
  ): void {
    const view = this.views.get(viewId)
    if (!view) return

    // Remove from current host if embedded
    if (view.hostWindow && view.type === 'embedded') {
      const contentView = view.hostWindow.contentView as {
        removeChildView?: (v: unknown) => void
      }
      contentView.removeChildView?.(view.webContentsView)
    }

    ;(window.contentView as { addChildView: (v: unknown) => void }).addChildView(
      view.webContentsView,
    )
    view.hostWindow = window
    view.type = 'embedded'

    if (bounds) {
      view.webContentsView.setBounds(bounds)
    }

    this.emit('view-state-changed', viewId, view.state)
  }

  detachToWindow(
    viewId: string,
    windowOptions?: Electron.BaseWindowConstructorOptions,
  ): BaseWindow | undefined {
    const view = this.views.get(viewId)
    if (!view) return undefined

    // Remove from current host if embedded
    if (view.hostWindow && view.type === 'embedded') {
      const contentView = view.hostWindow.contentView as {
        removeChildView?: (v: unknown) => void
      }
      contentView.removeChildView?.(view.webContentsView)
    }

    const baseWin = new BaseWindow(windowOptions ?? {})
    baseWin.setContentView(view.webContentsView)
    view.hostWindow = baseWin
    view.type = 'detached'

    this.emit('view-state-changed', viewId, view.state)
    return baseWin
  }

  // ─── Built-in channel ──────────────────────────────────────────────────

  async requestTo(viewId: string, method: string, payload?: unknown): Promise<unknown> {
    const view = this.views.get(viewId)
    if (!view) throw new Error(`View not found: ${viewId}`)
    return view.channel.request(method, payload)
  }

  async broadcast(method: string, payload?: unknown): Promise<void> {
    const promises: Promise<unknown>[] = []
    for (const view of this.views.values()) {
      promises.push(view.channel.request(method, payload))
    }
    await Promise.allSettled(promises)
  }

  onMessage(viewId: string, method: string, handler: Handler): void {
    const view = this.views.get(viewId)
    if (!view) return
    view.channel.on(method, handler)
  }

  onAnyMessage(method: string, handler: AnyMessageHandler): void {
    this.anyMessageHandlers.set(method, handler)
    // Apply to all existing views
    for (const [id, view] of this.views) {
      view.channel.on(method, (payload: unknown) => handler(id, payload))
    }
  }
}

export const viewManager = new ViewManager()
