## Why

当前应用仅有一个 `BrowserWindow` + 单个 `MessagePort` 通道，无法支持多视图场景（如嵌入式面板、可拆分独立窗口、后台任务等）。随着功能扩展，需要一套基于 `WebContentsView` 的子窗口管理体系，支持灵活的视图创建/销毁、统一 preload、独立通信通道和生命周期状态查询。

## What Changes

- 新增 `ViewManager` 模块（主进程），管理所有子窗口的创建、销毁、挂载/拆分和生命周期事件，内置 channel 通信能力
- 重构 `channel.ts`：将现有单例 port 提取为可实例化的 `ChannelInstance` 类，支持为每个 view 创建独立的 channel
- 新增子窗口统一 preload（`src/preload/view.ts`），与主窗口 preload 分离
- 新增子窗口 preload 的 Vite 构建配置（`vite.config.preload-view.ts`）
- 支持三种视图类型：嵌入式面板（embedded）、独立窗口（detached）、不渲染模式（background）
- 支持查询视图状态和监听生命周期事件（created/destroyed/state-changed 涵盖 show/hide/resize/focus/blur/close/bounds-changed）
- 更新构建脚本以包含子窗口 preload 的构建步骤

## Capabilities

### New Capabilities
- `view-manager`: 基于 WebContentsView 的子窗口管理，包括创建/销毁/挂载/拆分、三种视图模式、内置 channel 通信、生命周期事件与状态查询
- `view-preload`: 子窗口统一 preload 脚本及其构建配置，与主窗口 preload 分离

### Modified Capabilities
- `channel-refactor`: 将 channel 从全局单例重构为可实例化的 ChannelInstance，保持现有主窗口 API 兼容

## Impact

- **主进程**：`src/main/` 新增 `view-manager/` 模块，`index.ts` 需初始化 ViewManager
- **Channel 模块**：`src/utils/channel.ts` 重构为类实例化模式，现有 `channel.init()` / `channel.on()` / `channel.request()` API 保持兼容
- **Preload**：新增 `src/preload/view.ts`，现有 `src/preload/index.ts` 不变
- **构建系统**：新增 `vite.config.preload-view.ts`，`package.json` scripts 需包含子窗口 preload 构建
- **路径工具**：`src/main/utils/paths.ts` 新增子窗口 preload 路径获取
- **共享类型**：`src/shared/channel.ts` 可能扩展（如视图相关类型）
