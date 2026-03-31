# AGENTS.md

> **Quick Reference**: This file is for agentic coding assistants. Detailed docs are in `docs/`.
>
> **Note**: When updating docs, keep this file at ~100 lines. Move detailed content to `docs/` folder.

## Project Overview

Electron 34 + React 18 + TypeScript desktop app with MessagePort-based IPC. Three Vitest projects (main/preload/renderer) + Playwright E2E tests.

## Quick Commands

```bash
pnpm run dev              # Build dev + start Electron
pnpm run build            # Production build
pnpm run package:win      # Package for Windows
pnpm run package          # Package for all platforms
pnpm run lint             # Lint code (eslint src)
npx eslint src --fix      # Lint and auto-fix
pnpm run test             # Run all Vitest tests
pnpm run test:main        # Run main process tests only
pnpm run test:preload     # Run preload tests only
pnpm run test:renderer    # Run renderer tests only
pnpm run test:e2e         # Run Playwright E2E tests (build + test)
pnpm run test:e2e:debug   # Run Playwright E2E tests in debug mode
pnpm run test:e2e:report  # Open Playwright HTML test report
npx vitest run <file>     # Single test file (auto-detects project)
npx vitest run <file> --project main   # Single file in main project
```

## Key Singletons

| Singleton         | Location                              | Responsibility                           |
| ----------------- | ------------------------------------- | ---------------------------------------- |
| `viewManager`     | `src/main/viewManager/index.ts`       | All `WebContentsView` instances          |
| `windowManager`   | `src/main/windowManager/index.ts`     | All `BrowserWindow` instances            |
| `channel`         | `src/shared/channel.ts`               | Default IPC channel (MessageChannelMain) |
| `serviceRegistry` | `src/shared/serviceRegistry/index.ts` | Service registration, routing & timeouts |

## Testing Architecture

Three Vitest projects + Playwright E2E:

- **main**: `setup.ts` → `src/__tests__/main/**` (node env)
- **preload**: `setup.preload.ts` → `src/__tests__/preload/**` (jsdom)
- **renderer**: `setup.renderer.ts` → `src/__tests__/renderer/**` (jsdom)
- **e2e**: `playwright.config.ts` → `src/__tests__/e2e/**` (runs against production build)

**Mock Rules** (Vitest):

- `vi.mock` must be in setup files only
- Test files import mocks from `@/__tests__/infrastructure/mocks/electron`
- Main process tests: use `resetSingletons()` in `beforeEach` to clear state

**E2E Testing**:

- Tests run against production build (`pnpm run test:e2e`)
- Uses `electronApp` fixture to launch actual Electron app
- Tests real user interactions across main/preload/renderer processes

## Code Style Summary

- **Naming**: File names and folder names must use camelCase (no hyphens)
- **ESLint**: `curly: ['error', 'all']` — all control bodies must use `{}`
- **Prettier**: no semicolons, single quotes, trailing commas, print width 100
- **TypeScript**: strict mode, use `unknown` instead of `any`
- **Path alias**: `@/*` maps to `src/` — use this for all internal imports
- **Singletons**: Export instances: `export const channel = new Channel()`, `export const serviceRegistry = new ServiceRegistry()`

## Directory Structure

```
src/
├── main/                    # Main process
│   ├── viewManager/         # WebContentsView management
│   ├── windowManager/       # BrowserWindow management
│   └── services/             # Service implementations (main process)
├── preload/                 # Preload scripts
├── renderer/                # React SPA
├── shared/                  # Shared types + infrastructure
│   ├── channel/             # IPC channel (folder structure)
│   ├── serviceRegistry/      # Service registration center
│   │   ├── apiDefinitions.ts # API definition singleton
│   │   ├── decorators.ts      # @Timeout, @MethodTimeout
│   │   ├── error.ts           # ServiceTimeoutError
│   │   └── types.ts           # Service types
│   ├── services/             # Service API definitions
│   ├── view.ts
│   └── window.ts
├── utils/                   # Shared utilities + app services
│   ├── log/                 # electron-log wrapper
│   ├── serialize/
│   ├── promise.ts
│   ├── env.ts
│   ├── type.ts              # AsyncifyFunctions utility
│   └── typedEmitter.ts
 ├── vitePlugins/          # Vite plugins
 └── __tests__/              # Test suites (Vitest)
     ├── infrastructure/     # Test infrastructure
     │   ├── setup.ts
     │   ├── setup.preload.ts
     │   ├── setup.renderer.ts
     │   ├── mocks/
     │   └── helpers/
     ├── main/               # Main process tests
     ├── preload/            # Preload tests
     └── renderer/           # Renderer tests
tests/                       # E2E tests (Playwright)
 └── e2e/                # Playwright E2E tests
     ├── fixtures/
     │   └── electronApp.ts
     ├── helpers/
     │   └── windowHelpers.ts
     ├── app.spec.ts
     └── global-setup.ts
```

## Documentation

| Topic                   | File                                                                       |
| ----------------------- | -------------------------------------------------------------------------- |
| Channel architecture    | [docs/channel.md](docs/channel.md)                                         |
| Service Registry        | [src/shared/serviceRegistry/index.ts](src/shared/serviceRegistry/index.ts) |
| Service Registry Design | [src/shared/serviceRegistry/types.ts](src/shared/serviceRegistry/types.ts) |
| Code style details      | [docs/code-style.md](docs/code-style.md)                                   |
| Patterns & testing      | [docs/patterns.md](docs/patterns.md)                                       |
| Project structure       | [docs/architecture.md](docs/architecture.md)                               |
