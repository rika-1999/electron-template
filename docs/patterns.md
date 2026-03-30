# Patterns

See [AGENTS.md](../AGENTS.md) for a quick reference guide and [Code Style](code-style.md) for formatting rules.

## Event Subscription Cleanup

For app/window/webContents events, track subscriptions for cleanup:

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
  // ...
}
```

For Electron classes with `removeAllListeners()`, prefer that over manual tracking.

## Singleton Export

Modules export singleton instances:

```typescript
export const viewManager = new ViewManager()
export const channel = new Channel()
```

## Singleton Decorator

Use `@Singleton()` decorator to enforce singleton behavior for classes that should only have one instance per process type.

### Basic Usage

```typescript
import { Singleton } from '@/utils/singleton'

@Singleton()
class MyService {
  constructor(public value: string) {}
}

const instance1 = new MyService('first')
const instance2 = new MyService('second')
console.log(instance1 === instance2) // true - returns same instance
```

### Selective Process Types

Specify which process types should use singleton behavior:

```typescript
// Singleton only in main and renderer processes
@Singleton('main', 'renderer')
class SharedService {
  constructor() {}
}

// In main/renderer: returns same instance
// In preload: creates new instance each time
```

### When to Use

Use `@Singleton()` decorator for:

- **Global state managers** (e.g., ServiceRegistry, WindowManager, ViewManager)
- **Service classes** with shared resources
- **IPC channels** that maintain connections

**Existing singleton classes:**

- `ServiceRegistry` - @Singleton()
- `WindowManager` - @Singleton()
- `ViewManager` - @Singleton()
- `UpdaterService` - @Singleton()
- `Channel` - @Singleton('preload', 'renderer')

### Rules

1. **Use decorator on the class definition**, not the export statement:

   ```typescript
   @Singleton()
   class MyService {} // ✓ Correct

   class MyService {}
   export const service = new MyService() // ✓ Still works, but no decorator protection
   ```

2. **Specify process types when appropriate:**

   ```typescript
   @Singleton()                    // All process types (default)
   @Singleton('main')               // Only main
   @Singleton('preload', 'renderer') // Multiple process types
   ```

3. **Constructor parameters are only used on first call:**

   ```typescript
   @Singleton()
   class ConfigService {
     constructor(public config: string) {}
   }

   const s1 = new ConfigService('config1')
   const s2 = new ConfigService('config2')
   console.log(s1.config) // 'config1' - first value kept
   console.log(s2.config) // 'config1' - second argument ignored
   ```

## Managed Resource Cleanup

Always clean up subscriptions and listeners in `destroy()`:

```typescript
destroy(): void {
  this.appSubscriptions.forEach((unsub) => unsub())
  this.appSubscriptions = []
  this.nativeWindow.removeAllListeners()
  this.removeAllListeners()
  this.channel.destroy()
  // ...
}
```

## Process Type Checks

Prefer utility helpers from `@/utils/env`:

```typescript
import { isMain, isPreload, isRenderer, isDev } from '@/utils/env'

if (isMain()) {
  /* main process only */
}
if (isPreload()) {
  /* preload only */
}
if (isRenderer()) {
  /* renderer only */
}
```

Or check directly:

```typescript
if (process.env.PROCESS_TYPE === 'main') {
  /* ... */
}
```

## Testing

See [Project Structure](architecture.md) for directory layout.

### Architecture

Three Vitest projects, each with its own setup:

| Project  | Setup                              | Include                                                 | Environment |
| -------- | ---------------------------------- | ------------------------------------------------------- | ----------- |
| main     | `infrastructure/setup.ts`          | `src/__tests__/main/**`, `src/__tests__/integration/**` | node        |
| preload  | `infrastructure/setup.preload.ts`  | `src/__tests__/preload/**`                              | jsdom       |
| renderer | `infrastructure/setup.renderer.ts` | `src/__tests__/renderer/**`                             | jsdom       |

### Mock Rules

- **`vi.mock` must be in setup files only** — never in test files
- **Test files may import mocks** from `@/__tests__/infrastructure/mocks/electron` for assertions
- **`beforeEach` cleanup** lives in setup, not in test files
- Renderer setup mocks `window.__app_log__`, `window.__app_channel__`, `window.__app_ipc_channel__`

### Example

```typescript
// src/__tests__/preload/channel.test.ts
import { describe, it, expect } from 'vitest'
import { Channel } from '@/shared/channel'
import { mockIpcRenderer, mockContextBridge } from '@/__tests__/infrastructure/mocks/electron'

describe('Channel (preload mode)', () => {
  it('should call ipcRenderer.on for __channel_port__', async () => {
    const channel = new Channel()
    await channel.init()
    expect(mockIpcRenderer.on).toHaveBeenCalledWith('__channel_port__', expect.any(Function))
  })
})
```

### Singleton Reset

Setup files automatically handle singleton cleanup between tests:

**Main process** (`infrastructure/setup.ts`):

```typescript
beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules() // Resets singleton instances
})
```

**Preload** (`infrastructure/setup.preload.ts`):

```typescript
beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules() // Resets singleton instances
})
```

**Renderer** (`infrastructure/setup.renderer.ts`):

```typescript
beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules() // Resets singleton instances
})
```

**No manual reset needed** — `vi.resetModules()` in setup files re-imports modules, creating fresh singleton instances. Tests run with clean state automatically.

---

## File Extension Conventions

### Configuration Files

**Rule:** All configuration files must use `.mts` extension for ESM compatibility.

**Required imports for ESM compatibility:**

```typescript
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
```

**Why this is needed:**

- `.mts` files are treated as ESM by TypeScript and Node.js
- `__dirname` is not available in ESM - must be manually defined
- `import.meta.url` provides the current module's URL

**Configuration files:**

- `vite.config.main.mts`
- `vite.config.renderer.mts`
- `vite.config.preload.mts`
- `vitest.config.mts`

**Example:**

```typescript
// vite.config.main.mts
import path from 'node:path'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  // ...
})
```

### Script Files

**Rule:** All JavaScript build scripts must use `.mjs` extension for ESM compatibility.

**Example:**

- `scripts/build.mjs` - Uses `import.meta.url` for ESM module resolution

**Common usage pattern:**

```javascript
// scripts/build.mjs
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
```

### Plugin ESM Loading

**Rule:** When importing ESM-only plugins in CommonJS config files, use dynamic require.

**Example:**

```typescript
// vite.config.main.mts
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { viteStaticCopy } = require('vite-plugin-static-copy')
```

### Summary

| File Type         | Extension  | Purpose                                 |
| ----------------- | ---------- | --------------------------------------- |
| TypeScript config | `.mts`     | ESM compatibility, explicit \_\_dirname |
| JavaScript script | `.mjs`     | ESM scripts, import.meta.url support    |
| Source code       | `.ts`      | Regular TypeScript source files         |
| Test files        | `.test.ts` | Regular test files                      |
