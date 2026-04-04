---
title: Codebase Impact Analysis - Improve Test Code Best Practices
task_file: .specs/tasks/draft/improve-test-practices.feature.md
scratchpad: .specs/scratchpad/f17ed932.md
created: 2026-04-03
status: complete
---

# Codebase Impact Analysis: Improve Test Code Best Practices

## Summary

- **Files to Modify**: 3 files (timeout.test.ts, registry.test.ts, channelHelpers.ts)
- **Files to Delete**: 3 files (electron.test.ts, msw.test.ts, dataHelper.test.ts)
- **Files to Create**: 0 files (conditional: types.ts may need 1-line update if @ts-expect-error removal fails)
- **Test Files Affected**: 4 files (indirectly, via shared channelHelpers)
- **Risk Level**: Low

### Task File Test Count Discrepancy

The task file and DoD contain an incorrect test count. The task states "10 mock existence tests" in the description and "13 tests" in the DoD. The actual count from `electron.test.ts` is **14 `it()` blocks**, not 10. The correct total for deleted tests is **17 (14 + 1 + 2)**, not 13. This discrepancy should be corrected in the task file during implementation.

---

## Files to be Modified/Created

### Primary Changes

```
src/__tests__/
├── infrastructure/
│   ├── mocks/
│   │   └── electron.test.ts              # DELETE: Mock existence tests (115 lines, dead tests)
│   └── helpers/
│       ├── msw.test.ts                   # DELETE: Shallow existence check (24 lines, dead tests)
│       ├── dataHelper.test.ts            # DELETE: Shallow existence check (30 lines, dead tests)
│       └── channelHelpers.ts             # UPDATE: Remove @ts-expect-error on lines 66-67, 70-71
└── main/
    └── services/
        ├── timeout.test.ts               # UPDATE: Remove vi.stubEnv at lines 7, 377, 410, 434
        └── registry.test.ts              # UPDATE: Remove vi.stubEnv at lines 98, 111, 124
```

---

## Useful Resources for Implementation

### Key Configuration File

```
vitest.config.mts                         # Defines env: { PROCESS_TYPE: 'main' } at line 28
                                            making all vi.stubEnv('PROCESS_TYPE', 'main') redundant
```

### Pattern References

```
docs/patterns.md                          # Defines mock rules (lines 181-184):
                                            - vi.mock must be in setup files only
                                            - beforeEach cleanup lives in setup, not test files
                                            - No manual singleton reset needed
```

---

## Key Interfaces & Contracts

### Functions/Methods to Modify

| Location | Name | Current Signature | Change Required |
|----------|------|-------------------|-----------------|
| `src/__tests__/main/services/timeout.test.ts:7` | `vi.stubEnv` in `beforeEach` | `vi.stubEnv('PROCESS_TYPE', 'main')` | Remove entirely |
| `src/__tests__/main/services/timeout.test.ts:377` | `vi.stubEnv` | `vi.stubEnv('PROCESS_TYPE', 'main')` | Remove entirely |
| `src/__tests__/main/services/timeout.test.ts:410` | `vi.stubEnv` | `vi.stubEnv('PROCESS_TYPE', 'main')` | Remove entirely |
| `src/__tests__/main/services/timeout.test.ts:434` | `vi.stubEnv` | `vi.stubEnv('PROCESS_TYPE', 'main')` | Remove entirely |
| `src/__tests__/main/services/registry.test.ts:98` | `vi.stubEnv` | `vi.stubEnv('PROCESS_TYPE', 'main')` | Remove entirely |
| `src/__tests__/main/services/registry.test.ts:111` | `vi.stubEnv` | `vi.stubEnv('PROCESS_TYPE', 'main')` | Remove entirely |
| `src/__tests__/main/services/registry.test.ts:124` | `vi.stubEnv` | `vi.stubEnv('PROCESS_TYPE', 'main')` | Remove entirely |
| `src/__tests__/infrastructure/helpers/channelHelpers.ts:66` | `setPort` call | `// @ts-expect-error` + `mainChannel.setPort(port1 as any)` | Remove suppression; if TS error, add `setPort` to `ChannelAPI` interface or verify compilation |
| `src/__tests__/infrastructure/helpers/channelHelpers.ts:70` | `setPort` call | `// @ts-expect-error` + `rendererChannel.setPort(port2 as any)` | Same as above |

