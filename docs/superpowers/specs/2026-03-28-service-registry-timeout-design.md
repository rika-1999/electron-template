# Service Registry Timeout 机制设计

**日期**: 2026-03-28
**状态**: Draft

## 概述

为 Service Registry 添加 timeout 机制，支持装饰器配置和全局默认值，同时适用于同进程和跨进程调用。

## 需求

### 功能需求

1. **装饰器支持**
   - 类装饰器 `@Timeout(ms)`：设置整个 API 类的默认 timeout
   - 方法装饰器 `@MethodTimeout(ms)`：设置单个方法的 timeout
   - 单位固定为毫秒

2. **全局默认值**
   - 通过 `serviceRegistry.setDefaultTimeout(ms)` 配置
   - 如果未设置，使用内置默认值（10000ms）

3. **同进程调用 timeout**
   - 使用 `Promise.race` 模式实现
   - 超时后抛出 `ServiceTimeoutError`
   - 不关心超时后的方法执行是否取消

4. **跨进程调用 timeout**
   - 将 timeout 参数传递给 `channel.request(method, payload, timeout)`
   - Channel 已支持 timeout，无需修改

### 非功能需求

- **向后兼容**：无装饰器时使用默认 timeout，不影响现有代码
- **优先级清晰**：方法 > 类 > 全局默认 > 内置默认
- **类型安全**：装饰器元数据使用 TypeScript 类型断言
- **一致性**：同进程和跨进程调用使用相同的 timeout 机制

## 依赖

### Channel API

Channel 已支持 timeout 参数（`src/shared/channel/impl.ts:70`）：

```typescript
request(method: string, payload?: unknown, timeout?: number): Promise<unknown>
```

跨进程调用将 timeout 作为第三个参数传递给 `channel.request()`。

## 设计方案

### API 设计

```typescript
// 装饰器
@Timeout(5000)
class UpdaterApi {
  // 继承类级 timeout = 5000ms
  async checkForUpdates(): Promise<void> { ... }

  // 方法级 timeout 覆盖类级 = 3000ms
  @MethodTimeout(3000)
  async quitAndInstall(): Promise<void> { ... }

  // 无装饰器，使用全局默认值
  async getUpdateInfo(): Promise<void> { ... }
}

// 全局配置
serviceRegistry.setDefaultTimeout(5000)
```

### Timeout 优先级

```
方法装饰器 > 类装饰器 > ServiceRegistry 默认值 > 内置默认值(10000ms)
```

示例：

- `@MethodTimeout(3000)` → 3000ms
- `@Timeout(5000)` 且方法无装饰器 → 5000ms
- 无任何装饰器，`setDefaultTimeout(4000)` → 4000ms
- 无任何装饰器，无全局配置 → 10000ms

### 同进程调用实现

```typescript
const timeout = getEffectiveTimeout(apiClass, methodName)
const result = await Promise.race([
  implMethod(...args),
  createTimeoutPromise(serviceName, methodName, timeout),
])

function createTimeoutPromise(service: string, method: string, ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new ServiceTimeoutError(service, method, ms))
    }, ms)
  })
}
```

### 跨进程调用实现

```typescript
const timeout = getEffectiveTimeout(apiClass, methodName)
await channel.request(`${serviceName}:${methodName}`, args, timeout)
```

## 架构

### 组件关系

```
┌─────────────────────────────────────────────────────────────┐
│                    ServiceRegistry                           │
│  - setDefaultTimeout(ms)                                     │
│  - defineApi(ApiClass, processType)                          │
│  - implementService(channel, ...instances)                   │
│  - getEffectiveTimeout(apiClass, method): number             │
│  - defaultTimeout: number | undefined (全局默认值)            │
│  - BUILT_IN_DEFAULT_TIMEOUT = 10000 (内置默认值)             │
└─────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┴────────────────┐
          │                                 │
    ┌─────▼─────┐                   ┌──────▼──────┐
    │ 同进程调用  │                   │  跨进程调用   │
    └─────┬─────┘                   └──────┬──────┘
          │                                 │
          │ Promise.race                    │ channel.request
          │ + timeoutError                  │ (method, args, timeout)
          │                                 │
    ┌─────▼─────┐                   ┌──────▼──────┐
    │ 直接执行   │                   │  Channel     │
    └───────────┘                   └─────────────┘
```

### 文件结构

```
src/shared/serviceRegistry/
├── index.ts              # ServiceRegistry 主类（简化）
├── api-definitions.ts    # 单例工具：defineApi、apiDefinitions、defaultTimeout、defaultChannel（新增）
├── decorators.ts         # 装饰器实现（新增）
└── error.ts              # ServiceTimeoutError（新增）

src/__tests__/main/services/
└── timeout.test.ts       # Timeout 测试（新增）
```

**代码分离说明：**

- `api-definitions.ts`：单例工具，导出 `apiDefinitions` 对象，包含 defineApi、apiDefinitions Map、defaultTimeout、defaultChannel
- `index.ts`：负责服务注册管理（serviceImplementations），持有并使用 `apiDefinitions` 单例
- `decorators.ts`：装饰器实现
- `error.ts`：错误类型

