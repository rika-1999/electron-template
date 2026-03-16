# Spec: Auto Update

## Capability

基于 `electron-updater` 实现可配置的自动更新模块，采用 `generic` provider，更新地址通过环境变量注入，支持启动检查、定时检查、手动触发、进度反馈。

---

## Requirements

### 配置

| ID | 要求 | 验收标准 |
|----|------|----------|
| AU-01 | 更新服务 URL 通过 `UPDATE_SERVER_URL` 环境变量注入，不硬编码 | 修改环境变量后重新打包即可切换更新源 |
| AU-02 | `AUTO_CHECK_ON_STARTUP` 控制启动后是否自动检查（默认 `true`） | 关闭后启动不触发检查 |
| AU-03 | `AUTO_DOWNLOAD` 控制发现新版本后是否自动下载（默认 `false`） | 关闭后发现更新仅通知，不自动下载 |
| AU-04 | `UPDATE_CHECK_INTERVAL` 控制定时检查间隔，单位毫秒（默认 `3600000`，即 1 小时；`0` 禁用） | 设为 `0` 时不启动定时器 |

### 核心功能

| ID | 要求 | 验收标准 |
|----|------|----------|
| AU-10 | `initUpdater(config)` 为单例工厂，重复调用不重复初始化 | 第二次调用直接返回已有实例 |
| AU-11 | `setupAutoUpdater()` 设置 `feedURL`、`logger = electron-log`、`autoDownload`、`autoInstallOnAppQuit` | 配置生效，日志正常输出 |
| AU-12 | 启动时延迟 5 秒后检查更新，避免影响启动性能 | 检查日志出现时间晚于应用就绪 |
| AU-13 | `checkForUpdates()` 捕获异常，失败时只写日志不崩溃 | 更新服务不可达时应用正常运行 |
| AU-14 | `downloadUpdate()` 独立封装，支持手动触发 | 调用后开始下载，进度通过日志可见 |
| AU-15 | `quitAndInstall()` 封装退出安装逻辑 | 调用后应用退出并执行安装程序 |
| AU-16 | `startAutoCheck(interval)` / `stopAutoCheck()` 支持运行时控制定时器 | 可在应用生命周期中动态启停 |

### 事件处理

| ID | 要求 | 验收标准 |
|----|------|----------|
| AU-20 | 监听 `checking-for-update`：写 info 日志 | 日志可见 |
| AU-21 | 监听 `update-available`：写 info 日志，`AUTO_DOWNLOAD = true` 时自动调用 `downloadUpdate()` | 行为符合配置 |
| AU-22 | 监听 `update-not-available`：写 info 日志 | 日志可见 |
| AU-23 | 监听 `download-progress`：写百分比 + 已传输/总大小（MB）进度日志 | 日志格式：`XX.XX% (X.XXMb/X.XXMb)` |
| AU-24 | 监听 `update-downloaded`：写 info 日志，`AUTO_DOWNLOAD = true` 时自动调用 `quitAndInstall()` | 行为符合配置 |
| AU-25 | 监听 `error`：写 error 日志，不抛出 | 更新错误不影响主进程稳定性 |

### Preload IPC 暴露

| ID | 要求 | 验收标准 |
|----|------|----------|
| AU-30 | preload 通过 `contextBridge` 暴露 `window.appUpdater` 命名空间 | renderer 可访问 |
| AU-31 | 暴露 `checkForUpdates()` → 触发 `ipcMain` 检查更新 | 调用有效 |
| AU-32 | 暴露 `quitAndInstall()` → 触发 `ipcMain` 安装 | 调用有效 |
| AU-33 | 暴露 `onUpdateAvailable(callback)` → 注册更新可用回调 | renderer 可收到通知 |
| AU-34 | 暴露 `onUpdateDownloaded(callback)` → 注册下载完成回调 | renderer 可收到通知 |

---

## Constraints

- `electron-updater` 在 `dependencies`（运行时依赖），不能在 `devDependencies`
- `electron-log` 在 `dependencies`
- 更新模块只在 `app.whenReady` 之后初始化
- 开发环境下 `autoUpdater.forceDevUpdateConfig` 仅在显式设置 `NODE_ENV=development` 且有 `dev-app-update.yml` 时才开启，不默认开启
- `UPDATE_SERVER_URL` 为空时，`checkForUpdates()` 提前返回并写 warn 日志，不报错
