import { vi, beforeEach } from 'vitest'

// Renderer test setup — jsdom provides window/document/navigator

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})
// Initialize log and channel mocks, then expose to window

// ─── Mock window.__app_log__ ──────────────────────────────────────────────────
;(globalThis as Record<string, unknown>).__app_log__ = {
  sendLog: vi.fn((_level: string, _ctx: Record<string, unknown>, _serializedParams: string[]) => {
    // Default mock implementation - tests can override via spy
  }),
}

// ─── Mock window.__app_channel__ ─────────────────────────────────────────────

const requestHandlers = new Map<string, (payload: unknown) => unknown>()

;(globalThis as Record<string, unknown>).__app_channel__ = {
  request: vi.fn((method: string, payload?: unknown, _timeout?: number) => {
    const handler = requestHandlers.get(method)
    if (handler) {
      return Promise.resolve(handler(payload))
    }
    return Promise.reject(new Error(`No handler for method: ${method}`))
  }) as typeof window.__app_channel__.request,
  onRequest: vi.fn((method: string, handler: (payload: unknown) => unknown) => {
    requestHandlers.set(method, handler)
  }) as typeof window.__app_channel__.onRequest,
  offRequest: vi.fn((method: string) => {
    requestHandlers.delete(method)
  }) as typeof window.__app_channel__.offRequest,
}

// ─── Mock window.__app_ipc_channel__ ────────────────────────────────────────
;(globalThis as Record<string, unknown>).__app_ipc_channel__ = {
  on: vi.fn(),
  send: vi.fn(),
}
