## 1. Channel 重构

- [x] 1.1 在 `src/utils/channel.ts` 中提取 `ChannelInstance` 类，将 port/handlers/pending 从模块级变量改为实例成员，新增 `destroy()` 方法
- [x] 1.2 在 `src/utils/channel.ts` 中创建默认实例，保持现有 `export const channel = { init, request, on, off }` API 不变（代理到默认实例）
- [x] 1.3 从 `src/utils/channel.ts` 导出 `ChannelInstance` 类，供 ViewManager 使用
- [x] 1.4 验证现有主窗口 channel 流程不受影响（`channel.init` / `channel.on` / `channel.request` 行为不变）

---

## 2. 子窗口 Preload

- [x] 2.1 在 `src/main/utils/paths.ts` 中新增 `getViewPreloadPath()` 方法，返回 `dist/preload-view/index.js` 的绝对路径
- [x] 2.2 创建 `src/preload/view.ts`：子窗口统一 preload，调用 `ChannelInstance` 的 renderer 侧 setup，通过 `contextBridge` 暴露 `window.channel`（`request`/`on`/`off`）
- [x] 2.3 创建 `vite.config.preload-view.ts`：构建配置，入口 `src/preload/view.ts`，输出 `dist/preload-view/index.js`，CJS 格式，`PROCESS_TYPE` 定义为 `'preload'`
- [x] 2.4 更新 `package.json` 的 `dev` 和 `build` 脚本，加入子窗口 preload 的构建步骤
- [x] 2.5 验证 `pnpm run build` 能产出 `dist/preload-view/index.js`

---

## 3. 共享类型

- [x] 3.1 创建 `src/shared/view.ts`：定义 `ViewState`、`ViewOptions`、`ViewType`、`ViewEventMap` 等类型

---

## 4. ViewManager 核心实现

- [x] 4.1 创建 `src/main/view-manager/types.ts`：定义 `ManagedView` 内部接口、`ViewManagerEvents`
- [x] 4.2 创建 `src/main/view-manager/managed-view.ts`：`ManagedView` 类封装 WebContentsView + ChannelInstance + ViewState，负责 webContents 事件监听和状态维护
- [x] 4.3 创建 `src/main/view-manager/index.ts`：`ViewManager` 类（继承 EventEmitter），实现 `createView()`、`destroyView()`、`getView()`、`listViews()`
- [x] 4.4 实现 `createView()` 三种模式：`embedded`（添加到 BrowserWindow.contentView）、`detached`（创建 BaseWindow）、`background`（不挂载）
- [x] 4.5 实现 `destroyView()`：清理 channel、移除 webContentsView、销毁 webContents、移除内部注册
- [x] 4.6 实现 `attachToWindow(viewId, browserWindow, bounds)` 和 `detachToWindow(viewId, windowOptions)`
- [x] 4.7 实现生命周期事件：`view-created`、`view-destroyed`、`view-state-changed`、`view-ready`

---

## 5. ViewManager 内置 Channel

- [x] 5.1 在 ViewManager 中实现 `requestTo(viewId, method, payload)` 便捷方法
- [x] 5.2 实现 `broadcast(method, payload)` 向所有活跃 view 发送请求
- [x] 5.3 实现 `onMessage(viewId, method, handler)` 监听特定 view 的消息
- [x] 5.4 实现 `onAnyMessage(method, handler)` 监听所有 view 的消息（含未来创建的 view）

---

## 6. 集成

- [x] 6.1 在 `src/main/index.ts` 中初始化 ViewManager（在 `app.whenReady` 内创建实例）
- [x] 6.2 确保主窗口的现有 channel 和 updater IPC 流程不受影响

---

## 7. 验证

- [x] 7.1 `pnpm run build` 正常完成（含子窗口 preload 构建）
- [x] 7.2 TypeScript 类型检查通过（`tsc --noEmit`）
- [x] 7.3 现有测试通过（`pnpm run test`）
