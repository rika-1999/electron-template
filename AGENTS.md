# AGENTS.md

> **Documentation Principle**: Keep `AGENTS.md` simple — quick reference only. Complex information belongs in `docs/` with cross-references.

## Project Overview

Electron 34 + React 18 + TypeScript desktop app scaffold. MessagePort-based Channel IPC.

## Quick Commands

```bash
pnpm run dev              # Build dev + start Electron
pnpm run build            # Production build
pnpm run dist:win         # Package for Windows
pnpm run lint             # Lint code (eslint src)
npx eslint src --fix      # Lint and auto-fix
pnpm run test             # Run all tests
npx vitest run <file>     # Single test file
npx vitest run <file> --project main   # Single file in main project
```

## Code Style Summary

- ESLint: `curly: ['error', 'all']` — all control bodies must use `{}`
- Prettier: no semicolons, single quotes, trailing commas, print width 100
- TypeScript: strict mode, use `unknown` instead of `any`
- Imports: Electron → type imports → `@/*` path alias → relative
- Singletons: `export const channel = new Channel()`
- Process checks: `@/utils/env` helpers (`isMain()`, `isRenderer()`, etc.)

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
import { Channel } from '@/utils/channel'
import { viewManager } from '@/main/view-manager'

// Relative imports for sibling modules
import { paths } from '../utils/paths'
```

## Key Patterns

- **Singletons**: Modules export singleton instances: `export const channel = new Channel()`
- **TypedEmitter**: Managers and managed objects extend `TypedEmitter` for typed events
- **Event cleanup**: Track subscriptions for cleanup in `destroy()`. Use `@ts-expect-error` for Electron's strict event typing
- **Error handling**: Use `Error` objects with descriptive messages. Type narrow errors before accessing properties

## Documentation

| Topic                | File                                         |
| -------------------- | -------------------------------------------- |
| Channel architecture | [docs/channel.md](docs/channel.md)           |
| Code style details   | [docs/code-style.md](docs/code-style.md)     |
| Patterns & testing   | [docs/patterns.md](docs/patterns.md)         |
| Project structure    | [docs/architecture.md](docs/architecture.md) |
