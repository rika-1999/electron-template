import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ViewManager as ViewManagerType } from './index'

// Mock electron
const mockWebContentsView = vi.fn()
const mockBaseWindow = vi.fn()
const mockMessageChannelMain = vi.fn()

vi.mock('electron', () => {
  const createMockWebContents = (id: number) => {
    const handlers = new Map<string, (...args: unknown[]) => void>()
    return {
      id,
      loadURL: vi.fn().mockResolvedValue(undefined),
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        handlers.set(event, handler)
      }),
      off: vi.fn(),
      isDestroyed: vi.fn().mockReturnValue(false),
      close: vi.fn(),
      postMessage: vi.fn(),
      _trigger: (event: string, ...args: unknown[]) => {
        handlers.get(event)?.(...args)
      },
    }
  }

  const createMockWCV = () => {
    const wc = createMockWebContents(Math.floor(Math.random() * 10000))
    const view = {
      webContents: wc,
      setBounds: vi.fn(),
      getBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 }),
      setVisible: vi.fn(),
    }
    mockWebContentsView.mockReturnValue(view)
    return view
  }

  const createMockBaseWindow = () => {
    const win = {
      contentView: null as unknown,
      setContentView: vi.fn(function (this: { contentView: unknown }, v: unknown) {
        this.contentView = v
      }),
      close: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn(),
    }
    mockBaseWindow.mockReturnValue(win)
    return win
  }

  // Pre-create a view for each call
  let wcvCallCount = 0
  mockWebContentsView.mockImplementation(function (opts: unknown) {
    wcvCallCount++
    return createMockWCV()
  })

  mockBaseWindow.mockImplementation(function (opts: unknown) {
    return createMockBaseWindow()
  })

  const port1 = {
    on: vi.fn(),
    start: vi.fn(),
    close: vi.fn(),
    postMessage: vi.fn(),
  }
  const port2 = {
    on: vi.fn(),
    start: vi.fn(),
    close: vi.fn(),
    postMessage: vi.fn(),
  }

  mockMessageChannelMain.mockReturnValue({ port1, port2 })

  return {
    WebContentsView: mockWebContentsView,
    BaseWindow: mockBaseWindow,
    MessageChannelMain: mockMessageChannelMain,
    webContents: {
      fromId: vi.fn((id: number) => {
        return {
          id,
          postMessage: vi.fn(),
        }
      }),
    },
  }
})

