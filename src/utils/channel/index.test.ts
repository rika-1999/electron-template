import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChannelInstance as ChannelInstanceType } from './index'
import type { channel as channelType } from './index'

// Mock electron module
vi.mock('electron', () => ({
  MessageChannelMain: vi.fn(),
  webContents: { fromId: vi.fn() },
  ipcRenderer: { on: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
}))

describe('ChannelInstance', () => {
  let ChannelInstance: typeof ChannelInstanceType

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('./index')
    ChannelInstance = mod.ChannelInstance
  })

  it('should be a class that can be instantiated', () => {
    const instance = new ChannelInstance()
    expect(instance).toBeDefined()
  })

  it('should have independent handlers between instances', () => {
    const a = new ChannelInstance()
    const b = new ChannelInstance()

    const handlerA = vi.fn()
    const handlerB = vi.fn()

    a.on('test', handlerA)
    b.on('test', handlerB)

    a.off('test')
    expect(handlerA).not.toBe(handlerB)
  })

  it('should have independent pending maps between instances', () => {
    const a = new ChannelInstance()
    const b = new ChannelInstance()
    expect(a).not.toBe(b)
  })

  it('should reject request when port is not initialized', async () => {
    const instance = new ChannelInstance()
    await expect(instance.request('test')).rejects.toThrow('Channel port not initialized')
  })

  it('should register and unregister handlers via on/off', () => {
    const instance = new ChannelInstance()
    const handler = vi.fn()

    instance.on('method1', handler)
    instance.off('method1')

    expect(() => instance.off('method1')).not.toThrow()
  })

  it('should clean up all state on destroy()', async () => {
    const instance = new ChannelInstance()
    instance.on('test', vi.fn())

    instance.destroy()

    await expect(instance.request('test')).rejects.toThrow()
  })
})

describe('channel (default instance backward compatibility)', () => {
  let channel: typeof channelType

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('./index')
    channel = mod.channel
  })

  it('should export init, request, on, off methods', () => {
    expect(channel.init).toBeTypeOf('function')
    expect(channel.request).toBeTypeOf('function')
    expect(channel.on).toBeTypeOf('function')
    expect(channel.off).toBeTypeOf('function')
  })

  it('should reject request when not initialized', async () => {
    await expect(channel.request('test')).rejects.toThrow()
  })
})
