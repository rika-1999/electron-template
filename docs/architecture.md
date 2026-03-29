# Architecture

See [AGENTS.md](../AGENTS.md) for a quick reference guide.

## Process Model

Electron runs in 3 process types:

- **main** — manages windows, views, tray, updater; entry at `src/main/index.ts`
- **preload** — bridges main and renderer via `contextBridge`; scripts at `src/preload/`
- **renderer** — React SPA at `src/renderer/`

## Key Singletons

| Singleton         | Location                              | Responsibility                           |
| ----------------- | ------------------------------------- | ---------------------------------------- |
| `viewManager`     | `src/main/view-manager/index.ts`      | All `WebContentsView` instances          |
| `windowManager`   | `src/main/window-manager/index.ts`    | All `BrowserWindow` instances            |
| `channel`         | `src/shared/channel.ts`               | Default IPC channel (MessageChannelMain) |
| `serviceRegistry` | `src/shared/serviceRegistry/index.ts` | Service registration and routing         |

## ViewManager Modes

`ViewManager` creates `WebContentsView` instances in three modes:

- **embedded** — attached as child of a `BrowserWindow`
- **detached** — hosted in its own `BaseWindow`
- **background** — offscreen rendering (`offscreen: true`), no window attachment

Each sub-window uses its own preload (`src/preload/view.ts`) with an independent `ChannelInstance`.

## IPC Communication

All IPC uses `MessagePort` via the `Channel` abstraction (not traditional `ipcRenderer.invoke`). See [Channel Architecture](channel.md) for detailed documentation.

## Service Registry Center

The `ServiceRegistry` provides a unified way to define and implement services across different processes:

- **Service API Definition** (`src/shared/services/`): Define abstract service APIs using `defineApi()`
- **Service Implementation** (`src/main/services/`, etc.): Implement the APIs and register with `implementService()`
- **Automatic Routing**: Same-process calls invoke implementation directly, cross-process calls use Channel
- **Type-Safe**: Full TypeScript support with recursive `ApiType<T>` for chaining

**Example**:

```typescript
// Define API in shared/services/updater-api.ts
export abstract class UpdaterApi {
  abstract checkForUpdates(): Promise<void>
  abstract quitAndInstall(): Promise<void>
}
export const updaterServiceApi = serviceRegistry.defineApi(UpdaterApi, 'main')

// Implement in main/services/updater-service.ts
class UpdaterService extends UpdaterApi {
  async checkForUpdates() {
    /* implementation */
  }
  async quitAndInstall() {
    /* implementation */
  }
}
serviceRegistry.implementService(viewManager, new UpdaterService())

// Use in any process
await updaterServiceApi.checkForUpdates() // Auto-routes to main process
await updaterServiceApi.use(channel).checkForUpdates() // Use specific channel
```

See `src/shared/serviceRegistry/index.ts` for full API.

## Directory Structure

```
src/
├── main/                    # Main process
│   ├── index.ts           # App entry, exports singletons
│   ├── main-window.ts     # Main BrowserWindow creation
│   ├── ipc.ts             # IPC handler registration
│   ├── assets/            # App assets (icon)
│   ├── updater/           # Auto-update service
│   ├── tray/              # System tray
│   ├── utils/paths.ts    # Runtime path helpers
│   ├── view-manager/      # WebContentsView management
│   ├── window-manager/    # BrowserWindow management
│   └── services/         # Service implementations (main process)
├── preload/                # Preload scripts
│   ├── index.ts          # Main window preload
│   └── view.ts           # Sub-window preload (per-view ChannelInstance)
├── renderer/               # React SPA (dev only)
├── shared/                 # Shared types + infrastructure
│   ├── channel.ts        # IPC channel (MessageChannelMain)
│   ├── serviceRegistry/  # Service registration center
│   ├── services/         # Service API definitions
│   ├── window.ts
│   └── view.ts
├── utils/                  # Shared utilities
│   ├── log/              # electron-log wrapper
│   ├── serialize/        # Serialization utils
│   ├── typed-emitter.ts  # Lightweight event emitter
│   ├── env.ts
│   └── promise.ts
├── vite-plugins/          # Vite plugins
├── __tests__/              # Test suites (main, preload, integration)
│   └── infrastructure/    # Test infrastructure
│       ├── setup.ts           # main project — electron mock, vi.resetModules
│       ├── setup.preload.ts   # preload project — electron mock, vi.resetModules
│       ├── setup.renderer.ts  # renderer project — jest-dom, vi.resetModules
│       ├── mocks/electron.ts  # Shared electron mock objects
│       └── helpers/           # Test helpers (msw, data-helper, create-mocks)
```

## Path Alias

`@/*` maps to `src/` — available in all processes.