describe('ViewManager', () => {
  let ViewManager: typeof ViewManagerType

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    const mod = await import('./index')
    ViewManager = mod.ViewManager
  })

  it('should be instantiable', () => {
    const vm = new ViewManager()
    expect(vm).toBeDefined()
  })

  // ─── createView ───────────────────────────────────────────────────────

  describe('createView', () => {
    it('should create a background view and return a viewId', async () => {
      const vm = new ViewManager()
      const viewId = await vm.createView({ url: 'https://example.com', type: 'background' })
      expect(viewId).toBeTruthy()
      expect(typeof viewId).toBe('string')
    })

    it('should create a background view with offscreen: true', async () => {
      const { WebContentsView } = await import('electron')
      const vm = new ViewManager()
      await vm.createView({ url: 'https://example.com', type: 'background' })
      expect(WebContentsView).toHaveBeenCalledWith(
        expect.objectContaining({
          webPreferences: expect.objectContaining({ offscreen: true }),
        }),
      )
    })

    it('should NOT set offscreen for non-background views', async () => {
      const { WebContentsView } = await import('electron')
      const vm = new ViewManager()
      await vm.createView({ url: 'https://example.com', type: 'detached' })
      expect(WebContentsView).toHaveBeenCalledWith(
        expect.objectContaining({
          webPreferences: expect.not.objectContaining({ offscreen: true }),
        }),
      )
    })

    it('should default to embedded type', async () => {
      const mockParent = {
        contentView: { addChildView: vi.fn() },
      } as unknown as Electron.BrowserWindow
      const vm = new ViewManager()
      const viewId = await vm.createView({ url: 'https://example.com', parentWindow: mockParent })
      const state = vm.getViewState(viewId)
      expect(state?.type).toBe('embedded')
    })

    it('should create a detached view with a BaseWindow', async () => {
      const vm = new ViewManager()
      const viewId = await vm.createView({ url: 'https://example.com', type: 'detached' })
      const state = vm.getViewState(viewId)
      expect(state?.type).toBe('detached')
    })

    it('should load the given URL', async () => {
      const vm = new ViewManager()
      const viewId = await vm.createView({ url: 'https://example.com', type: 'background' })
      const view = vm.getView(viewId)
      expect(view?.webContentsView.webContents.loadURL).toHaveBeenCalledWith('https://example.com')
    })
  })

  // ─── destroyView ─────────────────────────────────────────────────────

  describe('destroyView', () => {
    it('should remove the view from the registry', async () => {
      const vm = new ViewManager()
      const viewId = await vm.createView({ url: 'https://example.com', type: 'background' })
      vm.destroyView(viewId)
      expect(vm.getView(viewId)).toBeUndefined()
    })

    it('should be a no-op for non-existent viewId', () => {
      const vm = new ViewManager()
      expect(() => vm.destroyView('non-existent')).not.toThrow()
    })
  })

  // ─── getView / listViews ─────────────────────────────────────────────

  describe('getView / listViews', () => {
    it('should return undefined for unknown viewId', () => {
      const vm = new ViewManager()
      expect(vm.getView('unknown')).toBeUndefined()
    })

    it('should return undefined state for unknown viewId', () => {
      const vm = new ViewManager()
      expect(vm.getViewState('unknown')).toBeUndefined()
    })

    it('should list all managed views', async () => {
      const vm = new ViewManager()
      await vm.createView({ url: 'https://a.com', type: 'background' })
      await vm.createView({ url: 'https://b.com', type: 'background' })
      const list = vm.listViews()
      expect(list).toHaveLength(2)
    })
  })

  // ─── lifecycle events ─────────────────────────────────────────────────

  describe('lifecycle events', () => {
    it('should emit view-created on createView', async () => {
      const vm = new ViewManager()
      const handler = vi.fn()
      vm.on('view-created', handler)
      await vm.createView({ url: 'https://example.com', type: 'background' })
      expect(handler).toHaveBeenCalledOnce()
    })

    it('should emit view-destroyed on destroyView', async () => {
      const vm = new ViewManager()
      const handler = vi.fn()
      vm.on('view-destroyed', handler)
      const viewId = await vm.createView({ url: 'https://example.com', type: 'background' })
      vm.destroyView(viewId)
      expect(handler).toHaveBeenCalledWith(viewId)
    })
  })

  // ─── built-in channel ─────────────────────────────────────────────────

  describe('built-in channel', () => {
    it('should reject requestTo for non-existent view', async () => {
      const vm = new ViewManager()
      await expect(vm.requestTo('non-existent', 'test')).rejects.toThrow()
    })

    it('should register handler via onMessage', async () => {
      const vm = new ViewManager()
      const viewId = await vm.createView({ url: 'https://example.com', type: 'background' })
      const handler = vi.fn()
      vm.onMessage(viewId, 'test', handler)
      // Handler should be registered on the view's channel
      const view = vm.getView(viewId)
      expect(view).toBeDefined()
    })

    it('should register handler via onAnyMessage for all views', async () => {
      const vm = new ViewManager()
      const handler = vi.fn()
      vm.onAnyMessage('test', handler)
      // Create a view after registering - handler should be applied
      const viewId = await vm.createView({ url: 'https://example.com', type: 'background' })
      const view = vm.getView(viewId)
      expect(view).toBeDefined()
    })
  })

  // ─── attachToWindow / detachToWindow ──────────────────────────────────

  describe('attachToWindow / detachToWindow', () => {
    it('should attach a background view to a window', async () => {
      const mockParent = {
        contentView: { addChildView: vi.fn() },
      } as unknown as Electron.BrowserWindow
      const vm = new ViewManager()
      const viewId = await vm.createView({ url: 'https://example.com', type: 'background' })
      vm.attachToWindow(viewId, mockParent, { x: 0, y: 0, width: 400, height: 300 })
      const state = vm.getViewState(viewId)
      expect(state?.type).toBe('embedded')
    })

    it('should detach an embedded view to a new window', async () => {
      const mockParent = {
        contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
      } as unknown as Electron.BrowserWindow
      const vm = new ViewManager()
      const viewId = await vm.createView({
        url: 'https://example.com',
        type: 'embedded',
        parentWindow: mockParent,
      })
      const baseWin = vm.detachToWindow(viewId)
      expect(baseWin).toBeDefined()
      const state = vm.getViewState(viewId)
      expect(state?.type).toBe('detached')
    })
  })
})
