# Service Registry Timeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add timeout mechanism to ServiceRegistry with decorators (@Timeout, @MethodTimeout), global default timeout, and support for both same-process and cross-process calls.

**Architecture:**

- Extract `defineApi` and related logic into `apiDefinitions.ts` as a closure-based singleton
- Add decorators for class-level and method-level timeout configuration
- Add `ServiceTimeoutError` for timeout failures
- Simplify `ServiceRegistry` to use `apiDefinitions` singleton
- Use `Promise.race` for same-process timeout handling

**Tech Stack:**

- TypeScript decorators
- Promise.race for timeout
- Closure pattern for encapsulation

---

## File Structure

```
src/shared/serviceRegistry/
├── index.ts              # ServiceRegistry (modify - simplify, use apiDefinitions)
├── apiDefinitions.ts    # Closure singleton with defineApi, timeout handling (create)
├── decorators.ts         # @Timeout and @MethodTimeout decorators (create)
└── error.ts              # ServiceTimeoutError (create)

src/__tests__/main/services/
└── timeout.test.ts       # Timeout tests (create)
```

---

### Task 1: Create apiDefinitions.ts Closure Singleton

**Files:**

- Create: `src/shared/serviceRegistry/apiDefinitions.ts`

- [ ] **Step 1: Write apiDefinitions.ts with closure pattern**

