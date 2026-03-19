import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'

const setupServer = async () => {
  const { setupServer } = await import('msw/node')
  return setupServer()
}

describe('MSW Helper', () => {
  let startMsw: () => Promise<void>
  let stopMsw: () => Promise<void>

  beforeAll(async () => {
    const mswModule = await import('./msw')
    startMsw = mswModule.startMsw
    stopMsw = mswModule.stopMsw
  })

  it('should export startMsw and stopMsw functions', () => {
    expect(startMsw).toBeDefined()
    expect(stopMsw).toBeDefined()
    expect(startMsw).toBeTypeOf('function')
    expect(stopMsw).toBeTypeOf('function')
  })
})
