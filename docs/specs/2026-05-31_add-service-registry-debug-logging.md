# Spec: 为 ServiceRegistry 添加 debug 级别调用日志

> **阶段**: Plan | **状态**: LOCKED | **层级**: Feature Spec

## 1. 目标与边界

### Goal
在 ServiceRegistry 的 API 调用链路中添加统一的 debug 级别日志，覆盖：服务注册、本地调用、远程调用（发送+接收），方便排查跨进程服务调用问题。

### In Scope
- `apiDefinitions.ts` 的 `createApiProxy`：本地调用和远程调用发起时记录
- `apiDefinitions.ts` 的 `invokeRemote`：IPC 请求发送时记录
- `index.ts` 的 `implementService`：服务注册时记录
- `index.ts` 的 `registerChannelHandlers`：接收到请求时记录

### Out of Scope
- 不修改日志系统本身
- 不添加 trace/silly 级别的详细参数序列化日志
- 不修改 Channel 层的已有日志

### Acceptance Criteria
1. 本地调用时输出 `debug` 日志：`[serviceRegistry] ServiceName.method (local)`
2. 远程调用发起时输出 `debug` 日志：`[serviceRegistry] ServiceName.method → remote`
3. 接收请求时输出 `debug` 日志：`[serviceRegistry] ServiceName.method ← request`
4. 服务注册时输出 `debug` 日志：`[serviceRegistry] Registered ServiceName (processType)`
5. `pnpm run typecheck` / `lint` / `test` 全通过
6. 日志使用 `logger(__SOURCE_FILE__)` 模式，与项目现有风格一致

## 1.6 Research Findings

### 现状
- `src/shared/serviceRegistry/` 当前零日志
- `src/shared/channel/` 已使用 `logger(__SOURCE_FILE__)` 模式（portManager.ts、index.ts）
- 日志级别：`error | warn | info | verbose | debug | silly`
- `__SOURCE_FILE__` 由 `sourceFilePlugin` 在编译时注入，值为相对 `src/` 的路径

### 关键代码位置

1. **本地调用**: `apiDefinitions.ts` 约 94-113 行，`process.env.PROCESS_TYPE === processType` 分支
2. **远程调用发起**: `apiDefinitions.ts` 约 115-128 行，else 分支 → `invokeRemote`
3. **远程 IPC 发送**: `apiDefinitions.ts` 的 `invokeRemote` 函数，约 49-70 行
4. **请求接收处理**: `index.ts` 的 `registerChannelHandlers`，约 78-95 行
5. **服务注册**: `index.ts` 的 `implementService`，约 41-72 行

### 日志风格

沿用 Channel 层模式：
```typescript
import { logger } from '@/shared/utils/log';
const log = logger(__SOURCE_FILE__);
log.debug(`message`, ...params);
```

## 3. Plan — 实施清单

### File Changes

| 文件 | 改动 |
|------|------|
| `src/shared/serviceRegistry/apiDefinitions.ts` | 引入 logger，在 createApiProxy 本地/远程调用和 invokeRemote 中添加 debug 日志 |
| `src/shared/serviceRegistry/index.ts` | 引入 logger，在 implementService 和 registerChannelHandlers 中添加 debug 日志 |

### Implementation Checklist

- [ ] 1. `apiDefinitions.ts`: 引入 logger，声明 `const log = logger(__SOURCE_FILE__)`
- [ ] 2. `apiDefinitions.ts`: 本地调用路径添加 `log.debug`
- [ ] 3. `apiDefinitions.ts`: 远程调用路径（invokeRemote）添加 `log.debug`
- [ ] 4. `index.ts`: 引入 logger，声明 `const log = logger(__SOURCE_FILE__)`
- [ ] 5. `index.ts`: `implementService` 添加注册日志
- [ ] 6. `index.ts`: `registerChannelHandlers` 添加请求接收日志
- [ ] 7. 运行 `pnpm run typecheck` + `pnpm run lint` + `pnpm run test`

### Validation

- typecheck / lint / test 全通过
- 代码风格与 channel/ 层日志一致

## Open Questions

无。
