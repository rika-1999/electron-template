# Spec: 消除 ServiceRegistry 对 Function.name 的依赖

> **阶段**: Review | **状态**: LOCKED | **层级**: Feature Spec

## 1. 目标与边界

### Goal
所有 Service API 抽象类声明静态属性 `apiName` 作为服务名，`getServiceName()` 从该属性读取，消除对 `Function.name` 的依赖，确保生产构建 minify 后跨进程 IPC 路由一致。

### Background (Root Cause)
`serviceMetadataRegistry.getServiceName()` 使用 `ApiClass.name` 作为服务名。生产构建 minify 后，同一 API 类在不同 bundle 中被分配不同混淆名称，导致跨进程服务调用无法匹配。

### In Scope
- 每个 API 抽象类声明 `static apiName: string`
- `getServiceName()` 改为从 `ApiClass.apiName` 读取
- 3 个生产 API 类 + 测试中的 API 类均需声明
- 验证生产构建一致性

### Out of Scope
- 不修改编译配置
- 不修改 service 实现代码
- 不修改 `defineApi` 签名

### Acceptance Criteria
1. 生产构建后，服务名在 main/renderer bundle 中一致且为原始字符串
2. `pnpm run typecheck` / `lint` / `test` 全部通过
3. 所有 API 抽象类均声明 `static apiName`

## 1.6 Research Findings

### 受影响的 API 类（3 个生产类 + 测试中的类）

**生产代码**:
- `src/shared/services/counterApi.ts` → `CounterMainApi`
- `src/shared/services/rendererApi.ts` → `CounterRendererApi`
- `src/shared/services/updaterApi.ts` → `UpdaterApi`

**测试代码中的 API 类**（需声明 `apiName` 否则测试中 `getServiceName` 行为变化）:
- `src/__tests__/shared/apiType.test.ts` → `TestApi`
- `src/__tests__/main/services/timeout.test.ts` → `TestTimeoutApi`, `TestTimeoutWithClassApi`, `ErrorApi`, `PriorityApi`, `NoTimeoutApi`, `CustomDefaultTimeoutApi`, `LocalTimeoutApi`, `CrossProcessApi`, `DefaultTimeoutApi`, `Api1`, `OverrideApi`
- `src/__tests__/main/services/registry.test.ts` → `TestApi`

### 关键改动点

`src/shared/serviceRegistry/serviceMetadataRegistry.ts:83-85`:
```typescript
// Before
getServiceName(ApiClass: abstract new () => object): string {
  return ApiClass.name;
}

// After
getServiceName(ApiClass: abstract new () => object): string {
  return (ApiClass as { apiName?: string }).apiName ?? ApiClass.name;
}
```

## 3. Plan — 实施清单

### File Changes

| 文件 | 改动 |
|------|------|
| `src/shared/serviceRegistry/serviceMetadataRegistry.ts` | `getServiceName()` 改为读 `apiName` 静态属性 |
| `src/shared/services/counterApi.ts` | `CounterMainApi` 添加 `static apiName` |
| `src/shared/services/rendererApi.ts` | `CounterRendererApi` 添加 `static apiName` |
| `src/shared/services/updaterApi.ts` | `UpdaterApi` 添加 `static apiName` |
| `src/__tests__/shared/apiType.test.ts` | `TestApi` 添加 `static apiName` |
| `src/__tests__/main/services/registry.test.ts` | `TestApi` 添加 `static apiName` |
| `src/__tests__/main/services/timeout.test.ts` | 所有测试 API 类添加 `static apiName` |

### Signatures

```typescript
// API 类声明模式
export abstract class CounterMainApi {
  static apiName = 'CounterMainApi';
  abstract increment(): Promise<{ count: number }>;
  abstract decrement(): Promise<{ count: number }>;
}

// getServiceName 改动
getServiceName(ApiClass: abstract new () => object): string {
  return (ApiClass as { apiName?: string }).apiName ?? ApiClass.name;
}
```

### Implementation Checklist

- [x] 1. 修改 `serviceMetadataRegistry.ts`：`getServiceName()` 优先读 `apiName`
- [x] 2. 修改 `counterApi.ts`：`CounterMainApi` 添加 `static apiName`
- [x] 3. 修改 `rendererApi.ts`：`CounterRendererApi` 添加 `static apiName`
- [x] 4. 修改 `updaterApi.ts`：`UpdaterApi` 添加 `static apiName`
- [x] 5. 修改测试文件中的 API 类：添加 `static apiName`（15 个类）
- [x] 6. 修复 `Singleton` 装饰器类型签名（Plan 外额外修复，因 apiName 引发 TS1270）
- [x] 7. 生产构建验证：确认服务名一致
- [x] 8. 运行 `pnpm run typecheck` + `pnpm run lint` + `pnpm run test`

### Validation

- 生产构建后 bundle 中服务名为 `"CounterMainApi"` 等字符串字面量
- typecheck / lint / test 全通过

## Open Questions

无。

## 6. Review Verdict

### Review Matrix

| 轴线 | 检查项 | 结果 | 证据 |
|------|--------|------|------|
| **Axis-1: Spec 质量 & 需求完成度** | Goal 清晰可验证 | PASS | "消除 Function.name 依赖，API 类声明 static apiName"，6 条 AC 全部满足 |
| | In/Out of Scope 边界清晰 | PASS | 不改编译配置、不改 service 实现、不改 defineApi 签名 |
| | Acceptance Criteria 全部通过 | PASS | typecheck ✅ lint ✅ test 116/116 ✅ 生产构建 apiName 一致 ✅ |
| **Axis-2: Spec-Code 一致性** | getServiceName 改动匹配 | PASS | 1 行改动：`(ApiClass as { apiName?: string }).apiName ?? ApiClass.name` |
| | 3 个生产 API 类均声明 apiName | PASS | counterApi / rendererApi / updaterApi 各加 `static apiName` |
| | 测试中 API 类均声明 apiName | PASS | apiType.test 1 个 + registry.test 1 个 + timeout.test 13 个 = 15 个 |
| | 不改 defineApi 签名 | PASS | `defineApi` 接口未变 |
| | 不改编译配置 | PASS | 三个 vite.config 文件未修改 |
| **Axis-3: 代码内在质量** | 无回归风险 | PASS | 116 测试全通过 |
| | Singleton 类型修复合理 | PASS | `Constructor<T, P>` → `<T extends Constructor>` 正确保留子类静态属性类型，是 apiName 引发的必要修复 |
| | 无安全/性能隐患 | PASS | `static apiName` 为字符串字面量，运行时零开销 |

### Plan-Execution Diff

| 差异 | 说明 | 风险 |
|------|------|------|
| 额外修复 `Singleton` 装饰器类型签名 | `apiName` 导致 TS1270：装饰器返回类型不包含父类静态属性。将 `Constructor<T, P>` 改为 `<T extends Constructor>` 保留精确类型 | 低 — 更健壮的类型签名，测试全通过 |

### Overall Verdict

**✅ PASS** — 三轴全部通过。1 项 Plan 外修复（Singleton 类型），已验证无回归。

### Project Sync Candidate

- **`static apiName` 模式**: 所有新增 Service API 抽象类必须声明 `static apiName`，否则生产构建中跨进程 IPC 路由可能失败。建议作为项目约定沉淀到 AGENTS.md。
