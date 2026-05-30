# Archive (Human): ServiceRegistry 添加 debug 调用日志

## 1. Executive Summary

- **背景与目标**: ServiceRegistry 跨进程服务调用链路无任何日志，排查生产问题时无法追踪调用流向
- **结论摘要**: 在 4 个关键节点添加 `log.debug`，沿用 `logger(__SOURCE_FILE__)` 模式

## 2. Key Decisions

- 使用 `debug` 级别（生产默认不输出，dev 环境可见）
- 日志格式：`ServiceName:method (local/→ remote/← request)`

## 4. Outcomes

- 4 个日志点：本地调用、远程调用发送、请求接收、服务注册
- 116 测试全通过

## 6. Trace to Sources

| Conclusion | Source File | Section |
|---|---|---|
| 4 个日志点 | `src/shared/serviceRegistry/apiDefinitions.ts`, `index.ts` | diff |