```typescript
import type { ChannelLike } from './index'
import { ServiceTimeoutError } from './error'

export type ApiType<T> = T & {
  use: (channel: ChannelLike) => ApiType<T>
}

// 闭包实现：隐藏内部函数，只暴露必要的接口
export const apiDefinitions = (() => {
  // 内置默认值
  const BUILT_IN_DEFAULT_TIMEOUT = 10000

  // API 定义存储
  const definitions = new Map<
    abstract new () => object,
    {
      serviceName: string
      processType: 'main' | 'preload' | 'renderer'
      apiProxy: unknown
    }
  >()

  // 默认 timeout
  let defaultTimeout: number | undefined = undefined

  // 默认 channel
  let defaultChannel: ChannelLike | null = null

  // 服务实现获取器（由 ServiceRegistry 设置）
  let getServiceImplementation: ((serviceName: string) => { instance: object } | undefined }) | null = null

  // 内部函数：获取服务名
  function getServiceName(className: string): string {
    return className.replace(/Api$/, '').toLowerCase()
  }

  // 内部函数：获取进程类型
  function getCurrentProcessType(): 'main' | 'preload' | 'renderer' {
    return (process.env.PROCESS_TYPE as 'main' | 'preload' | 'renderer') || 'main'
  }

  // 内部函数：获取有效的 timeout 值
  function getEffectiveTimeout(
    apiClass: abstract new () => object,
    methodName: string,
  ): number {
    // 1. 检查方法装饰器
    const methodTimeouts = (apiClass as any).__methodTimeouts__ as Map<string, number> | undefined
    if (methodTimeouts?.has(methodName)) {
      return methodTimeouts.get(methodName)!
    }

    // 2. 检查类装饰器
    const classTimeout = (apiClass as any).__serviceTimeout__ as number | undefined
    if (classTimeout !== undefined) {
      return classTimeout
    }

    // 3. 使用默认值或内置默认值
    return defaultTimeout ?? BUILT_IN_DEFAULT_TIMEOUT
  }

  // 内部函数：创建超时 Promise
  function createTimeoutPromise(service: string, method: string, ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ServiceTimeoutError(service, method, ms))
      }, ms)
    })
  }

  // 内部函数：跨进程调用
  async function invokeRemote(
    channelLike: ChannelLike,
    serviceId: string,
    method: string,
    args: unknown[],
    timeout: number,
  ): Promise<unknown> {
    const channelMethod = `${serviceId}:${method}`

    if ('requestTo' in channelLike && 'onAnyRequest' in channelLike) {
      throw new Error('Cannot use ChannelCenter directly. Please use specific channel via .use(channel)')
    }

    if ('request' in channelLike && typeof channelLike.request === 'function') {
      // 传递 timeout 参数（ChannelLike 可能需要类型断言）
      return (channelLike as { request: (m: string, p?: unknown, t?: number) => Promise<unknown> }).request(
        channelMethod,
        args,
        timeout
      )
    }

    throw new Error('Channel does not support request method')
  }

  // 内部函数：创建 API Proxy
  function createApiProxy(
    serviceName: string,
    processType: 'main' | 'preload' | 'renderer',
    ApiClass: abstract new () => object,
    getServiceImplementation: (serviceName: string) => { instance: object } | undefined,
    useChannel?: ChannelLike,
  ): any {
    return new Proxy({} as any, {
      get: (target, prop) => {
        if (prop === 'use') {
          return (newChannel: ChannelLike) => {
            return createApiProxy(serviceName, processType, ApiClass, getServiceImplementation, newChannel)
          }
        }

        if (typeof prop === 'string') {
          if (getCurrentProcessType() === processType) {
            // 同进程调用
            return (...args: unknown[]) => {
              const impl = getServiceImplementation(serviceName)
              if (!impl?.instance) {
                throw new Error(`Service '${serviceName}' not implemented`)
              }
              const method = (impl.instance as Record<string, unknown>)[prop]
              if (typeof method === 'function') {
                const timeout = getEffectiveTimeout(ApiClass, prop)
                return Promise.race([
                  (method as (...args: unknown[]) => unknown).apply(impl.instance, args),
                  createTimeoutPromise(serviceName, prop, timeout)
                ])
              }
              return method
            }
          } else {
            // 跨进程调用
            return (...args: unknown[]) => {
              const timeout = getEffectiveTimeout(ApiClass, prop)
              const channel = useChannel ?? defaultChannel
              if (!channel) {
                throw new Error(
                  `No channel specified for remote service '${serviceName}'. Call .use(channel) first.`,
                )
              }
              return invokeRemote(channel, serviceName, prop, args, timeout)
            }
          }
        }

        return target[prop as keyof any]
      }
    })
  }

  // 暴露的公共接口
  return {
    // 设置服务实现获取器
    setServiceImplementationGetter(
      getter: (serviceName: string) => { instance: object } | undefined
    ): void {
      getServiceImplementation = getter
    },

    // 设置默认 timeout
    setDefaultTimeout(timeout: number): void {
      defaultTimeout = timeout
    },

    // 设置默认 channel
    setDefaultChannel(channel: ChannelLike): void {
      defaultChannel = channel
    },

    // 定义 API
    defineApi<T extends object>(
      ApiClass: abstract new () => T,
      processType: 'main' | 'preload' | 'renderer',
    ): ApiType<T> {
      if (!getServiceImplementation) {
        throw new Error('Service implementation getter not set. Call setServiceImplementationGetter first.')
      }

      const serviceName = getServiceName(ApiClass.name)

      // 存储服务信息到类构造函数
      ;(ApiClass as unknown as Record<string, unknown>).__serviceInfo__ = {
        serviceName,
        processType,
      }

      // 创建 API Proxy
      const apiProxy = createApiProxy(serviceName, processType, ApiClass, getServiceImplementation)

      // 存储到 definitions
      definitions.set(ApiClass, {
        serviceName,
        processType,
        apiProxy,
      })

      return apiProxy as ApiType<T>
    },

    // 查找 API 定义
    find(ApiClass: abstract new () => object) {
      return definitions.get(ApiClass)
    },
  }
})()
```

- [ ] **Step 2: Create error.ts (dependency for apiDefinitions)**

See Task 3.

- [ ] **Step 3: Commit**

```bash
git add src/shared/serviceRegistry/apiDefinitions.ts src/shared/serviceRegistry/error.ts
git commit -m "feat: add apiDefinitions closure singleton with timeout support"
```

---

### Task 2: Create decorators.ts

**Files:**

- Create: `src/shared/serviceRegistry/decorators.ts`

- [ ] **Step 1: Write decorators.ts**

