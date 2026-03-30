# Singleton Decorator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a `@Singleton()` class decorator that creates singleton instances per Electron process type ('main' | 'preload' | 'renderer').

**Architecture:** A WeakMap stores singleton instances keyed by class constructor. The decorator wraps the constructor with a Proxy that checks for existing instances before creating new ones. Process isolation is achieved naturally since each Electron process maintains its own WeakMap.

**Tech Stack:** TypeScript decorators, Proxy, WeakMap, process.env.PROCESS_TYPE

---

## File Structure

**New files:**

- `src/utils/singleton.ts` - Main decorator implementation
- `src/__tests__/main/utils/singleton.test.ts` - Main process tests
- `src/__tests__/preload/utils/singleton.test.ts` - Preload process tests
- `src/__tests__/renderer/utils/singleton.test.ts` - Renderer process tests

**No existing files modified.**

---

### Task 1: Create the singleton decorator implementation

**Files:**

- Create: `src/utils/singleton.ts`

- [ ] **Step 1: Write the basic decorator structure**

```typescript
const singletonInstances = new WeakMap<Function, unknown>()

export function Singleton(...processTypes: ('main' | 'preload' | 'renderer')[]): ClassDecorator {
  return (target: Function) => {
    const currentProcessType =
      (process.env.PROCESS_TYPE as 'main' | 'preload' | 'renderer') || 'main'
    const shouldSingleton = processTypes.length === 0 || processTypes.includes(currentProcessType)

    if (!shouldSingleton) {
      return target // No-op: return original constructor unchanged
    }

    return target as any
  }
}
```

- [ ] **Step 2: Add TypeScript type definitions**

```typescript
type ProcessType = 'main' | 'preload' | 'renderer'

const singletonInstances = new WeakMap<Function, unknown>()

export function Singleton(...processTypes: ProcessType[]): ClassDecorator {
  return (target: Function) => {
    const currentProcessType = (process.env.PROCESS_TYPE as ProcessType) || 'main'
    const shouldSingleton = processTypes.length === 0 || processTypes.includes(currentProcessType)

    if (!shouldSingleton) {
      return target // No-op: return original constructor unchanged
    }

    return target as any
  }
}
```

- [ ] **Step 3: Add Proxy-based constructor wrapping**

```typescript
type ProcessType = 'main' | 'preload' | 'renderer'

const singletonInstances = new WeakMap<Function, unknown>()

export function Singleton(...processTypes: ProcessType[]): ClassDecorator {
  return (target: Function) => {
    const currentProcessType = (process.env.PROCESS_TYPE as ProcessType) || 'main'
    const shouldSingleton = processTypes.length === 0 || processTypes.includes(currentProcessType)

    if (!shouldSingleton) {
      return target // No-op: return original constructor unchanged
    }

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

    return wrappedConstructor as any
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/utils/singleton.ts
git commit -m "feat: add @Singleton decorator implementation"
```

---

### Task 2: Write main process tests

**Files:**

- Create: `src/__tests__/main/utils/singleton.test.ts`

- [ ] **Step 1: Write test for basic singleton behavior**

```typescript
import { describe, it, expect } from 'vitest'
import { Singleton } from '@/utils/singleton'

describe('Singleton decorator (main process)', () => {
  it('should return the same instance for multiple new calls', () => {
    @Singleton()
    class TestClass {
      constructor(public value: number) {}
    }

    const instance1 = new TestClass(1)
    const instance2 = new TestClass(2)
    const instance3 = new TestClass(3)

    expect(instance1).toBe(instance2)
    expect(instance2).toBe(instance3)
    expect(instance1.value).toBe(1) // First value kept
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test:main -- src/__tests__/main/utils/singleton.test.ts`
Expected: FAIL if decorator not working, PASS if working

- [ ] **Step 3: Add test for selective process types**

```typescript
it('should be singleton when PROCESS_TYPE is in the list', () => {
  @Singleton('main')
  class MainOnlySingleton {
    constructor(public value: number) {}
  }

  const instance1 = new MainOnlySingleton(1)
  const instance2 = new MainOnlySingleton(2)

  expect(instance1).toBe(instance2)
})
```

- [ ] **Step 4: Add test for default singleton (all process types)**

```typescript
it('should be singleton by default (all process types)', () => {
  @Singleton()
  class DefaultSingleton {
    constructor(public value: string) {}
  }

  const instance1 = new DefaultSingleton('first')
  const instance2 = new DefaultSingleton('second')

  expect(instance1).toBe(instance2)
  expect(instance1.value).toBe('first')
})
```

