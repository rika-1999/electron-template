# Spec: Build & Packaging

## Capability

多进程独立构建 + `electron-builder` 统一打包，支持 Windows（NSIS）首版发布，macOS 配置预留。

---

## Requirements

### 构建

| ID | 要求 | 验收标准 |
|----|------|----------|
| BP-01 | renderer 使用 Vite 构建，输出到 `dist/renderer/` | `dist/renderer/index.html` 存在 |
| BP-02 | main 使用 esbuild 构建，输出 `dist/main/index.js`，格式为 CJS | 文件存在且可被 Electron 加载 |
| BP-03 | preload 使用 esbuild 构建，输出 `dist/preload/index.js`，格式为 CJS | 文件存在 |
| BP-04 | `electron` 在构建时必须标记为 external，不打入 bundle | bundle 中不含 electron 模块 |
| BP-05 | 开发模式支持 sourcemap | `.js.map` 文件随构建产出 |
| BP-06 | 生产构建不输出 sourcemap | release 包中不含 `.js.map` |

### 打包

| ID | 要求 | 验收标准 |
|----|------|----------|
| BP-10 | `electron-builder.config.mjs` 为独立文件，`package.json` 通过 `build.extends` 引用 | 配置文件存在，builder 能正常读取 |
| BP-11 | `files` 只打包 `dist/**/*` 和 `package.json`，排除 `node_modules` | 输出包体积正常，无多余文件 |
| BP-12 | `extraMetadata.main` 指向 `dist/main/index.js` | 打包后应用能正常启动 |
| BP-13 | Windows 目标：`nsis`，架构 `x64` | 生成 `.exe` 安装包 |
| BP-14 | NSIS 安装选项：非一键安装、可选机器/用户安装、创建桌面/开始菜单快捷方式、安装完成后自动运行 | 安装流程符合配置 |
| BP-15 | macOS 目标预留：`zip`, `arm64`，无签名/公证 | 配置项存在，首版不强制构建 |
| BP-16 | 安装包输出目录为 `release/`（加入 `.gitignore`） | `release/` 存在且被忽略 |

### 脚本

| ID | 要求 | 验收标准 |
|----|------|----------|
| BP-20 | `pnpm run build` 按序执行 main + preload + renderer 构建 | 三个产物全部生成 |
| BP-21 | `pnpm run dist:win` 执行 build 后调用 electron-builder `--win` | 生成 Windows 安装包 |
| BP-22 | `pnpm run dev` 并发启动 main watch + renderer dev server + Electron | 开发窗口正常打开 |

---

## Constraints

- `package.json` 中 `main` 字段必须指向 `dist/main/index.js`
- `electron-builder` 必须在 `devDependencies`，不能在 `dependencies`
- 构建脚本使用 `tsx` 执行 TypeScript，避免引入额外 ts-node 配置
