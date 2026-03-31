# electron-template

Electron + React + TypeScript desktop application scaffold.

## Tech Stack

- **Runtime**: Electron ^34
- **Package Manager**: pnpm
- **Renderer**: React 18 + TypeScript + Vite
- **Main/Preload Build**: Vite
- **Packaging**: electron-builder
- **Auto-update**: electron-updater (generic provider)
- **Logging**: electron-log
- **Testing**: Vitest + Testing Library

## Requirements

- Node.js >= 18
- pnpm >= 9

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (renderer + main + electron)
pnpm run dev
```

> **Note**: The dev script uses `scripts/electron-dev.mjs` to launch Electron, which removes `ELECTRON_RUN_AS_NODE` env var injected by some IDE terminals (e.g. Windsurf). For main process changes, restart manually.

## Build

```bash
# Build renderer + main + preload (including sub-window preload)
pnpm run build

# Lint
pnpm run lint
```

## Packaging

```bash
# Windows installer (NSIS x64)
pnpm run package:win

# All platforms (current OS)
pnpm run package
```

Output goes to `release/`.

## Testing

```bash
# Run tests once
pnpm run test

# Watch mode
pnpm run test:watch
```

## Auto-update Configuration

Copy `.env.example` to `.env` and configure:

```env
UPDATE_SERVER_URL=https://your-update-server.com/releases
AUTO_CHECK_ON_STARTUP=true
AUTO_DOWNLOAD=false
UPDATE_CHECK_INTERVAL=3600000
```

The update server must serve `latest.yml` (Windows) or `latest-mac.yml` (macOS) at the configured URL, compatible with `electron-updater` generic provider format. If `UPDATE_SERVER_URL` is empty, the updater is gracefully skipped.

## IPC Communication

All inter-process communication goes through a unified `channel` module (`src/shared/channel.ts`) built on Electron's `MessageChannelMain`. It supports bidirectional request-response between main and renderer.

### Default channel (backward-compatible singleton)

```ts
import { channel } from '@/shared/channel'

// Main: handle requests from renderer
channel.on('my:method', async (payload) => {
  return { result: 'ok' }
})

// Renderer: send request and await response
const result = await channel.request('my:method', payload)
```

### ChannelInstance (per-view independent channels)

```ts
import { Channel } from '@/shared/channel'

const ch = new ChannelInstance()
await ch.init({ webContentsId: view.webContents.id })
ch.on('ping', async () => 'pong')
ch.destroy()
```

The `init()` method accepts an optional `expose` option (`true` by default). Set `expose: false` to skip `contextBridge.exposeInMainWorld`.

## ViewManager

`ViewManager` manages sub-windows as `WebContentsView` instances, supporting three modes:

- **embedded** — attached to a parent `BrowserWindow` as a child view
- **detached** — hosted in its own `BaseWindow`
- **background** — offscreen rendering (`offscreen: true`), no window attachment

```ts
import { viewManager } from '@/main/viewManager'

// Create a sub-window
const viewId = await viewManager.createView({
  url: 'https://example.com',
  type: 'embedded',
  parentWindow: win,
  bounds: { x: 0, y: 0, width: 400, height: 300 },
})

// Lifecycle events
viewManager.on('view-created', (id, state) => { ... })
viewManager.on('view-ready', (id) => { ... })
viewManager.on('view-destroyed', (id) => { ... })

// Built-in channel communication
await viewManager.requestTo(viewId, 'method', payload)
await viewManager.broadcast('method', payload)
viewManager.onAnyMessage('method', (viewId, payload) => { ... })

// Cleanup
viewManager.destroyView(viewId)
```

Each sub-window uses a dedicated preload script (`src/preload/view.ts`) with its own `ChannelInstance`.

## Path Alias

`@` maps to `src/`. Available in all processes (main, preload, renderer):

```ts
import { log } from '@/utils/log'
import { channel } from '@/shared/channel'
```

## Project Structure

```
src/
├── main/
│   ├── index.ts              # App lifecycle entry, exports viewManager singleton
│   ├── window.ts             # BrowserWindow creation
│   ├── ipc.ts                # IPC / channel handler registration
│   ├── updater/
│   │   ├── index.ts          # Auto-update service
│   │   └── types.ts          # Update types
│   ├── viewManager/
│   │   ├── index.ts          # ViewManager class + singleton export
│   │   ├── index.test.ts     # ViewManager unit tests
│   │   ├── managedView.ts   # ManagedView: WebContentsView + ChannelInstance wrapper
│   │   └── types.ts          # Internal types (ManagedView interface, handler types)
│   └── utils/
│       └── paths.ts          # Runtime path helpers (preload, view-preload)
├── preload/
│   ├── index.ts              # Main window preload (exposes window.channel)
│   └── view.ts               # Sub-window preload (separate ChannelInstance)
├── renderer/
│   ├── index.html
│   ├── main.tsx              # React entry
│   ├── App.tsx
│   └── styles/
├── shared/
│   └── view.ts               # Shared view types (ViewState, ViewOptions, ViewEventMap)
├── utils/
│   ├── channel/
│   │   ├── index.ts          # ChannelInstance class + default channel singleton
│   │   ├── index.test.ts     # Channel unit tests
│   │   └── types.ts          # Channel message protocol types (ChannelAPI, etc.)
│   ├── typedEmitter.ts      # Lightweight type-safe event emitter
│   ├── env.ts                # Process environment helpers
│   └── log.ts                # Unified logger (electron-log wrapper)
├── vitePlugins/
│   └── sourceFilePlugin.ts   # Vite plugin: injects __SOURCE_FILE__
└── test/
    └── setup.ts
scripts/
└── electron-dev.mjs          # Dev launcher (removes ELECTRON_RUN_AS_NODE)
```
