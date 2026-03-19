import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { startMsw, stopMsw } from './msw'

describe('Data Helper', () => {
  beforeAll(async () => {
    await startMsw()
  })

  afterAll(async () => {
    await stopMsw()
  })

  afterEach(async () => {
    const { cleanup } = await import('./data-helper')
    cleanup()
  })

  it('should export data object with seed method', async () => {
    const { data } = await import('./data-helper')
    expect(data).toBeDefined()
    expect(data.seed).toBeDefined()
    expect(data.seed).toBeTypeOf('function')
  })

  it('should have cleanup function exported', async () => {
    const { cleanup } = await import('./data-helper')
    expect(cleanup).toBeDefined()
    expect(cleanup).toBeTypeOf('function')
  })
})
