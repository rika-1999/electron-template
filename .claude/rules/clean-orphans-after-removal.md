---
title: Clean Up Orphaned Imports After Code Removal
impact: MEDIUM
---

# Clean Up Orphaned Imports After Code Removal

When removing code (function calls, expressions, statements), verify that the imports those removed lines depended on are still needed. If an import becomes unused after removal, remove it from the import statement.

## Incorrect

`vi.stubEnv()` calls were removed, but the `vi` import that only those calls used is left behind.

```typescript
import { describe, expect, it, vi } from 'vitest'
// 'vi' is never used anywhere in this file
```

## Correct

After removing the code that used `vi`, the import is also removed.

```typescript
import { describe, expect, it } from 'vitest'
```
