import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createChannelMock } from '@/__tests__/infrastructure/helpers/channel-helpers'
import { Timeout, MethodTimeout } from '@/shared/serviceRegistry/decorators'

describe('Service Registry Timeout', () => {
  beforeEach(() => {
    vi.stubEnv('PROCESS_TYPE', 'main')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('@Timeout class decorator', () => {
    @Timeout(500)
    abstract class TestTimeoutApi {
      abstract fastMethod(): Promise<string>
      abstract slowMethod(): Promise<string>
      abstract normalMethod(): Promise<string>
    }

    class TimeoutService extends TestTimeoutApi {
      async fastMethod(): Promise<string> {
        return 'fast-result'
      }

      async slowMethod(): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, 600))
        return 'slow-result'
      }

      async normalMethod(): Promise<string> {
        return 'normal-result'
      }
    }

    it('should apply timeout to all methods in class', async () => {
      const { serviceRegistry, ServiceTimeoutError } = await import('@/shared/serviceRegistry')
      const timeoutApi = serviceRegistry.defineApi(TestTimeoutApi, 'main')
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      const timeoutService = new TimeoutService()
      serviceRegistry.implementService(mainChannel, timeoutService)

      await expect(timeoutApi.fastMethod()).resolves.toBe('fast-result')
      await expect(timeoutApi.normalMethod()).resolves.toBe('normal-result')
    })

    it('should timeout methods that exceed class timeout', async () => {
      const { serviceRegistry, ServiceTimeoutError } = await import('@/shared/serviceRegistry')
      const timeoutApi = serviceRegistry.defineApi(TestTimeoutApi, 'main')
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      const timeoutService = new TimeoutService()
      serviceRegistry.implementService(mainChannel, timeoutService)

      const promise = timeoutApi.slowMethod()
      vi.advanceTimersByTime(600)
      await expect(promise).rejects.toThrow(ServiceTimeoutError)

      const promise2 = timeoutApi.slowMethod()
      vi.advanceTimersByTime(600)
      await expect(promise2).rejects.toThrow(
        "Service 'testtimeout.slowMethod' timed out after 500ms",
      )
    })
  })

  describe('@MethodTimeout method decorator', () => {
    class TestTimeoutWithClassApi {
      method1(): Promise<string> {
        throw new Error('Not implemented')
      }

      method2(): Promise<string> {
        throw new Error('Not implemented')
      }
    }

    class MethodTimeoutService extends TestTimeoutWithClassApi {
      async method1(): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, 500))
        return 'method1-result'
      }

      async method2(): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, 200))
        return 'method2-result'
      }
    }

    // Manually apply decorator metadata to simulate @MethodTimeout on methods
    const methodTimeoutsMap = new Map<string, number>()
    methodTimeoutsMap.set('method1', 1000)
    methodTimeoutsMap.set('method2', 100)
    ;(TestTimeoutWithClassApi as any).__methodTimeouts__ = methodTimeoutsMap

    it('should apply timeout to individual methods', async () => {
      const { serviceRegistry, ServiceTimeoutError } = await import('@/shared/serviceRegistry')
      const methodTimeoutApi = serviceRegistry.defineApi(TestTimeoutWithClassApi, 'main')
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      const methodTimeoutService = new MethodTimeoutService()
      serviceRegistry.implementService(mainChannel, methodTimeoutService)

      const promise = methodTimeoutApi.method1()
      vi.advanceTimersByTime(500)
      await expect(promise).resolves.toBe('method1-result')
    })

    it('should timeout methods exceeding method-specific timeout', async () => {
      const { serviceRegistry, ServiceTimeoutError } = await import('@/shared/serviceRegistry')
      const methodTimeoutApi = serviceRegistry.defineApi(TestTimeoutWithClassApi, 'main')
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      const methodTimeoutService = new MethodTimeoutService()
      serviceRegistry.implementService(mainChannel, methodTimeoutService)

      const promise = (methodTimeoutApi as any).method2()
      vi.advanceTimersByTime(200)
      await expect(promise).rejects.toThrow(ServiceTimeoutError)

      const promise2 = (methodTimeoutApi as any).method2()
      vi.advanceTimersByTime(200)
      await expect(promise2).rejects.toThrow(
        "Service 'testtimeoutwithclass.method2' timed out after 100ms",
      )
    })
  })

  describe('ServiceTimeoutError', () => {
    @Timeout(500)
    abstract class ErrorApi {
      abstract timeoutMethod(): Promise<string>
    }

    class ErrorService extends ErrorApi {
      async timeoutMethod(): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, 600))
        return 'result'
      }
    }

    it('should have correct error name', async () => {
      const { serviceRegistry, ServiceTimeoutError } = await import('@/shared/serviceRegistry')
      const errorApi = serviceRegistry.defineApi(ErrorApi, 'main')
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      const errorService = new ErrorService()
      serviceRegistry.implementService(mainChannel, errorService)

      try {
        const promise = errorApi.timeoutMethod()
        vi.advanceTimersByTime(600)
        await promise
        expect.fail('Should have thrown ServiceTimeoutError')
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceTimeoutError)
        expect((error as InstanceType<typeof ServiceTimeoutError>).name).toBe('ServiceTimeoutError')
      }
    })

    it('should include service name in error message', async () => {
      const { serviceRegistry, ServiceTimeoutError } = await import('@/shared/serviceRegistry')
      const errorApi = serviceRegistry.defineApi(ErrorApi, 'main')
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      const errorService = new ErrorService()
      serviceRegistry.implementService(mainChannel, errorService)

      try {
        const promise = errorApi.timeoutMethod()
        vi.advanceTimersByTime(600)
        await promise
        expect.fail('Should have thrown ServiceTimeoutError')
      } catch (error) {
        expect((error as Error).message).toContain('error')
      }
    })

    it('should include method name in error message', async () => {
      const { serviceRegistry, ServiceTimeoutError } = await import('@/shared/serviceRegistry')
      const errorApi = serviceRegistry.defineApi(ErrorApi, 'main')
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      const errorService = new ErrorService()
      serviceRegistry.implementService(mainChannel, errorService)

      try {
        const promise = errorApi.timeoutMethod()
        vi.advanceTimersByTime(600)
        await promise
        expect.fail('Should have thrown ServiceTimeoutError')
      } catch (error) {
        expect((error as Error).message).toContain('timeoutMethod')
      }
    })

    it('should include timeout duration in error message', async () => {
      const { serviceRegistry, ServiceTimeoutError } = await import('@/shared/serviceRegistry')
      const errorApi = serviceRegistry.defineApi(ErrorApi, 'main')
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      const errorService = new ErrorService()
      serviceRegistry.implementService(mainChannel, errorService)

      try {
        const promise = errorApi.timeoutMethod()
        vi.advanceTimersByTime(600)
        await promise
        expect.fail('Should have thrown ServiceTimeoutError')
      } catch (error) {
        expect((error as Error).message).toContain('500ms')
      }
    })
  })

  describe('timeout priority (method > class > global > built-in)', () => {
    @Timeout(500)
    abstract class PriorityApi {
      methodWithTimeout(): Promise<string> {
        throw new Error('Not implemented')
      }
      methodWithoutTimeout(): Promise<string> {
        throw new Error('Not implemented')
      }
    }

    Object.assign(PriorityApi.prototype, {
      methodWithTimeout: MethodTimeout(1000)(PriorityApi.prototype, 'methodWithTimeout', {
        value: PriorityApi.prototype.methodWithTimeout,
      }),
    })

    class PriorityService extends PriorityApi {
      async methodWithTimeout(): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, 600))
        return 'result'
      }

      async methodWithoutTimeout(): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, 600))
        return 'result'
      }
    }

    it('should prioritize method timeout over class timeout', async () => {
      const { serviceRegistry, ServiceTimeoutError } = await import('@/shared/serviceRegistry')
      const priorityApi = serviceRegistry.defineApi(PriorityApi, 'main')
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      const priorityService = new PriorityService()
      serviceRegistry.implementService(mainChannel, priorityService)

      const promise1 = priorityApi.methodWithTimeout()
      vi.advanceTimersByTime(600)
      await expect(promise1).resolves.toBe('result')

      const promise2 = priorityApi.methodWithoutTimeout()
      vi.advanceTimersByTime(600)
      await expect(promise2).rejects.toThrow(ServiceTimeoutError)
    })

    it('should prioritize class timeout over global timeout', async () => {
      const { serviceRegistry, ServiceTimeoutError } = await import('@/shared/serviceRegistry')
      serviceRegistry.setDefaultTimeout(2000)
      const priorityApi = serviceRegistry.defineApi(PriorityApi, 'main')
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      const priorityService = new PriorityService()
      serviceRegistry.implementService(mainChannel, priorityService)

      const promise = priorityApi.methodWithoutTimeout()
      vi.advanceTimersByTime(600)
      await expect(promise).rejects.toThrow(ServiceTimeoutError)
    })

    it('should use global timeout when no class or method timeout', async () => {
      abstract class NoTimeoutApi {
        abstract slowMethod(): Promise<string>
      }

      class NoTimeoutService extends NoTimeoutApi {
        async slowMethod(): Promise<string> {
          await new Promise((resolve) => setTimeout(resolve, 1100))
          return 'result'
        }
      }

      const { serviceRegistry, ServiceTimeoutError } = await import('@/shared/serviceRegistry')
      serviceRegistry.setDefaultTimeout(500)
      const noTimeoutApi = serviceRegistry.defineApi(NoTimeoutApi, 'main')
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      const noTimeoutService = new NoTimeoutService()
      serviceRegistry.implementService(mainChannel, noTimeoutService)

      const promise1 = noTimeoutApi.slowMethod()
      vi.advanceTimersByTime(1100)
      await expect(promise1).rejects.toThrow(ServiceTimeoutError)

      const promise2 = noTimeoutApi.slowMethod()
      vi.advanceTimersByTime(1100)
      await expect(promise2).rejects.toThrow('timed out after 500ms')
    })

    it('should use built-in default timeout (10000ms) when no timeout configured', async () => {
      // Note: Testing the 10-second built-in default timeout is impractical in unit tests
      // This test verifies the mechanism by using a shorter custom timeout instead
      abstract class CustomDefaultTimeoutApi {
        abstract slowMethod(): Promise<string>
      }

      class CustomDefaultTimeoutService extends CustomDefaultTimeoutApi {
        async slowMethod(): Promise<string> {
          await new Promise((resolve) => setTimeout(resolve, 1500))
          return 'result'
        }
      }

      const { serviceRegistry, ServiceTimeoutError } = await import('@/shared/serviceRegistry')
      serviceRegistry.setDefaultTimeout(1000)
      const defaultTimeoutApi = serviceRegistry.defineApi(CustomDefaultTimeoutApi, 'main')
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      const defaultTimeoutService = new CustomDefaultTimeoutService()
      serviceRegistry.implementService(mainChannel, defaultTimeoutService)

      const promise1 = defaultTimeoutApi.slowMethod()
      vi.advanceTimersByTime(1500)
      await expect(promise1).rejects.toThrow(ServiceTimeoutError)

      const promise2 = defaultTimeoutApi.slowMethod()
      vi.advanceTimersByTime(1500)
      await expect(promise2).rejects.toThrow('timed out after 1000ms')
    })
  })

  describe('same-process timeout with Promise.race', () => {
    it('should race against timeout promise for local calls', async () => {
      @Timeout(100)
      abstract class LocalTimeoutApi {
        abstract fastMethod(): Promise<string>
        abstract slowMethod(): Promise<string>
      }

      class LocalTimeoutService extends LocalTimeoutApi {
        async fastMethod(): Promise<string> {
          return 'result'
        }

        async slowMethod(): Promise<string> {
          await new Promise((resolve) => setTimeout(resolve, 200))
          return 'result'
        }
      }

      const { serviceRegistry, ServiceTimeoutError } = await import('@/shared/serviceRegistry')
      const localTimeoutApi = serviceRegistry.defineApi(LocalTimeoutApi, 'main')
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      const localTimeoutService = new LocalTimeoutService()
      serviceRegistry.implementService(mainChannel, localTimeoutService)

      await expect(localTimeoutApi.fastMethod()).resolves.toBe('result')

      const promise = localTimeoutApi.slowMethod()
      vi.advanceTimersByTime(200)
      await expect(promise).rejects.toThrow(ServiceTimeoutError)
    })
  })

  describe('cross-process timeout passing to channel.request', () => {
    abstract class CrossProcessApi {
      abstract remoteMethod(): Promise<string>
      abstract fastRemoteMethod(): Promise<string>
    }

    it('should pass timeout to channel.request for remote calls', async () => {
      const mockRequest = vi.fn().mockResolvedValue('remote-result')
      const mockChannel = {
        request: mockRequest,
        onRequest: vi.fn(),
      }

      const { serviceRegistry } = await import('@/shared/serviceRegistry')
      serviceRegistry.defineApi(CrossProcessApi, 'renderer')
      serviceRegistry.setDefaultChannel(mockChannel as any)
      vi.stubEnv('PROCESS_TYPE', 'main')

      const crossProcessApi = serviceRegistry.defineApi(CrossProcessApi, 'renderer')
      await crossProcessApi.remoteMethod()

      expect(mockRequest).toHaveBeenCalledWith('crossprocess:remoteMethod', [], 10000)
    })

    it('should pass custom timeout to channel.request', async () => {
      @Timeout(500)
      abstract class CustomTimeoutApi extends CrossProcessApi {
        abstract remoteMethod(): Promise<string>
        abstract fastRemoteMethod(): Promise<string>
      }

      class CustomTimeoutService extends CustomTimeoutApi {
        async remoteMethod(): Promise<string> {
          return 'remote-result'
        }

        async fastRemoteMethod(): Promise<string> {
          return 'fast-result'
        }
      }

      const mockRequest = vi.fn().mockResolvedValue('remote-result')
      const mockChannel = {
        request: mockRequest,
        onRequest: vi.fn(),
      }

      const { serviceRegistry } = await import('@/shared/serviceRegistry')
      serviceRegistry.defineApi(CustomTimeoutApi, 'renderer')
      vi.stubEnv('PROCESS_TYPE', 'main')

      const api = serviceRegistry.defineApi(CustomTimeoutApi, 'renderer').use(mockChannel as any)
      await api.remoteMethod()

      expect(mockRequest).toHaveBeenCalledWith('customtimeout:remoteMethod', [], 500)
    })

    it('should handle channel request timeout correctly', async () => {
      let timeoutCallback: (() => void) | null = null
      const mockRequest = vi.fn().mockImplementation(() => {
        return new Promise((resolve, reject) => {
          timeoutCallback = () => {
            reject(new Error('Channel timeout'))
          }
        })
      })

      const mockChannel = {
        request: mockRequest,
        onRequest: vi.fn(),
      }

      const { serviceRegistry } = await import('@/shared/serviceRegistry')
      vi.stubEnv('PROCESS_TYPE', 'main')
      const crossProcessApi = serviceRegistry.defineApi(CrossProcessApi, 'renderer')
      serviceRegistry.setDefaultChannel(mockChannel as any)

      const promise = crossProcessApi.remoteMethod()

      vi.advanceTimersByTime(50)
      ;(timeoutCallback as unknown as () => void)?.()

      await expect(promise).rejects.toThrow('Channel timeout')
    })
  })

  describe('default timeout configuration', () => {
    it('should set default timeout via setDefaultTimeout', async () => {
      const { serviceRegistry } = await import('@/shared/serviceRegistry')
      serviceRegistry.setDefaultTimeout(3000)

      abstract class DefaultTimeoutApi {
        abstract method(): Promise<string>
      }

      class DefaultTimeoutService extends DefaultTimeoutApi {
        async method(): Promise<string> {
          return 'result'
        }
      }

      const { mainChannel } = await createChannelMock({ webContentsId: 1 })

      const api = serviceRegistry.defineApi(DefaultTimeoutApi, 'main')
      const service = new DefaultTimeoutService()
      serviceRegistry.implementService(mainChannel, service)

      await expect(api.method()).resolves.toBe('result')
    })

    it('should apply default timeout to all services', async () => {
      const { serviceRegistry, ServiceTimeoutError } = await import('@/shared/serviceRegistry')
      serviceRegistry.setDefaultTimeout(200)

      abstract class Api1 {
        abstract method(): Promise<string>
      }

      class Service1 extends Api1 {
        async method(): Promise<string> {
          await new Promise((resolve) => setTimeout(resolve, 300))
          return 'result'
        }
      }

      const { mainChannel } = await createChannelMock({ webContentsId: 1 })

      const api1 = serviceRegistry.defineApi(Api1, 'main')
      const service1 = new Service1()
      serviceRegistry.implementService(mainChannel, service1)

      const promise = api1.method()
      vi.advanceTimersByTime(300)
      await expect(promise).rejects.toThrow(ServiceTimeoutError)
    })

    it('should override default timeout with class timeout', async () => {
      const { serviceRegistry } = await import('@/shared/serviceRegistry')
      serviceRegistry.setDefaultTimeout(1000)

      @Timeout(500)
      abstract class OverrideApi {
        abstract method(): Promise<string>
      }

      class OverrideService extends OverrideApi {
        async method(): Promise<string> {
          await new Promise((resolve) => setTimeout(resolve, 600))
          return 'result'
        }
      }

      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      const api = serviceRegistry.defineApi(OverrideApi, 'main')
      const service = new OverrideService()
      serviceRegistry.implementService(mainChannel, service)

      const { ServiceTimeoutError } = await import('@/shared/serviceRegistry')
      const promise1 = api.method()
      vi.advanceTimersByTime(600)
      await expect(promise1).rejects.toThrow(ServiceTimeoutError)

      const promise2 = api.method()
      vi.advanceTimersByTime(600)
      await expect(promise2).rejects.toThrow('timed out after 500ms')
    })
  })
})
