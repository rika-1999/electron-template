# Architecture

See [AGENTS.md](../AGENTS.md) for a quick reference guide.

## Process Model

Electron runs in 3 process types:

- **main** — manages windows, views, tray, updater; entry at `src/main/index.ts`
- **preload** — bridges main and renderer via `contextBridge`; entry at `src/preload/index.ts`
- **renderer** — React SPA at `src/renderer/`

## Key Singletons

| Singleton         | Location                              | Responsibility                           |
| ----------------- | ------------------------------------- | ---------------------------------------- |
| `viewManager`     | `src/main/viewManager/index.ts`       | All `WebContentsView` instances          |
| `windowManager`   | `src/main/windowManager/index.ts`     | All `BrowserWindow` instances            |
| `channel`         | `src/shared/channel/index.ts`         | Default IPC channel (MessageChannelMain) |
| `serviceRegistry` | `src/shared/serviceRegistry/index.ts` | Service registration and routing         |

## ViewManager Modes

`ViewManager` creates `WebContentsView` instances in three modes:

- **embedded** — attached as child of a `BrowserWindow`
- **detached** — hosted in its own `BaseWindow`
- **background** — offscreen rendering (`offscreen: true`), no window attachment

All views share a single preload script (`src/preload/index.ts`). Each view gets its own `Channel` instance at runtime.

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
// Define API in shared/services/updaterApi.ts
export abstract class UpdaterApi {
  abstract checkForUpdates(): Promise<void>
  abstract quitAndInstall(): Promise<void>
}
export const updaterServiceApi = serviceRegistry.defineApi(UpdaterApi, 'main')

// Implement in main/services/updaterService.ts
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

**Example**: For a complete end-to-end example of service communication, see [Cross-Process Communication Example](cross-process-communication-example.md).

See `src/shared/serviceRegistry/index.ts` for full API.

## Directory Structure

```
src/
├── main/                    # Main process
│   ├── index.ts           # App entry, exports singletons
│   ├── mainWindow.ts     # Main BrowserWindow creation
│   ├── updater/           # Auto-update service
│   ├── tray/              # System tray
│   ├── utils/paths.ts    # Runtime path helpers
│   ├── viewManager/      # WebContentsView management
│   ├── windowManager/    # BrowserWindow management
│   └── services/         # Service implementations (main process)
├── preload/                # Preload script (shared by all views)
│   └── index.ts          # Channel bridge via contextBridge
├── renderer/               # React SPA (dev only)
├── shared/                 # Shared types + infrastructure
│   ├── channel/          # IPC channel (MessageChannelMain)
│   ├── serviceRegistry/  # Service registration center
│   ├── services/         # Service API definitions
│   ├── window.ts
│   └── view.ts
├── utils/                  # Shared utilities
│   ├── log/              # electron-log wrapper
│   ├── serialize/        # Serialization utils
│   ├── typedEmitter.ts  # Lightweight event emitter
│   ├── env.ts
│   └── promise.ts
├── vitePlugins/          # Vite plugins
├── __tests__/              # Test suites (main, preload, integration)
│   └── infrastructure/    # Test infrastructure
│       ├── setup.ts           # main project — electron mock, vi.resetModules
│       ├── setup.preload.ts   # preload project — electron mock, vi.resetModules
│       ├── setup.renderer.ts  # renderer project — jest-dom, vi.resetModules
│       ├── mocks/electron.ts  # Shared electron mock objects
│       └── helpers/           # Test helpers (msw, dataHelper, create-mocks)
```

## Path Alias

`@/*` maps to `src/` — available in all processes.