### Types/Interfaces to Update (conditional)

| Location | Name | Fields Affected | Change Required |
|----------|------|-----------------|-----------------|
| `src/shared/channel/types.ts:4` | `ChannelAPI` interface | Add `setPort(port: Port): void` | Only if @ts-expect-error removal fails compilation |

### Classes/Components Affected

| Location | Name | Description | Change Required |
|----------|------|-------------|-----------------|
| `src/shared/channel/index.ts:75` | `Channel.setPort()` | Public method on class, not exposed via `ChannelAPI` interface | May need to add to interface |

---

## Integration Points

Files that interact with affected code and may need updates:

| File | Relationship | Impact | Action Needed |
|------|--------------|--------|---------------|
| `src/__tests__/infrastructure/setup.ts:11` | Sets `vi.resetModules()` in `beforeEach` | Low | Already handles module reset; no change needed. Confirms vi.stubEnv is redundant since `env` config persists through resetModules |
| `src/shared/serviceRegistry/apiDefinitions.ts:93` | Reads `process.env.PROCESS_TYPE` | Low | Uses env var for routing decisions; vitest config already provides this value |
| `vitest.config.mts:28` | Sets `env: { PROCESS_TYPE: 'main' }` | None | This is WHY vi.stubEnv is redundant. No modification needed |
| `src/__tests__/main/channel.test.ts` | Imports `createChannelMock` from channelHelpers (13 usages) | Low | Uses returned Channel objects only, never calls setPort directly. No change needed |
| `src/__tests__/main/viewManagerChannel.test.ts` | Imports `createChannelMock` from channelHelpers (3 usages) | Low | Same as above. No change needed |
| `src/__tests__/main/services/registry.test.ts` | Imports `createChannelMock` from channelHelpers (8 usages) | Low | Same as above. Also subject to vi.stubEnv removal. No change needed for channelHelpers dependency |
| `src/__tests__/main/services/timeout.test.ts` | Imports `createChannelMock` from channelHelpers (16 usages) | Low | Same as above. Also subject to vi.stubEnv removal. No change needed for channelHelpers dependency |
| `src/__tests__/infrastructure/mocks/electron.ts` | Imports `createMockMessageChannel` from channelHelpers (1 usage) | None | Different export (`createMockMessageChannel`, not `createChannelMock`). Not affected by @ts-expect-error changes which are in `createChannelMock`. No change needed |

---

## Detailed Change Analysis

### Change 1: Remove vi.stubEnv calls (AC #1, #6)

**Why safe**: The vitest `env` configuration at `vitest.config.mts:28` sets `PROCESS_TYPE: 'main'` at the process level for the entire 'main' test project. Both `timeout.test.ts` and `registry.test.ts` are included via the pattern `src/__tests__/main/**` (vitest.config.mts:22). The `vi.resetModules()` call in `setup.ts:11` resets the module cache but does NOT clear Vitest's `env` configuration. Therefore, all 7 `vi.stubEnv('PROCESS_TYPE', 'main')` calls set a value that is already in place.

**In timeout.test.ts**:
- Line 7: `vi.stubEnv('PROCESS_TYPE', 'main')` in `beforeEach` -- remove the call entirely
- Line 377: `vi.stubEnv('PROCESS_TYPE', 'main')` inside test "should pass timeout to channel.request for remote calls" -- remove
- Line 410: `vi.stubEnv('PROCESS_TYPE', 'main')` inside test "should pass custom timeout to channel.request" -- remove
- Line 434: `vi.stubEnv('PROCESS_TYPE', 'main')` inside test "should handle channel request timeout correctly" -- remove