- [ ] **Step 5: Run tests to verify all pass**

Run: `pnpm run test:main -- src/__tests__/main/utils/singleton.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/main/utils/singleton.test.ts
git commit -m "test: add main process singleton tests"
```

---

### Task 3: Write preload process tests

**Files:**

- Create: `src/__tests__/preload/utils/singleton.test.ts`

- [ ] **Step 1: Write basic preload singleton test**

```typescript
import { describe, it, expect } from 'vitest'
import { Singleton } from '@/utils/singleton'

describe('Singleton decorator (preload process)', () => {
  it('should return the same instance for multiple new calls', () => {
    @Singleton()
    class TestClass {
      constructor(public value: number) {}
    }

    const instance1 = new TestClass(1)
    const instance2 = new TestClass(2)

    expect(instance1).toBe(instance2)
  })

  it('should NOT be singleton when preload is not in the list', () => {
    @Singleton('main')
    class MainOnlySingleton {
      constructor(public value: number) {}
    }

    const instance1 = new MainOnlySingleton(1)
    const instance2 = new MainOnlySingleton(2)

    expect(instance1).not.toBe(instance2)
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm run test:preload -- src/__tests__/preload/utils/singleton.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/preload/utils/singleton.test.ts
git commit -m "test: add preload process singleton tests"
```

---

### Task 4: Write renderer process tests

**Files:**

- Create: `src/__tests__/renderer/utils/singleton.test.ts`

- [ ] **Step 1: Write renderer singleton tests (similar to preload)**

```typescript
import { describe, it, expect } from 'vitest'
import { Singleton } from '@/utils/singleton'

describe('Singleton decorator (renderer process)', () => {
  it('should return the same instance for multiple new calls', () => {
    @Singleton()
    class TestClass {
      constructor(public value: string) {}
    }

    const instance1 = new TestClass('first')
    const instance2 = new TestClass('second')

    expect(instance1).toBe(instance2)
  })

  it('should NOT be singleton when renderer is not in the list', () => {
    @Singleton('main')
    class MainOnlySingleton {
      constructor(public value: number) {}
    }

    const instance1 = new MainOnlySingleton(1)
    const instance2 = new MainOnlySingleton(2)

    expect(instance1).not.toBe(instance2)
  })

  it('should be singleton when renderer is in the list', () => {
    @Singleton('main', 'renderer')
    class MainAndRendererSingleton {
      constructor(public value: number) {}
    }

    const instance1 = new MainAndRendererSingleton(1)
    const instance2 = new MainAndRendererSingleton(2)

    expect(instance1).toBe(instance2)
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm run test:renderer -- src/__tests__/renderer/utils/singleton.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/renderer/utils/singleton.test.ts
git commit -m "test: add renderer process singleton tests"
```

---

### Task 5: Run all tests and verify implementation

**Files:**

- Test: All singleton test files

- [ ] **Step 1: Run all singleton tests**

Run: `pnpm run test -- src/__tests__/main/utils/singleton.test.ts src/__tests__/preload/utils/singleton.test.ts src/__tests__/renderer/utils/singleton.test.ts`
Expected: All tests PASS

- [ ] **Step 2: Run full test suite to ensure no regressions**

Run: `pnpm run test`
Expected: All tests PASS

- [ ] **Step 3: Run lint**

Run: `pnpm run lint`
Expected: No errors, possible auto-fixes applied

- [ ] **Step 4: Commit if any fixes needed**

If lint made changes:

```bash
git add -A
git commit -m "chore: apply lint fixes"
```

---

### Task 6: Add documentation

**Files:**

- Modify: No existing files (decorator is self-documenting via code and tests)

- [ ] **Step 1: Add usage example as a comment in singleton.ts**

```typescript
// Usage Example:
// @Singleton()
// class MyService { }
//
// @Singleton('main', 'renderer')
// class SharedService { }
//
// const service1 = new MyService()
// const service2 = new MyService()
// console.log(service1 === service2) // true

type ProcessType = 'main' | 'preload' | 'renderer'
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/singleton.ts
git commit -m "docs: add usage example to singleton decorator"
```

---

## Summary

After completing all tasks, you'll have:

- A fully functional `@Singleton()` decorator
- Comprehensive test coverage across all three process types
- All tests passing
- Code following project conventions (no semicolons, single quotes, etc.)

**Verification commands:**

- `pnpm run test -- src/__tests__/**/singleton.test.ts` - Run all singleton tests
- `pnpm run test` - Run full test suite
- `pnpm run lint` - Verify code style
