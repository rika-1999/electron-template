# Code Style

## Formatting (Prettier)

See `.prettierrc`:
- No semicolons
- Single quotes
- Trailing commas
- Print width: 100
- Tab width: 2

Run `pnpm run lint -- --fix` before committing.

## TypeScript

- **Strict mode** enabled in `tsconfig.json`
- No `any` — use `unknown` and type narrow
- Use `@ts-expect-error` only when Electron's types are overly strict (e.g., dynamic event names)
- Import types with `import type { ... }` when only using types
- Path alias: `@/*` maps to `src/*`

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Classes | PascalCase | `ManagedWindow`, `ChannelInstance` |
| Interfaces | PascalCase, prefix `I` optional | `IManagedWindow` or `ManagedWindow` |
| Private fields | `_` prefix + camelCase | `_loaded`, `_forceQuit` |
| Methods | camelCase | `createWindow`, `destroyView` |
| Event handlers | `on` prefix | `onClose`, `onResize` |
| Subscription cleanup | `unsubscribe` / `unsub` | `unsub()`, `appSubscriptions` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_CLOSE_ACTION` |
| Test files | `*.test.ts` | `index.test.ts` |

## Imports

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
