# electron-template

Electron + React + TypeScript 桌面应用脚手架，提供开箱即用的开发环境。

## 快速开始

```bash
pnpm install
pnpm run dev
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm run dev` | 启动开发环境 |
| `pnpm run build` | 生产构建 |
| `pnpm run test` | 运行测试 |
| `pnpm run lint -- --fix` | 代码检查与修复 |
| `pnpm run package:win` | 打包 Windows 安装程序 |

## 项目能力

### 通信层

- **MessagePort IPC 通道** — 基于 `MessageChannelMain` 的双向类型安全通信，支持超时、错误序列化
- **服务注册表** — 声明式跨进程 RPC，定义抽象 API 类后自动路由（同进程直调，跨进程走通道）

### 窗口管理

- **WindowManager** — 多窗口生命周期管理，支持 macOS 关闭隐藏到托盘
- **ViewManager** — `WebContentsView` 子窗口管理，支持嵌入式/独立/离屏三种模式，内置通道通信和广播

### 基础服务

- **自动更新** — 封装 `electron-updater`，支持启动检查、定时检查、自动下载
- **系统托盘** — 跨平台托盘图标，macOS 支持 template image
- **统一日志** — 三进程通用，renderer 日志自动转发到 main，支持源文件定位

### 工具链

- **Vite 多配置构建** — main / preload / renderer 三个独立构建
- **electron-builder 打包** — Windows NSIS 安装程序，支持跨平台
- **Vitest 单元测试** — 三套测试环境（node / jsdom），完整 Electron mock
- **Playwright E2E 测试** — 启动真实 Electron 进程验证
- **ESLint + Prettier** — 代码规范与格式化

### 前端

- **React 18 + Tailwind CSS v4 + shadcn/ui** — 开箱即用的 UI 开发环境
- **Zustand** — 轻量状态管理
