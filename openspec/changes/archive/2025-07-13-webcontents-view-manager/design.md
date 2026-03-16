## Context

当前应用使用单个 `BrowserWindow` + 全局单例 `channel`（基于 `MessagePort`）实现主进程与渲染进程的通信。`channel.ts` 内部维护一个全局 `port` 变量，只能与一个 `webContents` 建立连接。

随着多视图需求的出现，需要：
1. 一个管理器统一管理多个 `WebContentsView` 的生命周期
2. 每个视图拥有独立的通信通道
3. 子窗口使用与主窗口不同的统一 preload

Electron 版本 `^34.0.0`，`WebContentsView` API 已稳定可用。

---

## Goals / Non-Goals

**Goals:**
- 提供 `ViewManager` 类，支持创建/销毁/查询 `WebContentsView`，内置 channel 通信
- 支持三种视图模式：`embedded`（嵌入主窗口）、`detached`（独立 BaseWindow）、`background`（不渲染）
- 将 `channel.ts` 重构为可实例化的 `ChannelInstance` 类，支持多实例
- 主窗口现有 `channel` API 保持向后兼容
- 新增子窗口统一 preload 及其构建配置
- 支持视图状态查询和生命周期事件监听

**Non-Goals:**
- 不实现子窗口间的直接通信（仅 view ↔ main）
- 不实现视图持久化/恢复（关闭即销毁）
- 不引入状态管理库
- 不在此变更中实现子窗口的具体业务页面

---

## Decisions

### 1. Channel 重构策略：提取 ChannelInstance 类

**选择**：将 `channel.ts` 中的 port/handlers/pending 状态封装为 `ChannelInstance` 类，现有 `channel` 导出改为默认实例的代理。

**替代方案**：
- Hub 模式（单例 channel 内部维护 `Map<id, Port>`）：API 需要传 viewId 参数，破坏现有 API
- 完全重写 channel：风险大，不必要

**理由**：提取类后，主窗口代码零改动（`channel.init/on/request` 仍然可用），ViewManager 为每个 view `new ChannelInstance()` 即可。

```
// 重构后的结构
class ChannelInstance {
  private port: Port | null
  private handlers: Map<string, Handler>
  private pending: Map<string, ResponseHandler>

  setupMain(webContentsId: number): Promise<void>
  setupRenderer(): Promise<void>
  request(method, payload): Promise<unknown>
  on(method, handler): void
  off(method): void
  destroy(): void    // 新增：清理资源
}

// 向后兼容：默认实例
const defaultChannel = new ChannelInstance()
export const channel = {
  init: (opts) => defaultChannel.init(opts),
  request: (...) => defaultChannel.request(...),
  on: (...) => defaultChannel.on(...),
  off: (...) => defaultChannel.off(...),
}
```

### 2. ViewManager 内置 Channel

**选择**：ViewManager 在 `createView()` 时自动为 view 创建 `ChannelInstance` 并初始化，在 `destroyView()` 时自动清理。

**理由**：
- channel 生命周期与 view 完全绑定，内置管理避免泄漏
- 外部通过 `viewManager.getView(id).channel` 或便捷方法 `viewManager.requestTo(id, method, payload)` 通信
- 广播通过 `viewManager.broadcast(method, payload)` 遍历所有活跃 view

### 3. 三种视图模式的实现

| 模式 | 实现 | 是否渲染 |
|------|------|---------|
| `embedded` | `WebContentsView` 添加到 `BrowserWindow.contentView` | 是 |
| `detached` | 创建新 `BaseWindow`，将 `WebContentsView` 设为其 `contentView` | 是 |
| `background` | `WebContentsView` 不挂载到任何窗口 | 否 |

嵌入/拆分操作：
- `attachToWindow(viewId, browserWindow, bounds)` — 从当前位置移到目标窗口
- `detachToWindow(viewId, windowOptions?)` — 从嵌入移到独立 BaseWindow

### 4. 子窗口 Preload 分离

**选择**：新建 `src/preload/view.ts` 作为子窗口专用 preload，使用独立 Vite 配置构建。

**理由**：
- 主窗口 preload 可能暴露 updater 等特权 API，子窗口不应继承
- 子窗口 preload 仍然使用 `ChannelInstance` 做通信，但暴露的 `contextBridge` API 可以不同
- 独立构建产物 `dist/preload-view/index.js`

```
src/preload/
├── index.ts        # 主窗口 preload（不变）
└── view.ts         # 子窗口 preload（新增）

vite.config.preload-view.ts  # 新增构建配置
```

### 5. 视图状态与生命周期事件

**ViewState 数据结构**：

```typescript
interface ViewState {
  id: string
  type: 'embedded' | 'detached' | 'background'
  url: string
  bounds: Electron.Rectangle | null  // background 模式为 null
  visible: boolean
  focused: boolean
  loaded: boolean
}
```

**生命周期事件**（通过 EventEmitter）：

| 事件 | 触发时机 |
|------|---------|
| `view-created` | 视图创建完成 |
| `view-destroyed` | 视图销毁 |
| `view-state-changed` | 任何状态变化（涵盖 show/hide/resize/focus/blur/bounds-changed） |
| `view-ready` | 视图 webContents 加载完成 |

