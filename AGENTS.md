# AGENTS.md

## Project Overview

Electron 34 + React 18 + TypeScript desktop app scaffold. Vite builds main/preload/renderer; electron-builder packages; electron-updater handles updates; electron-log logs.

## Commands

```bash
pnpm install
pnpm run dev              # Build dev assets + start Electron
pnpm run build            # Production build
pnpm run dist:win         # Package for Windows (NSIS x64)
pnpm run lint             # Lint code
pnpm run test             # Run all tests
pnpm run test:main        # Main process tests only
pnpm run test:preload     # Preload tests only
pnpm run test:renderer    # Renderer tests only
npx vitest run <file>     # Single test file
```

## Code Style

### Formatting (Prettier)

- No semicolons
- Single quotes
- Trailing commas
- Print width: 100
- Tab width: 2
- Run `pnpm run lint` before committing

### TypeScript

- **Strict mode** enabled — no implicit any
- Use `unknown` instead of `any`, then type narrow
- Use `@ts-expect-error` only when Electron's types are overly strict (e.g., dynamic event names)
- Import types with `import type { ... }` when only using types
- Path alias: `@/*` → `src/*`

### Naming Conventions

| Element              | Convention                      | Example                             |
| -------------------- | ------------------------------- | ----------------------------------- |
| Classes              | PascalCase                      | `ManagedWindow`, `ChannelInstance`  |
| Interfaces           | PascalCase, `I` prefix optional | `IManagedWindow` or `ManagedWindow` |
| Private fields       | `_` prefix + camelCase          | `_loaded`, `_forceQuit`             |
| Methods              | camelCase                       | `createWindow`, `destroyView`       |
| Event handlers       | `on` prefix                     | `onClose`, `onResize`               |
| Subscription cleanup | `unsubscribe` / `unsub`         | `unsub()`, `appSubscriptions`       |
| Constants            | UPPER_SNAKE_CASE                | `DEFAULT_CLOSE_ACTION`              |
| Test files           | `*.test.ts`                     | `index.test.ts`                     |

### Imports

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

### Error Handling

- Use `Error` objects with descriptive messages
- Type narrow errors before accessing properties

```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
}
```

- Check for null/undefined before use

```typescript
if (!wc) throw new Error(`webContents not found: ${webContentsId}`)
```

## Patterns

### Event Subscription Cleanup

Track subscriptions for cleanup:

```typescript
private appSubscriptions: Array<() => void> = []

private subscribeToApp(event: string, handler: (...args: unknown[]) => void): void {
  const subscription = () => {
    // @ts-expect-error - Electron types are strict
    app.off(event, handler)
  }
  this.appSubscriptions.push(subscription)
  // @ts-expect-error - Electron types are strict
  app.on(event, handler)
}

destroy(): void {
  this.appSubscriptions.forEach((unsub) => unsub())
  this.appSubscriptions = []
}
```

For Electron classes with `removeAllListeners()`, prefer that over manual tracking.

### Singleton Export

Modules export singleton instances:

```typescript
export const viewManager = new ViewManager()
export const channel = new Channel()
```

### Process Type Checks

```typescript
if (process.env.PROCESS_TYPE === 'main') {
  // main process only
}
if (process.env.PROCESS_TYPE === 'preload') {
  // preload only
}
if (process.env.PROCESS_TYPE === 'renderer') {
  // renderer only
}
```

## Testing

### Architecture

Each Vitest project has its own setup:

```
infrastructure/
├── setup.ts           # main project — electron mock, vi.resetModules
├── setup.preload.ts   # preload project — electron mock, vi.resetModules
└── setup.renderer.ts  # renderer project — jest-dom, vi.resetModules
```

### Mock Rules

- **`vi.mock` must be in setup files only** — never in test files
- **Test files may import mocks** from `@/__tests__/infrastructure/mocks/electron`
- **`beforeEach` cleanup** lives in setup, not in test files

### Test Structure

```typescript
import { describe, it, expect } from 'vitest'
import { Channel } from '@/utils/channel'
import { mockIpcRenderer, mockContextBridge } from '@/__tests__/infrastructure/mocks/electron'

describe('Channel (preload mode)', () => {
  it('should call ipcRenderer.on for __channel_port__', async () => {
    const channel = new Channel()
    await channel.init()
    expect(mockIpcRenderer.on).toHaveBeenCalledWith('__channel_port__', expect.any(Function))
  })
})
```

## Project Structure

```
src/
├── main/           # Main process — windows, views, tray, updater
├── preload/        # Preload scripts — main window + sub-window
├── renderer/       # React SPA (dev only)
├── shared/         # Types shared across processes
├── utils/          # Shared utilities (channel, log, typed-emitter...)
├── vite-plugins/   # Vite plugins
├── __tests__/      # Test suites (main, preload, integration)
│   └── infrastructure/  # Test infrastructure (setup, helpers, mocks)
│       ├── setup.ts
│       ├── setup.preload.ts
│       ├── setup.renderer.ts
│       ├── mocks/
│       └── helpers/
```

## Quick Reference

- Path alias: `@/*` → `src/`
- Process guards: `process.env.PROCESS_TYPE === 'main'/'renderer'`
- Key singletons: `viewManager`, `windowManager`, `channel`
