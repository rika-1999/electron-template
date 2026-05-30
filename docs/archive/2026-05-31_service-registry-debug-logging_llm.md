# Archive (LLM): ServiceRegistry 添加 debug 调用日志

## 1. Task Snapshot

- **Goal**: ServiceRegistry 添加统一 debug 调用日志
- **In-Scope**: apiDefinitions.ts（本地+远程调用）、index.ts（注册+请求接收）
- **Out-of-Scope**: 日志系统、Channel 层、service 实现

## 2. Stable Facts

- `logger(__SOURCE_FILE__)` 是项目统一日志模式，`__SOURCE_FILE__` 由 Vite 插件注入
- `log.debug` 在生产环境默认不输出（level: info）
- 日志点覆盖完整调用链：注册 → 发起（local/remote）→ 接收

## 4. Code Touchpoints

- `src/shared/serviceRegistry/apiDefinitions.ts:106` — 本地调用日志
- `src/shared/serviceRegistry/apiDefinitions.ts:60` — 远程调用发送日志
- `src/shared/serviceRegistry/index.ts:69` — 服务注册日志
- `src/shared/serviceRegistry/index.ts:92` — 请求接收日志
