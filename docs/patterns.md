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

### Singleton Reset

For main process tests, call `resetSingletons()` to clear state between tests:

```typescript
import { resetSingletons } from '@/__tests__/infrastructure/setup'

beforeEach(async () => {
  vi.clearAllMocks()
  await resetSingletons()
})
```
