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

> **Note**: The dev script uses `scripts/dev.mjs` to build main/preload first, then starts the renderer dev server and Electron. For main process changes, restart manually.

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

All inter-process communication goes through a unified `channel` module (`src/shared/channel/index.ts`) built on Electron's `MessageChannelMain`. It supports bidirectional request-response between main and renderer.

### Default channel (backward-compatible singleton)

```ts
import { channel } from '@/shared/channel'

// Main: handle requests from renderer
channel.onRequest('my:method', async (payload) => {
  return { result: 'ok' }
})

// Renderer: send request and await response
const result = await channel.request('my:method', payload)
```

### Channel (per-view independent channels)

```ts
import { Channel } from '@/shared/channel'

const ch = new Channel()
await ch.init({ webContentsId: view.webContents.id })
ch.onRequest('ping', async () => 'pong')
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
viewManager.onAnyRequest('method', (viewId, payload) => { ... })

// Cleanup
viewManager.destroyView(viewId)
```

Each sub-window uses a dedicated preload script (`src/preload/view.ts`) with its own `Channel`.

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
│   ├── index.ts              # App lifecycle entry
│   ├── mainWindow.ts         # Main BrowserWindow creation
│   ├── services/             # Main-process service implementations
│   ├── tray/                 # System tray integration
│   ├── updater/
│   │   ├── index.ts          # Auto-update service
│   │   └── types.ts          # Update types
│   ├── viewManager/
│   │   ├── index.ts          # ViewManager class + singleton export
│   │   ├── managedView.ts    # ManagedView: WebContentsView + Channel wrapper
│   │   └── types.ts          # Internal types (ManagedView interface, handler types)
│   ├── windowManager/        # BrowserWindow management
│   └── utils/
│       └── paths.ts          # Runtime path helpers (preload, view-preload)
├── preload/
│   ├── index.ts              # Main window preload (exposes window.channel)
│   └── view.ts               # Sub-window preload (separate Channel)
├── renderer/
│   ├── index.html
│   ├── main.tsx              # React entry
│   ├── App.tsx
│   └── styles/
├── shared/
│   ├── channel/              # IPC channel implementation
│   ├── serviceRegistry/      # Service registration and routing
│   ├── services/             # Shared service API definitions
│   ├── window.ts
│   └── view.ts
├── utils/
│   ├── log/                  # Unified logger (electron-log wrapper)
│   ├── serialize/            # Error/value serialization helpers
│   ├── typedEmitter.ts       # Lightweight type-safe event emitter
│   ├── env.ts                # Process environment helpers
│   └── promise.ts
├── __tests__/                # Unit/integration test suites
│   └── infrastructure/       # Shared test setup, mocks and helpers
├── vitePlugins/
│   └── sourceFilePlugin.ts   # Vite plugin: injects __SOURCE_FILE__
tests/
└── e2e/                      # Playwright end-to-end tests
scripts/
├── build.mjs                 # Production build orchestrator
└── dev.mjs                   # Dev launcher
```
