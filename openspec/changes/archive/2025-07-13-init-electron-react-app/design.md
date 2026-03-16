# Design: Init Electron + React App

## Architecture Overview

### 构建分层

```
┌─────────────────────────────────────────────────┐
│  electron-builder（打包/发布）                     │
│  ┌───────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  main     │  │  preload    │  │  renderer  │ │
│  │  esbuild  │  │  esbuild    │  │  Vite      │ │
│  │  → dist/  │  │  → dist/    │  │  → dist/   │ │
│  └───────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────┘
```

- **renderer**：Vite 构建 React 应用，输出 `dist/renderer/`
- **main**：esbuild 构建主进程，输出 `dist/main/index.js`
- **preload**：esbuild 构建预加载脚本，输出 `dist/preload/index.js`
- **electron-builder**：消费以上三个产物，生成安装包

### 进程通信

```
Renderer (React)
     ↕ IPC（contextBridge 暴露的安全 API）
Preload (contextBridge)
     ↕ ipcMain / ipcRenderer
Main (Node.js + Electron)
```

---

## 目录结构

```
electron-test/
├── src/
│   ├── main/
│   │   ├── index.ts            # 主进程入口：窗口创建、应用生命周期
│   │   └── updater/
│   │       ├── index.ts        # 自动更新服务（参考 hades-pdd-electron）
│   │       └── types.ts        # 更新相关类型定义
│   ├── preload/
│   │   └── index.ts            # contextBridge：暴露给 renderer 的安全 API
│   └── renderer/
│       ├── index.html
│       ├── main.tsx            # React 入口
│       ├── App.tsx
│       └── styles/
│           └── index.css
├── build/
│   └── icon.png                # 应用图标（builder 打包资源）
├── scripts/
│   └── build.ts                # 构建脚本：用 esbuild 构建 main/preload
├── dist/                       # 构建产物（gitignore）
│   ├── main/
│   ├── preload/
│   └── renderer/
├── release/                    # electron-builder 输出（gitignore）
├── electron-builder.config.mjs # 打包配置（参考 hades-pdd-electron）
├── vite.config.ts              # Vite renderer 配置
├── tsconfig.json               # 基础 TS 配置（Node/main）
├── tsconfig.renderer.json      # renderer 专用 TS 配置
├── .env.example                # 环境变量示例
├── package.json
└── pnpm-lock.yaml
```

---

## 技术选型

| 层级              | 技术              | 版本建议 | 说明                         |
| ----------------- | ----------------- | -------- | ---------------------------- |
| 运行时            | Electron          | ^34.x    | 最新稳定版                   |
| 包管理            | pnpm              | ^9.x     | 性能优、节省磁盘             |
| 语言              | TypeScript        | ^5.x     | 主/preload/renderer 全覆盖   |
| renderer 框架     | React             | ^18.x    |                              |
| renderer 构建     | Vite              | ^6.x     | 开发体验最优                 |
| main/preload 构建 | esbuild           | ^0.24.x  | 快速、零配置                 |
| 打包              | electron-builder  | ^25.x    | 与参考项目一致               |
| 自动更新          | electron-updater  | ^6.x     | 与参考项目一致               |
| 日志              | electron-log      | ^5.x     | 与参考项目一致               |
| 代码规范          | ESLint + Prettier | latest   | airbnb-typescript            |
| 测试框架          | Vitest            | ^3.x     | 与 Vite 共享配置，兼容 jsdom |

---

## 测试框架设计

使用 **Vitest** 作为测试框架，与 Vite 共享转换管道，无需额外的 Babel/ts-node 配置。

### 测试范围

| 层                           | 测试类型  | 环境             |
| ---------------------------- | --------- | ---------------- |
| renderer（React 组件/Hooks） | 单元测试  | `jsdom`          |
| main/preload（纯逻辑函数）   | 单元测试  | `node`           |
| Electron IPC / 原生 API      | Mock 测试 | `node` + vi.mock |

### 配置文件

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    exclude: ["node_modules", "dist", "release"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
});
```

### 目录结构

```
src/
└── test/
    └── setup.ts          # 全局 setup（@testing-library/jest-dom 扩展）
