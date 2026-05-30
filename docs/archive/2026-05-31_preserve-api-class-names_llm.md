# Archive (LLM): 保留 API 类名修复生产构建服务路由

## 1. Task Snapshot

- **Goal**: 消除 ServiceRegistry 对 `Function.name` 的依赖，API 类声明 `static apiName`
- **In-Scope**: getServiceName 改读 apiName、3 生产 API 类 + 15 测试 API 类声明、Singleton 类型修复
- **Out-of-Scope**: 编译配置改动、defineApi 签名改动、service 实现改动

## 2. Stable Facts & Constraints

- Electron 三进程独立构建，同一源码在 main/preload/renderer bundle 中可能被 minify 为不同名称
- `Function.name` 在 esbuild minify 后不可靠，不能用于跨 bundle 一致性标识
- `static apiName = '...'` 是字符串字面量赋值，minify 后保持不变
- `getServiceName()` 有 `ApiClass.name` fallback，未声明 apiName 的类仍可工作（但生产构建不安全）

## 3. Interfaces & Contracts

- **`static apiName` 约定**: 所有传给 `defineApi()` 的抽象 API 类必须声明此静态属性
- Breaking Change: No（向后兼容，但未声明 apiName 的类在生产构建中有风险）
- 签名变化: `Singleton` 装饰器从 `Constructor<T, P>` 改为 `<T extends Constructor>`

## 4. Code Touchpoints

- **Entry Points**: `serviceMetadataRegistry.getServiceName()` — 核心改动点
- **Core Files**:
  - `src/shared/serviceRegistry/serviceMetadataRegistry.ts` — apiName 读取逻辑
  - `src/shared/services/counterApi.ts`, `rendererApi.ts`, `updaterApi.ts` — 生产 API 类
  - `src/shared/utils/singleton.ts` — 装饰器类型修复
- **Hotspots**: 新增 API 类时必须声明 `static apiName`

## 5. Accepted Patterns / Rejected Paths

- **Accepted**: `static apiName` 静态属性模式
- **Rejected**: `esbuild.keepNames: true`（保留范围过广）、显式 serviceName 参数（需改 defineApi 签名）

## 6. Reuse Hints for Future Tasks

- 新增 Service API 时，参照 `counterApi.ts` 模式：`abstract class XxxApi { static apiName = 'XxxApi'; ... }`
- `Singleton` 装饰器类型签名已修复为保留子类静态属性，新增带静态属性的父类时不会出现 TS1270

## 7. Trace to Sources

| Statement | Source File | Section / Evidence |
|---|---|---|
| getServiceName 改动 | `src/shared/serviceRegistry/serviceMetadataRegistry.ts:84` | 1 行改动 |
| apiName 一致性验证 | bundle diff output | Main vs Renderer |
| Singleton 类型修复 | `src/shared/utils/singleton.ts` | 泛型签名变更 |
