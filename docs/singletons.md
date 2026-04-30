# Key Singletons

This document describes the singleton instances used throughout the application.

## Singleton Instances

| Singleton         | Location                      | Purpose                                  |
| ----------------- | ----------------------------- | ---------------------------------------- |
| `viewManager`     | `src/main/viewManager/`       | Manages all `WebContentsView` instances  |
| `windowManager`   | `src/main/windowManager/`     | Manages all `BrowserWindow` instances    |
| `channel`         | `src/shared/channel.ts`       | Default IPC channel (MessageChannelMain) |
| `serviceRegistry` | `src/shared/serviceRegistry/` | Service registration, routing & timeouts |

## Usage Pattern

Singletons are exported as instances and imported directly:

```typescript
import { viewManager } from '@/main/viewManager'
import { channel } from '@/shared/channel'
import { serviceRegistry } from '@/shared/serviceRegistry'
```

## Singleton Decorator

For classes that should only have one instance per process type, use the `@Singleton()` decorator.

See [Patterns - Singleton Decorator](patterns.md#singleton-decorator) for detailed usage instructions.

## Existing Singleton Classes

The following classes use the `@Singleton()` decorator:

- `ServiceRegistry` - @Singleton()
- `WindowManager` - @Singleton()
- `ViewManager` - @Singleton()
- `UpdaterService` - @Singleton()
- `Channel` - @Singleton('preload', 'renderer')
