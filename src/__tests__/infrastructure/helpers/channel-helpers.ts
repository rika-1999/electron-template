import { vi } from 'vitest'

/**
 * Creates a new pair of connected mock MessagePort objects.
 * Each call returns independent port1 and port2 instances with fresh state.
 * port1.postMessage triggers port2.onmessage and vice versa.
 */
export function createMockMessageChannel() {
  const port1 = {
    postMessage: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'message') {
        port1.onmessage = handler as ((...args: unknown[]) => void) | null
      }
    }),
    start: vi.fn(),
    close: vi.fn(),
    lastMessage: undefined as any,
    onmessage: null as ((...args: unknown[]) => void) | null,
  }

  const port2 = {
    postMessage: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'message') {
        port2.onmessage = handler as ((...args: unknown[]) => void) | null
      }
    }),
    start: vi.fn(),
    close: vi.fn(),
    lastMessage: undefined as any,
    onmessage: null as ((...args: unknown[]) => void) | null,
  }

  port1.postMessage = vi.fn((data: unknown) => {
    port2.onmessage?.({ data })
    port1.lastMessage = data
  })

  port2.postMessage = vi.fn((data: unknown) => {
    port1.onmessage?.({ data })
    port2.lastMessage = data
  })

  return {
    port1,
    port2,
  }
}

/**
 * Creates a mock channel pair for testing Channel communication.
 * Directly sets ports without initialization for test isolation.
 *
 * @param options - kept for backwards compatibility, not used
 * @returns { mainChannel, rendererChannel } - a pair of Channel instances that can communicate
 */
export async function createChannelMock(_options: { webContentsId?: number } = {}): Promise<{
  mainChannel: import('@/shared/channel').Channel
  rendererChannel: import('@/shared/channel').Channel
}> {
  const { Channel } = await import('@/shared/channel')
  const { port1, port2 } = createMockMessageChannel()

  const mainChannel = new Channel()
  mainChannel.setPort(port1 as any)

  const rendererChannel = new Channel()
  rendererChannel.setPort(port2 as any)

  return { mainChannel, rendererChannel }
}
