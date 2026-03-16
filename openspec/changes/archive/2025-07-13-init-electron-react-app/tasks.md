# Tasks: Init Electron + React App

## Checklist

### 1. 项目基础初始化

- [x] 1.1 在仓库根目录创建 `package.json`（name, version, description, author, license, main 入口指向 `dist/main/index.js`）
- [x] 1.2 配置 `pnpm`：确认 `packageManager` 字段，创建 `.npmrc`（`shamefully-hoist=false`）
- [x] 1.3 安装核心运行时依赖：`electron`, `react`, `react-dom`, `electron-updater`, `electron-log`
- [x] 1.4 安装构建工具依赖：`vite`, `@vitejs/plugin-react`, `esbuild`, `tsx`, `concurrently`, `wait-on`, `cross-env`
- [x] 1.5 安装类型定义：`@types/react`, `@types/react-dom`, `@types/node`, `typescript`
- [x] 1.6 安装代码规范工具：`eslint`, `prettier`, `@typescript-eslint/*`, `eslint-config-prettier`
- [x] 1.7 安装打包工具：`electron-builder`
- [x] 1.8 创建 `.gitignore`，排除 `node_modules/`, `dist/`, `release/`, `.env`

---

### 2. TypeScript 配置

- [x] 2.1 创建 `tsconfig.json`（主进程 + preload 用，`target: ES2020`, `module: CommonJS`, `moduleResolution: node`）
- [x] 2.2 创建 `tsconfig.renderer.json`（renderer 专用，继承 base，`module: ESNext`, `moduleResolution: bundler`，加入 DOM lib）

---

### 3. 主进程（main）

- [x] 3.1 创建 `src/main/index.ts`：应用入口，负责 `BrowserWindow` 创建、`app.whenReady` 生命周期、`app.on('window-all-closed')`
- [x] 3.2 在 `createWindow` 中正确引用 `preload` 路径（`path.join(__dirname, '../preload/index.js')`），开启 `contextIsolation: true`, `nodeIntegration: false`
- [x] 3.3 创建 `src/main/updater/types.ts`：`UpdateConfig`, `UpdateProgressInfo` 接口定义
- [x] 3.4 创建 `src/main/updater/index.ts`：`createUpdateManager(config)` 工厂函数，实现 `setupAutoUpdater / checkForUpdates / downloadUpdate / quitAndInstall / startAutoCheck / stopAutoCheck / init`，`export initUpdater / getUpdater`
- [x] 3.5 在 `src/main/index.ts` 中的 `app.whenReady` 内调用 `initUpdater`，配置项从环境变量读取

---

### 4. Preload

- [x] 4.1 创建 `src/preload/index.ts`：使用 `contextBridge.exposeInMainWorld` 暴露基础 IPC API（预留 `appUpdater` 命名空间，暴露 `checkForUpdates`, `quitAndInstall`, `onUpdateAvailable`, `onUpdateDownloaded`）

---

### 5. 渲染进程（renderer）

- [x] 5.1 创建 `src/renderer/index.html`
- [x] 5.2 创建 `src/renderer/main.tsx`：React 应用入口，挂载到 `#root`
- [x] 5.3 创建 `src/renderer/App.tsx`：最小化占位页面，展示应用名与版本号
- [x] 5.4 创建 `src/renderer/styles/index.css`：基础重置样式

---

### 6. 构建脚本

- [x] 6.1 创建 `scripts/build.ts`：使用 `esbuild` API 分别构建 `main` 和 `preload`，支持 `--watch` 参数（开发模式）
  - main: `platform: node`, `format: cjs`, `outfile: dist/main/index.js`
  - preload: `platform: node`, `format: cjs`, `outfile: dist/preload/index.js`
  - 共同: `bundle: true`, `external: ['electron']`, `sourcemap: true`（开发模式）
- [x] 6.2 创建 `vite.config.ts`：renderer 配置，`root: src/renderer`, `outDir: ../../dist/renderer`, `@vitejs/plugin-react`

---

### 6.5 Vite 插件：sourceFilePlugin

- [x] 6.5.1 创建 `src/renderer/vite-plugins/sourceFilePlugin.ts`：实现 `vite:source-file-inject` 插件，向 `.ts/.tsx/.js/.jsx` 文件注入 `const __SOURCE_FILE__ = "相对路径"`（适配自 rika-b 项目，移除 Vue/SFC 相关逻辑）
- [x] 6.5.2 在 `vite.config.ts` 中注册 `sourceFilePlugin()`

---

### 7. package.json 脚本

- [x] 7.1 配置完整 npm scripts：`dev`, `dev:main`, `dev:renderer`, `build`, `build:main`, `build:renderer`, `dist`, `dist:win`, `typecheck`, `lint`
- [x] 7.2 配置 `build.extends` 指向 `electron-builder.config.mjs`

---

### 8. 打包配置

- [x] 8.1 创建 `electron-builder.config.mjs`，结构参考 `hades-pdd-electron`：
  - `appId`, `productName`, `directories.output: 'release'`
  - `files: ['dist/**/*', 'package.json', '!node_modules/**']`
  - `extraMetadata.main: 'dist/main/index.js'`
  - `win.target: nsis (x64)`, `nsis.*`
  - `mac` 预留（首版不签名）
  - `publish.provider: generic`, URL 读取 `process.env.UPDATE_SERVER_URL`

---

### 9. 环境变量

- [x] 9.1 创建 `.env.example`，列出所有更新相关变量：`UPDATE_SERVER_URL`, `AUTO_CHECK_ON_STARTUP`, `AUTO_DOWNLOAD`, `UPDATE_CHECK_INTERVAL`
- [x] 9.2 在 `scripts/build.ts` 中通过 `esbuild define` 注入 `process.env.*`，主进程代码可直接读取

---

### 9.5 测试框架：Vitest

- [x] 9.5.1 安装测试依赖：`vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`
- [x] 9.5.2 创建 `vitest.config.ts`：`environment: jsdom`, `globals: true`, `setupFiles: src/test/setup.ts`，配置 coverage（v8 provider）
- [x] 9.5.3 创建 `src/test/setup.ts`：导入 `@testing-library/jest-dom` 扩展
- [x] 9.5.4 在 `package.json` 中添加测试脚本：`test`、`test:watch`、`test:coverage`
- [x] 9.5.5 在 `tsconfig.renderer.json` 中将 `vitest/globals` 加入 `types`

---

### 10. 代码规范配置

- [x] 10.1 创建 `eslint.config.mjs`（flat config 格式），覆盖 `src/**/*.{ts,tsx}`
- [x] 10.2 创建 `.prettierrc`

---

### 11. README

- [x] 11.1 创建 `README.md`，包含：项目概述、环境要求、开发启动步骤、打包步骤、更新服务配置说明

---

### 12. 验证

- [x] 12.1 `pnpm install` 正常完成
- [x] 12.2 `pnpm run build` 正常产出 `dist/main/index.js`, `dist/preload/index.js`, `dist/renderer/index.html`
- [ ] 12.3 `pnpm run dev` 能启动 Electron 窗口并加载 React 页面
- [ ] 12.4 `pnpm run dist:win` 能生成 `release/*.exe` 安装包
- [x] 12.5 `pnpm run typecheck` 无类型错误
- [x] 12.6 `pnpm run lint` 无 lint 错误
