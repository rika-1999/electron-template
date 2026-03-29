# AGENTS.md

> **Quick Reference**: This file is for agentic coding assistants. Detailed docs are in `docs/`.
>
> **Note**: When updating docs, keep this file at ~100 lines. Move detailed content to `docs/` folder.

## Project Overview

Electron 34 + React 18 + TypeScript desktop app with MessagePort-based IPC. Three Vitest projects (main/preload/renderer).

## Quick Commands

```bash
pnpm run dev              # Build dev + start Electron
pnpm run build            # Production build
pnpm run dist:win         # Package for Windows
pnpm run lint             # Lint code (eslint src)
npx eslint src --fix      # Lint and auto-fix
pnpm run test             # Run all tests
pnpm run test:main        # Run main process tests only
pnpm run test:preload     # Run preload tests only
pnpm run test:renderer    # Run renderer tests only
npx vitest run <file>     # Single test file (auto-detects project)
npx vitest run <file> --project main   # Single file in main project
```

## Key Singletons

| Singleton         | Location                              | Responsibility                           |
| ----------------- | ------------------------------------- | ---------------------------------------- |
| `viewManager`     | `src/main/view-manager/index.ts`      | All `WebContentsView` instances          |
| `windowManager`   | `src/main/window-manager/index.ts`    | All `BrowserWindow` instances            |
| `channel`         | `src/shared/channel.ts`               | Default IPC channel (MessageChannelMain) |
| `serviceRegistry` | `src/shared/serviceRegistry/index.ts` | Service registration and routing         |

## Testing Architecture

Three Vitest projects:

- **main**: `setup.ts` → `src/__tests__/main/**` (node env)
- **preload**: `setup.preload.ts` → `src/__tests__/preload/**` (jsdom)
- **renderer**: `setup.renderer.ts` → `src/__tests__/renderer/**` (jsdom)

**Mock Rules**:

- `vi.mock` must be in setup files only
- Test files import mocks from `@/__tests__/infrastructure/mocks/electron`
- Main process tests: use `resetSingletons()` in `beforeEach` to clear state

## Code Style Summary

- **ESLint**: `curly: ['error', 'all']` — all control bodies must use `{}`
- **Prettier**: no semicolons, single quotes, trailing commas, print width 100
- **TypeScript**: strict mode, use `unknown` instead of `any`
- **Path alias**: `@/*` maps to `src/` — use this for all internal imports
- **Singletons**: Export instances: `export const channel = new Channel()`, `export const serviceRegistry = new ServiceRegistry()`

## Directory Structure

```
src/
├── main/                    # Main process
│   ├── view-manager/         # WebContentsView management
│   ├── window-manager/       # BrowserWindow management
│   └── services/             # Service implementations (main process)
├── preload/                 # Preload scripts
├── renderer/                # React SPA
├── shared/                  # Shared types + infrastructure
│   ├── channel/             # IPC channel (folder structure)
│   ├── serviceRegistry/      # Service registration center
│   ├── services/             # Service API definitions
│   ├── view.ts
│   └── window.ts
├── utils/                   # Shared utilities + app services
│   ├── log/                 # electron-log wrapper
│   ├── serialize/
│   ├── promise.ts
│   ├── env.ts
│   └── typed-emitter.ts
├── vite-plugins/          # Vite plugins
└── __tests__/              # Test suites
    └── infrastructure/     # Test infrastructure
```

## Documentation

| Topic                | File                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| Channel architecture | [docs/channel.md](docs/channel.md)                                         |
| Service Registry     | [src/shared/serviceRegistry/index.ts](src/shared/serviceRegistry/index.ts) |
| Code style details   | [docs/code-style.md](docs/code-style.md)                                   |
| Patterns & testing   | [docs/patterns.md](docs/patterns.md)                                       |
| Project structure    | [docs/architecture.md](docs/architecture.md)                               |
