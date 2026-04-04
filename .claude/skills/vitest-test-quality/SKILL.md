---
name: Vitest Test Quality
description: Best practices for Vitest test quality, env handling, mock rules, test value evaluation, and type safety in test helpers.
topics: vitest, testing, test-quality, vi.stubEnv, mock-rules, electron, typescript
created: 2026-04-03
updated: 2026-04-03
scratchpad: .specs/scratchpad/a7ac7349.md
---

# Vitest Test Quality

## Overview

Guidelines for maintaining high-value Vitest test suites. Covers environment variable handling, mock placement rules, identifying and eliminating low-value tests, type-safe test helper design, and recommended complementary libraries.

---

## Key Concepts

- **vi.stubEnv leak risk**: `vi.stubEnv()` does NOT auto-reset between tests. Use `unstubEnvs: true` in config or call `vi.unstubAllEnvs()` in afterEach if you use it.
- **Config env vs runtime env**: `test.env` in vitest.config sets persistent env vars at project level. `vi.stubEnv()` overrides at runtime and leaks without cleanup.
- **Mock existence anti-pattern**: Tests that verify mocks have the right shape test the test infrastructure, not production code. Zero bug-finding value.
- **False confidence**: High coverage from shallow tests is worse than no coverage -- it masks real gaps.
- **Type-safe test helpers**: `@ts-expect-error` in test helpers is a code smell. Prefer exposing the needed API on the type or using targeted type assertions.

---

## Documentation & References