## 数据流

### 同进程调用

```
1. userApi.method()
2. getEffectiveTimeout(apiClass, methodName) 获取有效 timeout
   - 优先级：方法装饰器 > 类装饰器 > 全局默认值 > 内置默认值
3. Promise.race([
      impl.method(...args),
      createTimeoutPromise(service, method, timeout)
    ])
4. 返回结果或抛出 ServiceTimeoutError
```

### 跨进程调用

```
1. userApi.method()
2. getEffectiveTimeout(apiClass, methodName) 获取有效 timeout
3. channel.request('service:method', args, timeout)
4. Channel 使用 timeout 等待响应
5. 返回结果或抛出 ChannelTimeoutError
```

## 错误处理

### 错误类型

```typescript
class ServiceTimeoutError extends Error {
  constructor(service: string, method: string, timeout: number) {
    super(`Service '${service}.${method}' timed out after ${timeout}ms`)
    this.name = 'ServiceTimeoutError'
  }
}
```

### 错误传播

- **同进程调用**：抛出 `ServiceTimeoutError`
- **跨进程调用**：抛出 `ChannelTimeoutError`（由 Channel 抛出）

## 元数据存储

### 类装饰器元数据

```typescript
// 存储在类构造函数上
;(ApiClass as any).__serviceTimeout__ = 5000
```

### 方法装饰器元数据

```typescript
// 存储在类构造函数上，Map<methodName, timeout>
;(ApiClass as any).__methodTimeouts__ = new Map([['checkForUpdates', 3000]])
```

## 测试策略

### 测试场景

1. **装饰器元数据**
   - 类装饰器正确设置 `__serviceTimeout__`
   - 方法装饰器正确设置 `__methodTimeouts__`
   - 元数据存储在类构造函数上

2. **Timeout 优先级**
   - 方法装饰器覆盖类装饰器
   - 类装饰器覆盖全局默认值
   - 全局默认值覆盖内置默认值
   - 无配置时使用内置默认值

3. **同进程调用**
   - 正常返回结果
   - 超时抛出 `ServiceTimeoutError`
   - 超时时间正确

4. **跨进程调用**
   - 正确传递 timeout 给 channel
   - Channel 使用 timeout 等待响应

5. **向后兼容**
   - 无装饰器时不报错
   - 现有测试通过

### 测试文件

`src/__tests__/main/services/timeout.test.ts`

## 实现计划

### 步骤 0: 代码重构（分离 defineApi 逻辑）

**目标**：将 `defineApi` 及其相关逻辑从 `index.ts` 分离到独立的 `api-definitions.ts` 文件，作为一个单例工具。

**依赖分析：**

| 成员                     | 用途          | 可挪入  | 原因                       |
| ------------------------ | ------------- | ------- | -------------------------- |
| `apiDefinitions`         | 存储 API 定义 | ✅ 可以 | 与 defineApi 紧密相关      |
| `getServiceName`         | 生成服务名    | ✅ 可以 | 简单工具函数               |
| `getCurrentProcessType`  | 进程类型检查  | ✅ 可以 | 简单工具函数               |
| `invokeRemote`           | 跨进程调用    | ✅ 可以 | 只依赖 channelLike         |
| `defaultTimeout`         | 默认 timeout  | ✅ 可以 | 由 apiDefinitions 单例管理 |
| `defaultChannel`         | 默认 channel  | ✅ 可以 | 由 apiDefinitions 单例管理 |
| `serviceImplementations` | 存储实现      | ❌ 不行 | ServiceRegistry 核心状态   |

**创建 `src/shared/serviceRegistry/api-definitions.ts`：**

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

  // 内部函数：获取服务名
  function getServiceName(className: string): string {
    return className.replace(/Api$/, '').toLowerCase()
  }

  // 内部函数：获取进程类型
  function getCurrentProcessType(): 'main' | 'preload' | 'renderer' {
    return (process.env.PROCESS_TYPE as 'main' | 'preload' | 'renderer') || 'main'
  }

  // 内部函数：获取有效的 timeout 值
  function getEffectiveTimeout(apiClass: abstract new () => object, methodName: string): number {
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
      throw new Error(
        'Cannot use ChannelCenter directly. Please use specific channel via .use(channel)',
      )
    }

    if ('request' in channelLike && typeof channelLike.request === 'function') {
      // 传递 timeout 参数（ChannelLike 可能需要类型断言）
      return (
        channelLike as { request: (m: string, p?: unknown, t?: number) => Promise<unknown> }
      ).request(channelMethod, args, timeout)
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
            return createApiProxy(
              serviceName,
              processType,
              ApiClass,
              getServiceImplementation,
              newChannel,
            )
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
                  createTimeoutPromise(serviceName, prop, timeout),
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
      },
    })
  }

  // 服务实现获取器（由 ServiceRegistry 设置）
  let getServiceImplementation: ((serviceName: string) => { instance: object } | undefined }) | null = null

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

**简化 `src/shared/serviceRegistry/index.ts`：**

