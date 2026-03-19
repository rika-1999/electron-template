# Architecture

## Process Model

Electron runs in 3 process types:

- **main** — manages windows, views, tray, updater; entry at `src/main/index.ts`
- **preload** — bridges main and renderer via `contextBridge`; scripts at `src/preload/`
- **renderer** — React SPA at `src/renderer/`

## Key Singletons

| Singleton       | Location                           | Responsibility                           |
| --------------- | ---------------------------------- | ---------------------------------------- |
| `viewManager`   | `src/main/view-manager/index.ts`   | All `WebContentsView` instances          |
| `windowManager` | `src/main/window-manager/index.ts` | All `BrowserWindow` instances            |
| `channel`       | `src/utils/channel/index.ts`       | Default IPC channel (MessageChannelMain) |

## ViewManager Modes

`ViewManager` creates `WebContentsView` instances in three modes:

- **embedded** — attached as child of a `BrowserWindow`
- **detached** — hosted in its own `BaseWindow`
- **background** — offscreen rendering (`offscreen: true`), no window attachment

Each sub-window uses its own preload (`src/preload/view.ts`) with an independent `ChannelInstance`.

## IPC Communication

All IPC uses `MessageChannelMain` via `ChannelInstance` (`src/utils/channel/`). Use `channel.request()` from renderer to call main handlers and await responses.

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
│   └── window-manager/    # BrowserWindow management
├── preload/                # Preload scripts
│   ├── index.ts          # Main window preload
│   └── view.ts           # Sub-window preload (per-view ChannelInstance)
├── renderer/               # React SPA (dev only)
├── shared/                 # Types shared across processes
│   ├── window.ts
│   └── view.ts
├── utils/                  # Shared utilities
│   ├── channel/          # IPC channel (MessageChannelMain)
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