```

测试文件与被测文件同级，采用 `*.test.ts(x)` 命名。

### 测试脚本

```json
"test":         "vitest run",
"test:watch":   "vitest",
"test:coverage": "vitest run --coverage"
```

---

## 打包配置设计

遵循参考项目 `electron-builder.config.mjs` 的核心结构：

```js
// electron-builder.config.mjs
export default {
  appId: "com.example.electron-test",
  productName: "electron-test",
  directories: {
    output: "release",
    buildResources: "build",
  },
  files: ["dist/**/*", "package.json", "!node_modules/**"],
  extraMetadata: {
    main: "dist/main/index.js",
  },
  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
    artifactName: "${productName}-${version}-${arch}.${ext}",
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    runAfterFinish: true,
  },
  mac: {
    // 预留，首版不做签名/公证
    target: [{ target: "zip", arch: ["arm64"] }],
    category: "public.app-category.productivity",
  },
  publish: {
    provider: "generic",
    url: "http://localhost:8888", // 通过环境变量覆盖
    updaterCacheDirName: "electron-test-updater",
  },
};
```

---

## 自动更新模块设计

与参考项目 `src/main/update/index.ts` 保持相同的抽象层次：

```
src/main/updater/index.ts
  createUpdateManager(config) → UpdateManager
    - setupAutoUpdater()        设置 feedURL / logger / autoDownload
    - checkForUpdates()         手动触发检查
    - downloadUpdate()          手动触发下载
    - quitAndInstall()          安装并重启
    - startAutoCheck(interval)  启动定时检查
    - stopAutoCheck()           停止定时检查
    - init()                    启动时延迟检查 + 定时检查

export initUpdater(config)      单例入口
export getUpdater()             获取当前实例
```

配置项通过 `.env` + 构建时注入（`define` in esbuild / `import.meta.env` in Vite）：

```
UPDATE_SERVER_URL=
AUTO_CHECK_ON_STARTUP=true
AUTO_DOWNLOAD=false
UPDATE_CHECK_INTERVAL=3600000
```

---

## 开发脚本设计

```json
{
  "dev": "concurrently \"pnpm run dev:main\" \"pnpm run dev:renderer\" \"wait-on dist/main/index.js && electron .\"",
  "dev:main": "tsx watch scripts/build.ts --watch",
  "dev:renderer": "vite",
  "build": "pnpm run build:main && pnpm run build:renderer",
  "build:main": "tsx scripts/build.ts",
  "build:renderer": "vite build",
  "dist": "pnpm run build && electron-builder",
  "dist:win": "pnpm run build && electron-builder --win",
  "typecheck": "tsc --noEmit && tsc -p tsconfig.renderer.json --noEmit",
  "lint": "eslint --ext .ts,.tsx src"
}
```

---

## Vite 插件：sourceFilePlugin

### 功能

在 Vite `transform` 阶段，向每个 `.ts/.tsx/.js/.jsx` 文件头部注入：

```ts
const __SOURCE_FILE__ = "src/renderer/App.tsx";
```

使运行时（日志、错误上报、调试）可以直接获取当前模块的源文件相对路径。

### 实现位置

```
src/renderer/vite-plugins/sourceFilePlugin.ts
```

### 参考来源

适配自 `rika-b` 项目的 `sourceFilePlugin.ts`，移除了 Vue SFC 相关依赖（`@vue/compiler-sfc`）和 `.vue` 处理分支，保留核心注入逻辑。

### 关键逻辑

```ts
export function sourceFilePlugin(): PluginOption {
  return {
    name: "vite:source-file-inject",
    enforce: "pre",
    transform(code, id) {
      // 跳过 node_modules 和非目标扩展名
      if (id.includes("node_modules")) return null;
      if (!/\.(ts|tsx|js|jsx)$/.test(id)) return null;
      // 避免重复注入
      if (code.includes("const __SOURCE_FILE__=")) return null;

      const relativePath = id.startsWith(cwd) ? id.slice(cwd.length + 1) : id;
      return {
        code:
          `  const __SOURCE_FILE__=${JSON.stringify(relativePath)};\n` + code,
        map: null,
      };
    },
  };
}
```

### 在 vite.config.ts 中注册

```ts
import { sourceFilePlugin } from "./src/renderer/vite-plugins/sourceFilePlugin";

export default defineConfig({
  plugins: [react(), sourceFilePlugin()],
  // ...
});
```

---

## 关键约束

1. `main` 和 `preload` 必须使用 CommonJS 输出（`electron` 的要求）
2. `preload` 必须设置 `contextIsolation: true`
3. `electron-updater` 仅在 `app.isPackaged` 为 `true` 时完整生效，开发时可通过 `autoUpdater.forceDevUpdateConfig = true` 辅助测试
4. `publish.url` 在打包时通过 `env.UPDATE_SERVER_URL` 注入，避免硬编码
5. 打包产物 (`dist/`, `release/`) 均加入 `.gitignore`