**In registry.test.ts**:
- Line 98: inside test "should call local implementation when process type matches" -- remove
- Line 111: inside test "should pass arguments to local implementation" -- remove
- Line 124: inside test "should use specified channel for remote call" -- remove

### Change 2: Delete electron.test.ts (AC #2)

**File**: `src/__tests__/infrastructure/mocks/electron.test.ts` (115 lines)

**Actual test count**: 14 `it()` blocks (NOT 10 as stated in task file). The task file description says "10 mock existence tests" and the DoD says "13 tests (10 + 1 + 2)". The correct count is **17 tests total across all 3 deleted files**: 14 (electron.test.ts) + 1 (msw.test.ts) + 2 (dataHelper.test.ts). The task file should be corrected during implementation.

**Why safe**: This file tests that mock objects (mockApp, mockBaseWindow, etc.) have `vi.fn()` properties. It tests the test infrastructure, not production code. If mocks break, the actual test suites that use them will fail immediately.

**Additional finding**: This file is at `src/__tests__/infrastructure/mocks/` which does NOT match any vitest project include pattern. It is a dead test that is never executed.

### Change 3: Delete or improve msw.test.ts and dataHelper.test.ts (AC #3)

**Files**:
- `src/__tests__/infrastructure/helpers/msw.test.ts` (24 lines)
- `src/__tests__/infrastructure/helpers/dataHelper.test.ts` (30 lines)

**Why safe**: Both are shallow existence checks that only verify exports are defined. Neither tests actual behavior (MSW request handling, data seeding, cleanup). Both are also dead tests -- `src/__tests__/infrastructure/` does not match any vitest project include pattern.

**Recommendation**: Delete both. They provide false confidence. If MSW/data helpers need testing in the future, new tests with real behavioral coverage should be written and placed in a vitest project include path.

### Change 4: Fix @ts-expect-error in channelHelpers.ts (AC #4)

**File**: `src/__tests__/infrastructure/helpers/channelHelpers.ts:66-67, 70-71`

**Current code**:
```typescript
// @ts-expect-error - setPort is public API, but TypeScript types don't expose it
mainChannel.setPort(port1 as any)
```

**Analysis**:
- `Channel.setPort()` at `src/shared/channel/index.ts:75` is a public method (no `private` keyword)
- The return type of `createChannelMock()` is `{ mainChannel: Channel, rendererChannel: Channel }` (line 58-59)
- `Channel` class has `setPort` as a public method
- The `@ts-expect-error` comment says "TypeScript types don't expose it" but the return type IS `Channel`, not `ChannelAPI`
- The project uses Vite (not tsc directly) for type checking at build/test time; `tsconfig.json:21` excludes `*.test.ts` files from tsc

**Resolution**: The `@ts-expect-error` directives are currently suppressing actual TypeScript errors. Whether they are strictly necessary depends on the compiler's type resolution of `Channel` -- the method IS public on the class, but Vite's plugin-based type resolution may differ from standalone `tsc`. The recommended approach is a two-step verification:

1. **First, try removing both `@ts-expect-error` directives** and run `npx vitest run`. If compilation and all tests pass, the suppressions were unnecessary and the cleanup is done.
2. **If Vite reports a type error after removal**, add `setPort(port: Port): void` to the `ChannelAPI` interface at `src/shared/channel/types.ts:4-9`. This formally exposes the method (which is already public on the class) and makes the call type-safe.

The `as any` cast on the port argument (`port1 as any`) is a separate concern -- it should also be removed and replaced with proper typing once `setPort` is accessible without suppression.

---

## Similar Implementations

### Pattern: Dead test identification
- **Location**: `vitest.config.mts:15-52` (project include patterns)
- **Why relevant**: The `include` patterns define which test files actually run. Files outside these patterns are dead code.
- **Lesson**: When adding test infrastructure tests, ensure they are included in a vitest project.