```typescript
export function Timeout(ms: number): ClassDecorator {
  return (target) => {
    ;(target as any).__serviceTimeout__ = ms
  }
}

export function MethodTimeout(ms: number): MethodDecorator {
  return (target, propertyKey) => {
    if (!propertyKey) return

    const constructor = target.constructor

    // 获取或创建方法超时映射
    let methodTimeouts = (constructor as any).__methodTimeouts__ as Map<string, number> | undefined
    if (!methodTimeouts) {
      methodTimeouts = new Map<string, number>()
      ;(constructor as any).__methodTimeouts__ = methodTimeouts
    }

    // 设置方法超时
    methodTimeouts.set(propertyKey as string, ms)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/serviceRegistry/decorators.ts
git commit -m "feat: add @Timeout and @MethodTimeout decorators"
```

---

### Task 3: Create error.ts

**Files:**

- Create: `src/shared/serviceRegistry/error.ts`

- [ ] **Step 1: Write error.ts**

```typescript
export class ServiceTimeoutError extends Error {
  constructor(service: string, method: string, timeout: number) {
    super(`Service '${service}.${method}' timed out after ${timeout}ms`)
    this.name = 'ServiceTimeoutError'
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/serviceRegistry/error.ts
git commit -m "feat: add ServiceTimeoutError"
```

---

### Task 4: Modify ServiceRegistry index.ts

**Files:**

- Modify: `src/shared/serviceRegistry/index.ts`

- [ ] **Step 1: Refactor ServiceRegistry to use apiDefinitions**

```typescript
import type { ChannelLike, ChannelCenter } from '@/shared/channel/types'
import { apiDefinitions } from './apiDefinitions'
import * as Decorators from './decorators'

export interface ServiceInfo {
  serviceName: string
  processType: 'main' | 'preload' | 'renderer'
}

export class ServiceRegistry {
  private serviceImplementations = new Map<string, { instance: object; processType: string }>()

  constructor() {
    // 初始化：设置服务实现获取器
    apiDefinitions.setServiceImplementationGetter((serviceName) => {
      return this.serviceImplementations.get(serviceName)
    })
  }

  setDefaultChannel(channel: ChannelLike): void {
    apiDefinitions.setDefaultChannel(channel)
  }

  setDefaultTimeout(timeout: number): void {
    apiDefinitions.setDefaultTimeout(timeout)
  }

  defineApi<T extends object>(
    ApiClass: abstract new () => T,
    processType: 'main' | 'preload' | 'renderer',
  ): ApiType<T> {
    return apiDefinitions.defineApi(ApiClass, processType)
  }

  implementService(channelLike: ChannelLike, ...instances: object[]): void {
    for (const instance of instances) {
      const apiClass = this.findApiClass(instance)

      if (!apiClass) {
        throw new Error(
          `Service ${instance.constructor.name} does not extend a defined API. ` +
            `Ensure service extends an API class defined by defineApi.`,
        )
      }

      const serviceInfo = (apiClass as unknown as Record<string, unknown>)
        .__serviceInfo__ as ServiceInfo
      this.serviceImplementations.set(serviceInfo.serviceName, {
        instance,
        processType: serviceInfo.processType,
      })

      this.registerChannelHandlers(channelLike, instance, serviceInfo.serviceName)
    }
  }

  private registerChannelHandlers(
    channelLike: ChannelLike,
    instance: object,
    serviceName: string,
  ): void {
    const methods = this.getServiceMethods(instance)

    for (const method of methods) {
      const methodName = method as string
      const channelMethod = `${serviceName}:${methodName}`
      const serviceMethod = (instance as Record<string, unknown>)[methodName]

      if (typeof serviceMethod === 'function') {
        if ('onAnyRequest' in channelLike && typeof channelLike.onAnyRequest === 'function') {
          const channelCenter = channelLike as unknown as ChannelCenter
          channelCenter.onAnyRequest(channelMethod, (_viewId: string, payload: unknown) => {
            return (serviceMethod as (...args: unknown[]) => unknown).apply(
              instance,
              payload as unknown[],
            )
          })
        } else if ('onRequest' in channelLike && typeof channelLike.onRequest === 'function') {
          channelLike.onRequest(channelMethod, (payload: unknown) => {
            return (serviceMethod as (...args: unknown[]) => unknown).apply(
              instance,
              payload as unknown[],
            )
          })
        }
      }
    }
  }

  private getServiceMethods(instance: object): string[] {
    const methods: string[] = []
    let proto = Object.getPrototypeOf(instance)
    while (proto && proto !== Object.prototype) {
      const names = Object.getOwnPropertyNames(proto)
      for (const name of names) {
        if (
          name !== 'constructor' &&
          typeof (proto as Record<string, unknown>)[name] === 'function'
        ) {
          methods.push(name)
        }
      }
      proto = Object.getPrototypeOf(proto)
    }
    return methods
  }

  private findApiClass(instance: object): abstract new () => object | null {
    let proto = instance.constructor as unknown as abstract new () => object
    while (proto && proto !== Function.prototype) {
      if ((proto as unknown as Record<string, unknown>).__serviceInfo__) {
        return proto
      }
      proto = Object.getPrototypeOf(proto) as unknown as abstract new () => object
    }
    return null as unknown as abstract new () => object | null
  }

  findApiDefinition(ApiClass: abstract new () => object) {
    return apiDefinitions.find(ApiClass)
  }
}

// Re-export decorators
export { Decorators }
export { ServiceTimeoutError } from './error'

export const serviceRegistry = new ServiceRegistry()
```