| Resource | Description | Link |
|----------|-------------|------|
| Vitest vi API Reference | Official docs for vi.stubEnv, vi.mock, vi.resetModules, etc. | https://vitest.dev/api/vi.html |
| Vitest Mocking Guide | Official mocking best practices and patterns | https://vitest.dev/guide/mocking |
| Vitest Test Environment | Config for environment, env vars, environmentOptions | https://vitest.dev/guide/environment |
| Vitest Config - env | test.env property for persistent environment variables | https://vitest.dev/config/env |
| Vitest Config - unstubEnvs | Auto-reset env stubs before each test via config | https://vitest.dev/config/unstubenvs |
| Vitest vi.mock Discussion | vi.spyOn vs vi.mock best practices (GitHub #4224) | https://github.com/vitest-dev/vitest/discussions/4224 |

---

## Recommended Libraries & Tools

| Name | Purpose | Maturity | Notes |
|------|---------|----------|-------|
| vitest-mock-extended | Type-safe mocks with `calledWith()` argument matching | Stable | Provides `when()`-style API (like Mockito); see https://www.npmjs.com/package/vitest-mock-extended |
| @vitest/coverage-v8 | Code coverage via V8 engine | Stable | Preferred over Istanbul; faster and built-in |
| @vitest/ui | Visual test browser for debugging | Stable | Useful for interactive test exploration |
| @testing-library/react | Component testing for React | Stable | Queries by role/text, not implementation |
| @testing-library/user-event | Simulate real user interactions | Stable | Pairs with testing-library for realistic events |
| msw (Mock Service Worker) | API mocking at network level | Stable | Works across unit and E2E tests |

### vitest-mock-extended (When-Style Mocking)

For argument-specific mock return values (when/thenReturn pattern), use `vitest-mock-extended`:

```typescript
import { mock, mockDeep, mockFn } from 'vitest-mock-extended'

// Type-safe interface mocking
interface PartyProvider {
  getSongs: (type: string) => string[]
}
const provider = mock<PartyProvider>()
provider.getSongs.calledWith('disco').mockReturnValue(['Stayin Alive'])

// Deep mocking for nested objects
const deepMock = mockDeep<MyService>()
deepMock.dao.getUser.calledWith(1).mockResolvedValue({ id: 1, name: 'Test' })

// Standalone typed mock function
type MyFn = (x: number, y: number) => Promise<string>
const fn = mockFn<MyFn>()
fn.calledWith(1, 2).mockResolvedValue('result')
```

Matchers available: `any()`, `anyString()`, `anyNumber()`, `anyObject()`, `anyArray()`, `anyFunction()`, `includes('value')`, `notNull()`, `notEmpty()`, `captor()`.

---

## Patterns & Best Practices

### Environment Variable Handling

**Preferred**: Set env vars in `vitest.config.mts` using the `test.env` property per project:

```typescript
// vitest.config.mts
{
  test: {
    projects: [
      {
        name: 'main',
        env: { PROCESS_TYPE: 'main' },
        // ...
      },
    ],
  },
}
```

**Config-level auto-cleanup** (Vitest 3.x+): Set `unstubEnvs: true` in config to automatically reset all env stubs before each test -- simpler than manual afterEach:

```typescript
// vitest.config.mts
{
  test: {
    unstubEnvs: true,
  },
}
```

**Avoid**: Using `vi.stubEnv()` to set values already in config. It is redundant and creates leak risk.

**If vi.stubEnv is genuinely needed** (e.g., testing different env values in one file) and `unstubEnvs: true` is not configured, always pair with cleanup:

```typescript
afterEach(() => {
  vi.unstubAllEnvs()
})
```

**Key rule**: The setup file's `vi.clearAllMocks()` and `vi.resetModules()` do NOT reset env stubs.

### Mock Placement Rules

| Rule | Rationale |
|------|-----------|
| `vi.mock` in setup files only | Centralized mock management; prevents hoisting surprises |
| Test files import mocks, never create them | Consistent mock instances across all tests |
| `beforeEach` cleanup in setup, not test files | Guaranteed cleanup; tests cannot forget |

### Identifying Low-Value Tests

Delete tests that match these patterns:

| Pattern | Example | Why Delete |
|---------|---------|------------|
| Mock existence | `expect(mockApp.on).toBeDefined()` | Tests mock framework, not production code |
| Export existence | `expect(data.seed).toBeTypeOf('function')` | False confidence; never catches real bugs |
| Implementation duplication | Test reimplements the logic it should verify | Brittle; breaks on refactoring without catching bugs |

**Decision framework for test deletion:**

1. Does this test exercise production code paths? If no, delete.
2. Could a real bug exist that this test would catch? If no, delete.
3. Does the test verify behavior or implementation details? If implementation only, delete or rewrite.
4. Is the maintenance cost proportional to the coverage value? If no, delete.

### Type-Safe Test Helpers

**Problem**: `@ts-expect-error` in test helpers suppresses ALL type errors on a line, hiding real issues.

**Preferred approaches** (in order):

1. **Expose the method on the public type** (best when the method is genuinely public):
   ```typescript
   // types.ts
   export interface ChannelAPI {
     request(method: string, payload?: unknown, timeout?: number): Promise<unknown>
     onRequest(method: string, handler: Handler): void
     setPort(port: Port): void  // Add if it's already public on the class
   }
   ```

2. **Use a test-specific type assertion** (when the API should remain internal):
   ```typescript
   (channel as unknown as { setPort(port: Port): void }).setPort(mockPort)
   ```

3. **Accept `@ts-expect-error` only as last resort** with a clear comment explaining why.

---

## Anti-Patterns to Avoid

| Anti-Pattern | Impact | Fix |
|--------------|--------|-----|
| `vi.stubEnv` without cleanup | State leaks between tests | Use `unstubEnvs: true` in config, or `vi.unstubAllEnvs` in afterEach |
| Testing mocks | Zero bug-finding value | Delete; test production code instead |
| Shallow export checks | False confidence | Test actual behavior or delete |
| `vi.mock` in test files | Violates mock rules; hoisting issues | Move to setup files |
| Logic duplication in tests | Brittle tests that break on refactoring | Test outcomes, not implementation |
| `@ts-expect-error` without comment | Hides future type errors | Always comment, prefer type-safe alternatives |

---

## Common Pitfalls & Solutions

| Issue | Impact | Solution |
|-------|--------|----------|
| Redundant vi.stubEnv when config already sets env | Creates leak risk for no benefit | Remove vi.stubEnv; rely on config |
| Forgetting vi.unstubAllEnvs in afterEach | Tests affect each other's state | Add `unstubEnvs: true` to config, or add to afterEach |
| Testing thin wrapper helpers | Maintenance cost exceeds value | Either test the guard conditions meaningfully or delete both helper and test |
| @ts-expect-error on internal API access | Future type changes go undetected | Expose method on type or use explicit cast |

---

## Recommendations

1. **Prefer config-level env over runtime stubs**: Use `test.env` in vitest.config.mts for stable env vars like PROCESS_TYPE. Add `unstubEnvs: true` for automatic cleanup of any runtime env stubs. Reserve `vi.stubEnv` for tests that specifically need to vary env values.
2. **Delete mock existence tests aggressively**: They provide zero coverage of production code and give false confidence. The mock module itself is tested by virtue of production code tests using it.
3. **Test guard conditions in helpers, not just exports**: If a helper has error guards (e.g., "server not started"), test those guards. A test that only checks `.toBeDefined()` adds no value.
4. **Keep test helpers type-safe**: `@ts-expect-error` in test infrastructure is a debt that accumulates. Fix the underlying type gap rather than suppressing errors.
5. **Audit tests by value, not coverage**: A test suite with 80% coverage from meaningful tests is better than 95% from shallow checks. Delete tests that cost more to maintain than they return.
6. **Use vitest-mock-extended for argument-specific mocks**: When you need different return values based on arguments, use `calledWith().mockReturnValue()` instead of conditional `mockImplementation` for cleaner, type-safe mock setup.

---

## Sources & Verification

| Source | Type | Last Verified |
|--------|------|---------------|
| https://vitest.dev/api/vi.html | Official | 2026-04-03 |
| https://vitest.dev/guide/mocking | Official | 2026-04-03 |
| https://vitest.dev/config/env | Official | 2026-04-03 |
| https://vitest.dev/config/unstubenvs | Official | 2026-04-03 |
| https://github.com/vitest-dev/vitest/discussions/4224 | Community | 2026-04-03 |
| https://www.npmjs.com/package/vitest-mock-extended | Package Registry | 2026-04-03 |

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-04-03 | Added `unstubEnvs` config option to Environment Variable Handling section |
| 2026-04-03 | Added Recommended Libraries & Tools section with vitest-mock-extended |
| 2026-04-03 | Removed project-specific context for reusability |
| 2026-04-03 | Initial creation for task: improve-test-practices |