```typescript
import type { ChannelLike } from '@/shared/channel/types'
import { apiDefinitions } from './api-definitions'

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
    // ... 现有实现保持不变 ...
  }

  findApiDefinition(ApiClass: abstract new () => object) {
    return apiDefinitions.find(ApiClass)
  }

  // 其他私有方法保持不变：registerChannelHandlers, getServiceMethods, findApiClass
}
```

### 步骤 1: 创建装饰器模块

创建 `src/shared/serviceRegistry/decorators.ts`

- 实现 `@Timeout(ms)` 类装饰器
- 实现 `@MethodTimeout(ms)` 方法装饰器

### 步骤 2: 创建错误类型

创建 `src/shared/serviceRegistry/error.ts`

- 实现 `ServiceTimeoutError` 类

### 步骤 3: 修改 ServiceRegistry

修改 `src/shared/serviceRegistry/index.ts`

**新增属性和方法：**

```typescript
// 内置默认值
private static readonly BUILT_IN_DEFAULT_TIMEOUT = 10000

// 全局默认值（可通过 setDefaultTimeout 设置）
private defaultTimeout: number | undefined = undefined

// 设置全局默认 timeout
setDefaultTimeout(timeout: number): void {
  this.defaultTimeout = timeout
}

// 获取有效的 timeout 值（按优先级：方法 > 类 > 全局 > 内置）
// 注意：装饰器元数据存储在类构造函数上，不在 apiDefinitions 中重复存储
private getEffectiveTimeout(
  apiClass: abstract new () => object,
  methodName: string
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

  // 3. 使用全局默认值或内置默认值
  return this.defaultTimeout ?? ServiceRegistry.BUILT_IN_DEFAULT_TIMEOUT
}
```

**修改 invokeRemote 方法签名：**

```typescript
private async invokeRemote(
  channelLike: ChannelLike,
  serviceId: string,
  method: string,
  args: unknown[],
  timeout: number,  // 新增参数（总是有值）
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
```

**导出装饰器和错误类型：**

```typescript
export * from './decorators'
export * from './error'
export * from './api-proxy'
```

**注意**：同进程调用的 timeout 逻辑已在 `api-proxy.ts` 的 `createApiProxy` 中实现。

### 步骤 4: 编写测试

创建 `src/__tests__/main/services/timeout.test.ts`

- 装饰器元数据测试
- Timeout 优先级测试
- 同进程调用超时测试
- 跨进程调用超时测试
- 向后兼容测试

### 步骤 5: 验证

- 运行所有测试
- 确保现有测试通过（重构后不应破坏任何功能）
- 检查 lint 和 typecheck

**重构验证清单：**

- [ ] `api-definitions.ts` 正确导出 `apiDefinitions` 单例
- [ ] `apiDefinitions` 使用闭包隐藏内部实现
- [ ] `apiDefinitions` 包含 `defaultTimeout` 和 `defaultChannel`，可通过 set 修改
- [ ] `apiDefinitions` 包含 `getServiceImplementation` 闭包变量，通过 `setServiceImplementationGetter()` 设置
- [ ] `index.ts` ServiceRegistry 构造函数调用 `apiDefinitions.setServiceImplementationGetter()`
- [ ] `index.ts` 通过 `apiDefinitions.defineApi()` 创建 API Proxy（无需传递 getter）
- [ ] `index.ts` 通过 `apiDefinitions.setDefaultChannel()` 设置默认 channel
- [ ] 同进程调用逻辑正确
- [ ] 跨进程调用逻辑正确
- [ ] timeout 处理正确
- [ ] 所有现有测试通过
- [ ] `index.ts` 不再直接包含 Proxy 逻辑

## 验收标准

- [ ] 装饰器正确存储元数据
- [ ] Timeout 优先级正确
- [ ] 同进程调用支持超时
- [ ] 跨进程调用正确传递 timeout
- [ ] 超时错误类型正确
- [ ] 全局默认值配置有效
- [ ] 无装饰器时使用默认值
- [ ] **代码分离完成**：defineApi 及相关逻辑已移至 `api-definitions.ts` 单例
- [ ] **闭包设计**：`apiDefinitions` 使用闭包隐藏内部函数和状态
- [ ] **单例设计**：`apiDefinitions` 包含 defaultTimeout 和 defaultChannel，可被 set 修改
- [ ] **单例设计**：`apiDefinitions` 包含 getServiceImplementation 闭包变量，通过 setServiceImplementationGetter() 设置
- [ ] **ServiceRegistry 使用单例**：构造函数中调用 `apiDefinitions.setServiceImplementationGetter()`，后续通过 apiDefinitions 进行操作
- [ ] **简化调用**：`defineApi` 无需传递 `getServiceImplementation` 参数
- [ ] **重构后测试通过**：现有测试不受影响
- [ ] 所有新测试通过
- [ ] Lint 和 typecheck 通过

## 参考文档

- [Channel Architecture](../channel.md)
- [Service Registry](../../shared/serviceRegistry/index.ts)
- [Patterns](../patterns.md)
