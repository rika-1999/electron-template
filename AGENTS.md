# AGENTS.md

> **Quick Reference**: This file is for agentic coding assistants. Detailed docs are in `docs/`.

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

## Code Style Summary

- **ESLint**: `curly: ['error', 'all']` — all control bodies must use `{}`
- **Prettier**: no semicolons, single quotes, trailing commas, print width 100
- **TypeScript**: strict mode, use `unknown` instead of `any`
- **Path alias**: `@/*` maps to `src/` — use this for all internal imports
- **Singletons**: Export instances: `export const channel = new Channel()`

## Naming Conventions

| Element        | Convention                      | Example                           |
| -------------- | ------------------------------- | --------------------------------- |
| Classes        | PascalCase                      | `ManagedWindow`, `ChannelApiImpl` |
| Interfaces     | PascalCase, prefix `I` optional | `IManagedWindow` or `ChannelAPI`  |
| Private fields | `_` prefix + camelCase          | `_loaded`, `_forceQuit`           |
| Methods        | camelCase                       | `createWindow`, `destroyView`     |
| Event handlers | `on` prefix                     | `onClose`, `onResize`             |
| Constants      | UPPER_SNAKE_CASE                | `DEFAULT_CLOSE_ACTION`            |
| Test files     | `*.test.ts`                     | `index.test.ts`                   |

## Import Order

```typescript
// Electron imports
import { app, BrowserWindow } from 'electron'

// Types (import type when only used for types)
import type { WindowState, ViewOptions } from '@/shared/window'

// Internal modules (path alias)
import { Channel } from '@/shared/channel'
import { viewManager } from '@/main/view-manager'

// Relative imports for sibling modules
import { paths } from '../utils/paths'
```

## Error Handling

- Use `Error` objects with descriptive messages
- Type narrow errors before accessing properties:

```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  // ...
}
```

- Check for null/undefined before use:

```typescript
if (!wc) throw new Error(`webContents not found: ${webContentsId}`)
```

## Key Patterns

### Singletons

Modules export singleton instances: `export const channel = new Channel()`

### TypedEmitter

Managers and managed objects extend `TypedEmitter` for typed events

### Event Cleanup

Track subscriptions for cleanup in `destroy()`. Use `@ts-expect-error` for Electron's strict event typing

### Process Type Checks

Use `@/utils/env` helpers (`isMain()`, `isRenderer()`, etc.) or check `process.env.PROCESS_TYPE`

### Testing Architecture

Three Vitest projects:

- **main**: `setup.ts` → `src/__tests__/main/**` (node env)
- **preload**: `setup.preload.ts` → `src/__tests__/preload/**` (jsdom)
- **renderer**: `setup.renderer.ts` → `src/__tests__/renderer/**` (jsdom)

**Mock Rules**:

- `vi.mock` must be in setup files only
- Test files import mocks from `@/__tests__/infrastructure/mocks/electron`
- Main process tests: use `resetSingletons()` in `beforeEach` to clear state

## Directory Structure

```
src/
├── main/                    # Main process
│   ├── view-manager/         # WebContentsView management
│   └── window-manager/       # BrowserWindow management
├── preload/                 # Preload scripts
├── renderer/                # React SPA
├── shared/                  # Shared types + infrastructure
│   ├── channel/             # IPC channel (folder structure)
│   ├── view.ts
│   └── window.ts
├── utils/                   # Shared utilities + app services
│   ├── log/                 # electron-log wrapper
│   ├── serialize/
│   ├── promise.ts
│   ├── env.ts
│   └── typed-emitter.ts
└── __tests__/               # Test suites
    └── infrastructure/     # Test infrastructure
```

## Documentation

| Topic                | File                                         |
| -------------------- | -------------------------------------------- |
| Channel architecture | [docs/channel.md](docs/channel.md)           |
| Code style details   | [docs/code-style.md](docs/code-style.md)     |
| Patterns & testing   | [docs/patterns.md](docs/patterns.md)         |
| Project structure    | [docs/architecture.md](docs/architecture.md) |