### Pattern: Mock rules enforcement
- **Location**: `docs/patterns.md:180-184`
- **Why relevant**: Defines that `vi.mock` must be in setup files only, and `beforeEach` cleanup lives in setup. The vi.stubEnv removal aligns with this principle (keep setup concerns out of test files).

---

## Test Coverage

### Existing Tests to Verify After Changes

| Test File | What to Verify | How |
|-----------|----------------|-----|
| `src/__tests__/main/services/timeout.test.ts` | All 14+ tests still pass without vi.stubEnv | `npx vitest run src/__tests__/main/services/timeout.test.ts` |
| `src/__tests__/main/services/registry.test.ts` | All tests still pass without vi.stubEnv | `npx vitest run src/__tests__/main/services/registry.test.ts` |
| `src/__tests__/main/channel.test.ts` | Still passes (depends on channelHelpers) | `npx vitest run src/__tests__/main/channel.test.ts` |
| `src/__tests__/main/viewManagerChannel.test.ts` | Still passes (depends on channelHelpers) | `npx vitest run src/__tests__/main/viewManagerChannel.test.ts` |

### No New Tests Needed
This task is purely cleanup -- removing redundant code and dead tests. No new test coverage is introduced.

---

## Risk Assessment

### Low Risk Areas

| Area | Risk | Mitigation |
|------|------|------------|
| vi.stubEnv removal | Tests might fail if PROCESS_TYPE is not actually set | Already verified: vitest.config.mts:28 sets `env: { PROCESS_TYPE: 'main' }` for the main project |
| electron.test.ts deletion | Something might depend on it | No imports found; dead test (not in any include pattern) |
| msw/dataHelper test deletion | Loss of coverage | Zero behavioral coverage exists to lose; tests are existence checks only |

### Medium Risk Areas

| Area | Risk | Mitigation |
|------|------|------------|
| @ts-expect-error removal | TypeScript compilation might fail | Run `tsc --noEmit` after removal. If it fails, add `setPort` to `ChannelAPI` interface |
| Adding setPort to ChannelAPI | Exposes internal API to consumers | `setPort` is already public on the class; interface change only makes it formally visible. Verify no unintended external usage |

---

## Recommended Exploration

Before implementation, developer should read:

1. `vitest.config.mts` -- Understand how `env` config makes `vi.stubEnv` redundant (line 28)
2. `src/shared/channel/types.ts` -- The `ChannelAPI` interface that may need `setPort` added (lines 4-9)
3. `src/shared/channel/index.ts:75` -- The `setPort` method definition to confirm it is public
4. `docs/patterns.md:180-184` -- Mock rules that guide the cleanup philosophy

---

## Verification Summary

| Check | Status | Notes |
|-------|--------|-------|
| All affected files identified | Done | 3 modify (timeout.test.ts, registry.test.ts, channelHelpers.ts), 3 delete |
| Integration points mapped | Done | 4 downstream test files + 1 mock source file consume channelHelpers exports; all unaffected |
| Similar patterns found | Done | Mock rules in docs/patterns.md, vitest env config pattern |
| Test coverage analyzed | Done | 3 files are dead tests (not in any include pattern); 2 files have redundant stubEnv |
| Risks assessed | Done | Low overall; medium only for @ts-expect-error TypeScript verification |
| Task file discrepancy flagged | Done | Task says "10 tests" but electron.test.ts has 14 `it()` blocks; correct total is 17 (14+1+2), not 13 |

Limitations/Caveats: The @ts-expect-error removal needs Vite compilation verification (tsc cannot check due to @/ alias resolution). The method IS public on the Channel class, but the suppression may be needed due to Vite's type resolution of inline `import()` types. Developer should remove @ts-expect-error, then run `npx vitest run` -- if it passes, done; if type error, add `setPort` to `ChannelAPI` interface at `src/shared/channel/types.ts`. The task file contains a test count error (10 vs 14) that should be corrected during implementation.