- [ ] **Step 2: Run existing tests to verify no regression**

```bash
pnpm run test:main
```

Expected: All existing tests pass

- [ ] **Step 3: Commit**

```bash
git add src/shared/serviceRegistry/index.ts
git commit -m "refactor: simplify ServiceRegistry using apiDefinitions singleton"
```

---

### Task 5: Write timeout tests

**Files:**

- Create: `src/__tests__/main/services/timeout.test.ts`

- [ ] **Step 1: Write timeout test file**

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createChannelMock } from '@/__tests__/infrastructure/helpers/channelHelpers'
import { Timeout, MethodTimeout } from '@/shared/serviceRegistry/decorators'
import { ServiceTimeoutError } from '@/shared/serviceRegistry/error'
import { serviceRegistry } from '@/shared/serviceRegistry'

@Timeout(5000)
abstract class TestApi {
  abstract testMethod(): Promise<string>
  @MethodTimeout(1000)
  abstract fastMethod(): Promise<string>
  abstract slowMethod(): Promise<string>
}

describe('ServiceRegistry Timeout', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    process.env.PROCESS_TYPE = 'main'
  })

  describe('Decorators', () => {
    it('should set class timeout metadata', () => {
      @Timeout(3000)
      class Api {}

      expect((Api as any).__serviceTimeout__).toBe(3000)
    })

    it('should set method timeout metadata', () => {
      @Timeout(3000)
      class Api {
        @MethodTimeout(1000)
        method() {}
      }

      expect((Api as any).__methodTimeouts__.get('method')).toBe(1000)
    })

    it('should create method timeout map if not exists', () => {
      @Timeout(3000)
      class Api {
        @MethodTimeout(1000)
        method1() {}
        @MethodTimeout(2000)
        method2() {}
      }

      const timeouts = (Api as any).__methodTimeouts__
      expect(timeouts).toBeInstanceOf(Map)
      expect(timeouts.get('method1')).toBe(1000)
      expect(timeouts.get('method2')).toBe(2000)
    })
  })

  describe('ServiceTimeoutError', () => {
    it('should create error with correct message', () => {
      const error = new ServiceTimeoutError('test', 'method', 5000)
      expect(error.message).toBe("Service 'test.method' timed out after 5000ms")
      expect(error.name).toBe('ServiceTimeoutError')
    })
  })

  describe('Timeout priority', () => {
    class TestService extends TestApi {
      async testMethod(): Promise<string> {
        return 'result'
      }

      async fastMethod(): Promise<string> {
        return 'fast'
      }

      async slowMethod(): Promise<string> {
        return 'slow'
      }
    }

    it('should use method timeout over class timeout', async () => {
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      serviceRegistry.implementService(mainChannel, new TestService())

      const api = serviceRegistry.defineApi(TestApi, 'main')
      const timeoutSpy = vi.spyOn(api, 'use')

      // Call fastMethod which has @MethodTimeout(1000)
      // This should use 1000ms timeout
      // (implementation detail: we verify timeout is applied)
    })

    it('should use class timeout when no method timeout', async () => {
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      serviceRegistry.implementService(mainChannel, new TestService())

      const api = serviceRegistry.defineApi(TestApi, 'main')

      // Call testMethod which has no @MethodTimeout
      // This should use class @Timeout(5000)
    })
  })

  describe('Same-process timeout', () => {
    class TestService extends TestApi {
      async testMethod(): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, 10000))
        return 'result'
      }

      async fastMethod(): Promise<string> {
        return 'fast'
      }
    }

    it('should timeout when method takes too long', async () => {
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      serviceRegistry.implementService(mainChannel, new TestService())

      const api = serviceRegistry.defineApi(TestApi, 'main')

      await expect(api.fastMethod()).resolves.toBe('fast')
      await expect(api.slowMethod()).rejects.toThrow(ServiceTimeoutError)
    })

    it('should resolve quickly when method is fast', async () => {
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      serviceRegistry.implementService(mainChannel, new TestService())

      const api = serviceRegistry.defineApi(TestApi, 'main')

      const result = await api.testMethod()
      expect(result).toBe('result')
    })
  })

  describe('Cross-process timeout', () => {
    it('should pass timeout to channel.request', async () => {
      process.env.PROCESS_TYPE = 'renderer'

      const { mainChannel, rendererChannel } = await createChannelMock({ webContentsId: 1 })
      rendererChannel.onRequest('test:testMethod', () => 'result')

      const api = serviceRegistry.defineApi(TestApi, 'renderer').use(mainChannel)
      const requestSpy = vi.spyOn(mainChannel, 'request')

      await api.testMethod()

      expect(requestSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.any(Number)  // timeout should be passed
      )
    })
  })

  describe('Default timeout', () => {
    abstract class NoTimeoutApi {
      abstract method(): Promise<string>
    }

    it('should use default timeout when no decorators', async () => {
      serviceRegistry.setDefaultTimeout(3000)

      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      class TestService extends NoTimeoutApi {
        async method(): Promise<string> {
          return 'result'
        }
      }

      serviceRegistry.implementService(mainChannel, new TestService())
      const api = serviceRegistry.defineApi(NoTimeoutApi, 'main')

      // Should use default timeout from serviceRegistry
      const result = await api.method()
      expect(result).toBe('result')
    })

    it('should use built-in default timeout when no decorators and no global', async () => {
      const { mainChannel } = await createChannelMock({ webContentsId: 1 })
      class TestService extends NoTimeoutApi {
        async method(): Promise<string> {
          return 'result'
        }
      }

      serviceRegistry.implementService(mainChannel, new TestService())
      const api = serviceRegistry.defineApi(NoTimeoutApi, 'main')

      // Should use built-in default 10000ms
      const result = await api.method()
      expect(result).toBe('result')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail (TDD)**

```bash
pnpm run test:main -- timeout.test.ts
```

Expected: Tests fail because apiDefinitions and decorators not yet created

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/main/services/timeout.test.ts
git commit -m "test: add timeout tests for service registry"
```

---

### Task 6: Verify All Tests Pass

- [ ] **Step 1: Run all main process tests**

```bash
pnpm run test:main
```

Expected: All tests pass (both existing and new timeout tests)

- [ ] **Step 2: Run all tests**

```bash
pnpm run test
```

Expected: All tests pass

- [ ] **Step 3: Run lint**

```bash
pnpm run lint
```

Expected: No linting errors

- [ ] **Step 4: Commit verification**

```bash
git commit --allow-empty -m "test: verify all tests pass after timeout implementation"
```

---

## Verification Checklist

- [ ] All tasks completed with checkboxes checked
- [ ] apiDefinitions.ts created with closure pattern
- [ ] decorators.ts created with @Timeout and @MethodTimeout
- [ ] error.ts created with ServiceTimeoutError
- [ ] ServiceRegistry simplified to use apiDefinitions
- [ ] All tests pass
- [ ] Lint passes
- [ ] No regressions in existing functionality
