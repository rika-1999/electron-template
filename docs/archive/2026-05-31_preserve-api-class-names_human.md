# Archive (Human): 保留 API 类名修复生产构建服务路由

## 1. Executive Summary

- **背景与目标**: `ServiceRegistry` 使用 `Function.name` 作为跨进程 IPC 服务路由键。生产构建 minify 后同一类在不同 bundle 中被分配不同混淆名，导致所有跨进程服务调用失败。修复方案：API 抽象类声明 `static apiName` 消除对 `Function.name` 的依赖。
- **本次归档范围**: Feature Spec + 完整变更记录
- **结论摘要**: P0 bug 修复，8 文件改动，三轴评审 PASS

## 2. Scope & Sources

- Archive Mode: `snapshot`
- Source Targets:
  - `docs/specs/2026-05-31_preserve-api-class-names.md`
- Time Window: 2026-05-31

## 3. Key Decisions

- **决策 1**: 使用 `static apiName` 而非 `esbuild.keepNames`（后者保留所有名称，过于粗放）
- **决策 2**: `getServiceName()` 保留 `ApiClass.name` fallback（向后兼容）
- **决策 3**: 测试中 API 类也声明 `apiName`（保持一致性，方便测试断言）

## 4. Outcomes & Business Impact

- **已完成**: 生产构建后跨进程服务调用可正常工作
- **验证**: main/renderer bundle 中 `apiName` 字符串一致，116 测试全通过
- **约定沉淀**: AGENTS.md 新增"所有 API 抽象类必须声明 static apiName"

## 5. Risks & Follow-ups

- **已知风险**: 无
- **后续建议**: 可考虑用 lint 规则或装饰器自动校验 `apiName` 是否已声明

## 6. Trace to Sources

| Conclusion | Source File | Section / Evidence |
|---|---|---|
| minify 后类名不一致 | bundle diff: `Sf` vs `vh` | §1 Background |
| apiName 方案选择 | `docs/specs/...` | §1.6 方案分析 |
| Singleton 类型修复 | `docs/specs/...` | §6 Plan-Execution Diff |