### 6. ViewManager API 总览

```typescript
class ViewManager extends EventEmitter {
  // 视图生命周期
  createView(options: ViewOptions): string          // 返回 viewId
  destroyView(viewId: string): void
  getView(viewId: string): ManagedView | undefined
  listViews(): ViewState[]

  // 窗口操作
  attachToWindow(viewId: string, window: BrowserWindow, bounds?: Rectangle): void
  detachToWindow(viewId: string, options?: BaseWindowConstructorOptions): BaseWindow

  // 内置 channel（便捷方法）
  requestTo(viewId: string, method: string, payload?: unknown): Promise<unknown>
  broadcast(method: string, payload?: unknown): Promise<void>
  on(viewId: string, method: string, handler: Handler): void
  onAny(method: string, handler: (viewId: string, payload: unknown) => unknown): void
}

interface ViewOptions {
  url: string
  type?: 'embedded' | 'detached' | 'background'  // 默认 'embedded'
  parentWindow?: BrowserWindow                     // embedded 模式必需
  bounds?: Rectangle                                // embedded/detached 的初始位置
  windowOptions?: BaseWindowConstructorOptions      // detached 模式的窗口配置
}
```

---

## Architecture Diagram

```
┌──────────────────────────── Main Process ─────────────────────────────────┐
│                                                                           │
│  ┌──────────────┐     ┌───────────────────────────────────────────────┐  │
│  │ BrowserWindow │     │              ViewManager                     │  │
│  │  (主窗口)     │     │                                              │  │
│  │               │     │  views: Map<id, ManagedView>                 │  │
│  │  channel      │     │                                              │  │
│  │  (default     │     │  ┌─ ManagedView ──────────────────────────┐  │  │
│  │   instance)   │     │  │  id: string                            │  │  │
│  └───────┬───────┘     │  │  webContentsView: WebContentsView      │  │  │
│          │             │  │  channel: ChannelInstance               │  │  │
│     MessagePort        │  │  state: ViewState                      │  │  │
│          │             │  │  hostWindow: BrowserWindow|BaseWindow?  │  │  │
│          ▼             │  └────────────────────────────────────────┘  │  │
│  ┌───────────────┐     │                                              │  │
│  │ Main Preload  │     │  ┌─ ManagedView ─────────┐  ┌─ Managed... │  │  │
│  │ (index.ts)    │     │  │  ...                   │  │  ...        │  │  │
│  └───────────────┘     │  └────────────┬───────────┘  └──────┬──────┘  │  │
│                        │          MessagePort            MessagePort   │  │
│                        └──────────────┼──────────────────────┼────────┘  │
│                                       │                      │           │
└───────────────────────────────────────┼──────────────────────┼───────────┘
                                        ▼                      ▼
                                 ┌────────────┐         ┌────────────┐
                                 │  View A    │         │  View B    │
                                 │  preload/  │         │  preload/  │
                                 │  view.ts   │         │  view.ts   │
                                 │ (embedded) │         │ (detached) │
                                 └────────────┘         └────────────┘
```

---

## File Structure

```
src/
├── main/
│   ├── view-manager/
│   │   ├── index.ts           # ViewManager 类导出
│   │   ├── managed-view.ts    # ManagedView 封装（WCV + Channel + State）
│   │   └── types.ts           # ViewOptions, ViewState, 事件类型
│   ├── window.ts              # 主窗口（微调：不再与 ViewManager 耦合）
│   ├── ipc.ts                 # 现有 IPC（不变）
│   └── utils/
│       └── paths.ts           # 新增 getViewPreloadPath()
├── preload/
│   ├── index.ts               # 主窗口 preload（不变）
│   └── view.ts                # 子窗口统一 preload（新增）
├── shared/
│   ├── channel.ts             # 类型定义（可能扩展 ViewState 相关类型）
│   └── view.ts                # 视图相关共享类型（新增）
└── utils/
    └── channel.ts             # 重构：ChannelInstance 类 + 默认实例兼容层
```

---

## Risks / Trade-offs

- **[复杂度增加]** → 通过清晰的模块边界和类型约束降低；ViewManager 作为唯一入口管理所有子窗口
- **[MessagePort 在 background 模式下的行为]** → WebContentsView 即使不渲染，webContents 仍然活跃，MessagePort 正常工作。需验证。
- **[EventEmitter 的 `on` 方法与 channel 的 `on` 方法命名冲突]** → ViewManager 继承 EventEmitter 的 `on` 用于生命周期事件；channel 相关方法使用 `onMessage` / `onAnyMessage` 命名区分
- **[主窗口 channel 向后兼容]** → 通过默认实例代理确保零改动。集成测试需覆盖现有 IPC 流程。

---

## Open Questions

1. 子窗口 preload 需要暴露哪些具体 API？（当前先只暴露 channel 基础通信，后续按需扩展）
2. background 模式的 view 是否需要限制可加载的 URL？（安全考量，后续讨论）
