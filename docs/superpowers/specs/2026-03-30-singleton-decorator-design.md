# Singleton Decorator Design

**Date:** 2026-03-30  
**Topic:** Process-aware singleton class decorator

## Overview

A class decorator `@Singleton()` that ensures a class has only one instance per Electron process type ('main' | 'preload' | 'renderer'). The decorator is transparent to users - they call `new MyClass()` normally, and the decorator automatically handles singleton behavior.

## Requirements

### Functional Requirements

- **Default behavior:** `@Singleton()` creates a singleton instance for the current PROCESS_TYPE, and reuse it on subsequent `new` calls
- **Selective behavior:** `@Singleton('main', 'renderer')` creates singletons only in specified process types, while other process types get new instances each time
- **Transparent API:** Users interact with decorated classes normally using `new MyClass()`
- **Constructor handling:** Constructor arguments are only used on the first call; subsequent calls ignore them
- **No testing reset:** No mechanism provided to reset singleton instances

### Non-Functional Requirements

- **Process isolation:** Each Electron process maintains its own singleton cache, leveraging natural process boundary separation
- **Type safety:** Decorator signature accepts valid PROCESS_TYPE values
- **Zero runtime overhead for non-singletons:** When PROCESS_TYPE is not in the singleton list, the decorator is a no-op

## API Specification

```typescript
function Singleton(...processTypes: ('main' | 'preload' | 'renderer')[]): ClassDecorator
```

### Parameters

- `processTypes`: Optional list of PROCESS_TYPE values where singleton behavior should apply
  - Empty array (default): singleton in all process types
  - Specified values: singleton only in those process types

### Usage Examples

```typescript
// Singleton in all process types
@Singleton()
class DatabaseService {
  constructor(config: string) {
    this.config = config
  }
  private config: string
}

// Singleton only in main and renderer
@Singleton('main', 'renderer')
class CacheService {
  constructor() {}
}

// Usage - transparent
const db1 = new DatabaseService('config1') // Creates singleton
const db2 = new DatabaseService('config2') // Returns same instance (config2 ignored)
console.log(db1 === db2) // true

const cache = new CacheService() // Singleton in main/renderer, new instance in preload
```

## Architecture

### Core Components

1. **Storage Layer**
   - `WeakMap<ClassConstructor, Instance>` - stores singleton instances
   - Key: decorated class constructor
   - Value: singleton instance for current process
   - WeakMap allows garbage collection when class is no longer needed

2. **Decorator Logic Flow**

   For each decorated class:

   ```
   1. Determine current PROCESS_TYPE
   2. Check if current PROCESS_TYPE is in singleton list (or if list is empty)
   3. If NOT in list:
      - Return without modification (normal constructor behavior)
   4. If in list:
      - Check WeakMap for existing instance
      - If found: return cached instance (ignore constructor args)
      - If not found:
        a. Call original constructor with provided args
        b. Store instance in WeakMap
        c. Return instance
   ```

3. **Process Isolation**
   - Each Electron process (main/preload/renderer) has its own singleton cache
   - Natural process boundary separation ensures no cross-process instance sharing
   - No need for PROCESS_TYPE-keyed storage within the WeakMap

### File Location

New file: `src/utils/singleton.ts`

## Implementation Details

### Storage

```typescript
const singletonInstances = new WeakMap<Function, unknown>()
```

### Decorator Implementation

```typescript
export function Singleton(...processTypes: ('main' | 'preload' | 'renderer')[]): ClassDecorator {
  return (target: Function) => {
    const currentProcessType =
      (process.env.PROCESS_TYPE as 'main' | 'preload' | 'renderer') || 'main'
    const shouldSingleton = processTypes.length === 0 || processTypes.includes(currentProcessType)

    if (!shouldSingleton) {
      return // No-op for non-singleton process types
    }

    // Wrap the constructor to implement singleton behavior
    const wrappedConstructor = new Proxy(target, {
      construct(targetConstructor, args) {
        const existingInstance = singletonInstances.get(targetConstructor)
        if (existingInstance !== undefined) {
          return existingInstance
        }

        const instance = Reflect.construct(targetConstructor, args)
        singletonInstances.set(targetConstructor, instance)
        return instance
      },
    })

    // Replace the original constructor with the wrapped one
    return wrappedConstructor as any
  }
}
```

### Error Handling

- Invalid PROCESS_TYPE values will cause TypeScript type errors at compile time
- No runtime error handling needed - decorator is a compile-time construct

## Testing Strategy

### Trade-off: Test Isolation

**No singleton reset mechanism is provided.** This is an intentional trade-off:

- **Benefit:** Simpler production code, no testing-only utilities, minimal decorator overhead
- **Cost:** Singleton instances persist across tests in the same Vitest process
- **Impact:** Tests for singleton behavior must account for shared state

**Testing approach:**

- Tests verify singleton behavior works correctly (e.g., `new X()` returns same instance)
- Tests that require independent singleton instances should use different classes or different PROCESS_TYPE
- Test isolation is not violated in the traditional sense because singletons are inherently non-isolated by design

### Test Coverage

1. **Basic singleton behavior**
   - Multiple `new` calls return same instance in same PROCESS_TYPE
   - Constructor args only used on first call

2. **Selective PROCESS_TYPE singletons**
   - Singleton in specified process types
   - New instances in non-specified process types

3. **Edge cases**
   - Empty decorator call `@Singleton()`
   - All process types specified `@Singleton('main', 'preload', 'renderer')`
   - Single process type specified `@Singleton('main')`

4. **Integration**
   - Works in actual main/preload/renderer processes (via environment variable)

### Test File Structure

Create test files in each Vitest project:

- `src/__tests__/main/utils/singleton.test.ts`
- `src/__tests__/preload/utils/singleton.test.ts`
- `src/__tests__/renderer/utils/singleton.test.ts`

Each test uses the PROCESS_TYPE set by Vitest config and verifies behavior.

## Dependencies

- No external dependencies
- Uses standard JavaScript `WeakMap` and `Proxy`
- Relies on `process.env.PROCESS_TYPE` injected by Vite config

## Migration Guide

No migration needed - this is a new utility. Usage is opt-in via decorator application.

## Future Considerations

- If testing reset becomes necessary, could add a `clearSingletons()` utility function
- Could extend to support custom caching strategies beyond WeakMap
- Could add logging/debugging mode to track singleton creation
