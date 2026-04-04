---
title: "Improve Test Code Best Practices"
type: feature
depends_on: []
---

# Improve Test Code Best Practices

# Initial User Prompt

> **Required Skill**: You MUST use and analyse `vitest-test-quality` skill before doing any modification to task file or starting implementation of it!
>
> Skill location: `.claude/skills/vitest-test-quality/SKILL.md`

Fix identified test code quality issues to align with Vitest best practices and the project's own mock rules defined in docs/patterns.md.

# Description

The test suite contains several quality issues that violate the project's own documented mock rules (docs/patterns.md) and undermine developer trust in test results. Specifically: (1) `vi.stubEnv('PROCESS_TYPE', 'main')` calls in timeout.test.ts and registry.test.ts are redundant because vitest.config.mts already sets PROCESS_TYPE per project, and they risk leaking state between tests; (2) electron.test.ts contains 14 tests that only verify mock objects are functions -- something structurally guaranteed by Vitest's `vi.fn()` with zero coverage value; (3) msw.test.ts and dataHelper.test.ts verify only that exports exist, not that they work; (4) channelHelpers.ts uses `@ts-expect-error` to bypass a type system gap where `Channel.setPort()` is public in implementation but not in the ChannelAPI type.

This cleanup is needed to align test practices with documented standards, eliminate false confidence from low-value tests, and improve type safety in test helpers. Developers maintaining this codebase benefit from a test suite that models good practices and provides meaningful coverage metrics rather than inflated numbers from existence-only tests.

**Scope**:
- Included:
  - Removal of redundant environment variable stubs from timeout.test.ts and registry.test.ts
  - Deletion of mock existence test file (electron.test.ts, 14 tests)
  - Deletion of shallow export verification test files (msw.test.ts, 1 test; dataHelper.test.ts, 2 tests)
  - Resolution of type suppression directives in test helper (channelHelpers.ts)
  - Verification that all remaining tests pass
- Excluded:
  - Adding new test coverage
  - Changing test framework configuration
  - Modifying production code behavior
  - Changing test setup files
  - E2E test modifications

**User Scenarios**:
1. **Primary Flow**: Developer removes redundant env stubs, deletes low-value test files, resolves the type gap in the test helper, runs the test suite, and all tests pass.
2. **Alternative Flow**: If resolving the type gap requires changes that affect the public API surface, a more targeted approach (e.g., test-only type) is used to limit impact.
3. **Error Handling**: If removing env stubs causes any test to fail, the root cause is investigated rather than reverting the removal.

---

## Acceptance Criteria

### Functional Requirements

- [ ] **FR-1: No vi.stubEnv in test files**: All `vi.stubEnv('PROCESS_TYPE', 'main')` calls are removed from timeout.test.ts and registry.test.ts
  - Given: timeout.test.ts and registry.test.ts currently contain 7 vi.stubEnv calls
  - When: All vi.stubEnv calls are removed from these files
  - Then: Searching for `vi.stubEnv` across all files in `src/__tests__/` returns zero occurrences

- [ ] **FR-2: electron.test.ts deleted**: The mock existence test file is removed from the codebase
  - Given: electron.test.ts contains 14 tests that verify mock object structure only
  - When: The file src/__tests__/infrastructure/mocks/electron.test.ts is deleted
  - Then: The file does not exist on disk and no other test imports from it

- [ ] **FR-3: msw.test.ts deleted**: The shallow MSW existence test file is removed from the codebase
  - Given: msw.test.ts contains 1 test that only verifies function exports exist
  - When: The file src/__tests__/infrastructure/helpers/msw.test.ts is deleted
  - Then: The file does not exist on disk and no other test imports from it

- [ ] **FR-4: dataHelper.test.ts deleted**: The shallow data helper existence test file is removed from the codebase
  - Given: dataHelper.test.ts contains 2 tests that only verify exports exist
  - When: The file src/__tests__/infrastructure/helpers/dataHelper.test.ts is deleted
  - Then: The file does not exist on disk and no other test imports from it

- [ ] **FR-5: No @ts-expect-error in channelHelpers.ts**: The type suppression directives are eliminated so that the code is type-safe without suppressions
  - Given: channelHelpers.ts contains 2 `@ts-expect-error` directives when calling `setPort()` on Channel instances
  - When: The underlying type gap is resolved appropriately
  - Then: Searching for `@ts-expect-error` in channelHelpers.ts returns zero occurrences, and TypeScript compilation produces no errors related to `setPort` access

- [ ] **FR-6: All tests pass**: No regressions are introduced by the cleanup changes
  - Given: All changes from FR-1 through FR-5 have been applied
  - When: The test suite is executed via `pnpm run test`
  - Then: Exit code is 0 and all remaining tests pass without errors

### Non-Functional Requirements

- [ ] **Type Safety**: Resolving `@ts-expect-error` must maintain or improve type checking. No new `any` casts should be introduced without proper type narrowing.
- [ ] **Performance**: Test suite execution time must not exceed baseline of 15.61s / 103 tests (measured 2026-04-03). Expected decrease from 17 fewer tests.
- [ ] **Compatibility**: Changes must work with the existing Vitest project configuration (per-project PROCESS_TYPE env setting).

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] No `vi.stubEnv` calls remain in any test file
- [ ] No `@ts-expect-error` directives remain in channelHelpers.ts
- [ ] Test count reduced by 17 tests (14 + 1 + 2) from deleted files
- [ ] All remaining tests pass with exit code 0
- [ ] TypeScript compilation succeeds with no type errors

---

## Architecture Blueprint

**Scratchpad**: .specs/scratchpad/015824ce.md
**Analysis**: .specs/analysis/analysis-improve-test-practices.md
**Skill**: .claude/skills/vitest-test-quality/SKILL.md

### Solution Strategy

**Approach**: Systematic removal of dead tests, redundant env stubs, and type suppressions following a phased verification strategy. Each phase is independently verifiable.

**Key Decisions**:
1. **Type assertion only -- no ChannelAPI update**: The `createChannelMock()` function returns `Channel` class instances which have `setPort()` as a public method. If removing `@ts-expect-error` surfaces a type error, use a targeted type assertion `(channel as unknown as { setPort(port: import('@/shared/channel/impl').Port): void }).setPort(...)` in the test helper only. The `ChannelAPI` interface is NOT modified because `setPort` is only used by test code (user directive).
2. **Replace `as any` with `as unknown as import('@/shared/channel/impl').Port`**: Code style prohibits `any`. Mock ports need a type assertion since they don't structurally match `MessagePortMain | MessagePort`. The `Port` type is defined in `src/shared/channel/impl.ts:6` and is NOT re-exported from the barrel (`src/shared/channel/index.ts` imports it as `PortType` internally), so `import('@/shared/channel/impl').Port` is the canonical inline import type reference.
3. **Delete dead tests without replacement**: All 3 files (17 tests) are outside vitest include patterns and provide zero behavioral coverage.

**Trade-offs Accepted**:
- **No ChannelAPI update**: If `setPort` access causes a type error after removing `@ts-expect-error`, a targeted type assertion will be used instead of the cleaner interface fix. This is slightly more verbose but respects the principle that the shared type should not expose a test-only method.
- **Test count reduction**: 17 fewer tests (16.5% reduction) for higher test quality. Deleted tests contributed to false confidence, not real coverage.
- **Port type assertion**: `as unknown as import('@/shared/channel/impl').Port` is a necessary type assertion in test infrastructure. Mock objects cannot structurally satisfy real Electron/browser port types.
- **`unstubEnvs` config not included**: The vitest-test-quality skill recommends adding `unstubEnvs: true` to vitest.config.mts for automatic env stub cleanup. This is out-of-scope for this task (excluded: "Changing test framework configuration") but should be considered as a future improvement.

---

### Expected Changes

```
src/__tests__/
  infrastructure/
    mocks/
      electron.test.ts              # DELETE: Mock existence tests (14 dead tests)
    helpers/
      msw.test.ts                   # DELETE: Shallow existence check (1 dead test)
      dataHelper.test.ts            # DELETE: Shallow existence check (2 dead tests)
      channelHelpers.ts             # UPDATE: Remove @ts-expect-error, fix type assertions
  main/
    services/
      timeout.test.ts               # UPDATE: Remove 4 vi.stubEnv calls
      registry.test.ts              # UPDATE: Remove 3 vi.stubEnv calls
```

---

### Architecture Decomposition

**Components**:

| Component | Responsibility | Change |
|-----------|---------------|--------|
| timeout.test.ts | Service registry timeout tests | Remove 4 `vi.stubEnv` calls (lines 7, 377, 410, 434) |
| registry.test.ts | Service registration, invocation, routing tests | Remove 3 `vi.stubEnv` calls (lines 98, 111, 124) |
| channelHelpers.ts | Test helper for mock Channel pairs | Remove 2 `@ts-expect-error` comments (lines 66, 70), replace 2 `as any` with `as unknown as import('@/shared/channel/impl').Port` (lines 67, 71). If type error on `setPort`, use targeted type assertion -- do NOT modify ChannelAPI |
| electron.test.ts (DELETE) | Dead mock verification (14 tests) | Not in any vitest include pattern |
| msw.test.ts (DELETE) | Dead MSW existence check (1 test) | Not in any vitest include pattern |
| dataHelper.test.ts (DELETE) | Dead dataHelper existence check (2 tests) | Not in any vitest include pattern |

**Integration impact**: Zero impact from deletions (no imports from deleted files). Zero impact from vi.stubEnv removal (vitest.config.mts already sets PROCESS_TYPE). channelHelpers changes are internal -- 4 consumer files use returned Channel objects without calling setPort. No shared type (`ChannelAPI`) changes.

---

### Architecture Decisions

#### @ts-expect-error Resolution Strategy

**Status**: Accepted

**Context**: channelHelpers.ts uses `@ts-expect-error` to call `Channel.setPort()`, a public method not on the `ChannelAPI` interface. The user has directed that `ChannelAPI` must NOT be updated because `setPort` is only used by test code.

**Options**:
1. Add `setPort` to `ChannelAPI` interface -- REJECTED by user directive (setPort is test-only)
2. Use targeted type assertion in test helper only (avoids interface change)
3. Keep `@ts-expect-error` with improved comment -- fails FR-5

**Decision**: Remove `@ts-expect-error` first. The `createChannelMock()` return type is `Channel` (the class), which has `setPort()` as a public method, so the call should work without any assertion. If a type error surfaces, use a targeted type assertion `(channel as unknown as { setPort(port: import('@/shared/channel/impl').Port): void }).setPort(...)` in the test helper only. Do NOT modify `ChannelAPI`.

**Consequences**:
- No changes to shared type definitions
- If type assertion is needed, it adds slight verbosity to channelHelpers.ts
- `ChannelAPI` remains the consumer-facing contract without test-only methods

---

### Workflow Steps

```
Phase 1: Delete Dead Files --> Phase 2: Remove vi.stubEnv --> Phase 3: Fix @ts-expect-error --> Phase 4: Verify
       |                              |                              |                              |
       v                              v                              v                              v
  3 files deleted               7 calls removed              2 suppressions removed        Full suite passes
  (17 dead tests)               from 2 files                 from channelHelpers.ts        No type errors
```

**Phase 1 -- Delete Dead Test Files** (zero risk):
- Delete `src/__tests__/infrastructure/mocks/electron.test.ts`
- Delete `src/__tests__/infrastructure/helpers/msw.test.ts`
- Delete `src/__tests__/infrastructure/helpers/dataHelper.test.ts`
- Verify: `pnpm run test` (files are outside vitest include patterns)

**Phase 2 -- Remove Redundant vi.stubEnv Calls** (low risk):
- Edit `timeout.test.ts`: remove `vi.stubEnv('PROCESS_TYPE', 'main')` at lines 7, 377, 410, 434
- Edit `registry.test.ts`: remove `vi.stubEnv('PROCESS_TYPE', 'main')` at lines 98, 111, 124
- Verify: `npx vitest run src/__tests__/main/services/`

**Phase 3 -- Resolve @ts-expect-error** (medium risk):
- Edit `channelHelpers.ts`: remove `@ts-expect-error` comments (lines 66, 70), replace `port1 as any` and `port2 as any` with `as unknown as import('@/shared/channel/impl').Port`
- Verify: `npx vitest run`. If type error on `setPort` access, use targeted type assertion `(channel as unknown as { setPort(port: import('@/shared/channel/impl').Port): void }).setPort(...)`. Do NOT modify `ChannelAPI` interface.
- Verify consumer tests: `npx vitest run src/__tests__/main/`

**Phase 4 -- Final Verification**:
- Full suite: `pnpm run test` (exit code 0)
- No vi.stubEnv: `grep -r "vi.stubEnv" src/__tests__/` returns nothing
- No @ts-expect-error: `grep "@ts-expect-error" src/__tests__/infrastructure/helpers/channelHelpers.ts` returns nothing
- Type check: `npx tsc --noEmit`
- Expected test count: 86 (103 - 17)

---

## Implementation Process

You MUST launch for each step a separate agent, instead of performing all steps yourself. And for each step marked as parallel, you MUST launch separate agents in parallel.

**CRITICAL:** For each agent you MUST:
1. Use the **Agent** type specified in the step (e.g., `haiku`, `sonnet`, `opus`)
2. Provide path to task file and prompt which step to implement
3. Require agent to implement exactly that step, not more, not less, not other steps

**Sub-agent prompt template:**
```
Read task file at {task_file_path} and implement only Step {N}: {Step Title}. Do not implement any other steps. Follow the step's success criteria exactly.
```

**Example:**
```
Read task file at .specs/tasks/todo/improve-test-practices.feature.md and implement only Step 2: Remove Redundant vi.stubEnv Calls. Do not implement any other steps. Follow the step's success criteria exactly.
```

### Parallelization Overview

```
   +----------------+  +----------------+  +--------------------------------+
   | Step 1         |  | Step 2         |  | Step 3                         |
   | Delete Dead    |  | Remove         |  | Fix @ts-expect-error           |
   | Test Files     |  | vi.stubEnv     |  | + conditional type             |
   | [haiku]        |  | Calls          |  | assertion if needed            |
   |                |  | [opus]         |  | [opus]                         |
   +-------+--------+  +-------+--------+  +---------------+----------------+
           |                    |                           |
           |    PARALLEL        |   PARALLEL                |
           +-------+--------+--+-----------+---------------+
                   |        |              |
                   v        v              v
                    +-------------+
                    | Step 4      |
                    | Final       |
                    | Verification|
                    | [haiku]     |
                    +-------------+
```

Steps 1, 2, and 3 have ZERO file overlap and ZERO mutual dependencies. They MUST be executed in parallel.

---

### Step 1: Delete Dead Test Files

**Model:** haiku
**Agent:** haiku
**Depends on:** None
**Parallel with:** Step 2, Step 3

**Goal**: Remove 3 test files that are never executed by Vitest (outside all include patterns) and provide zero behavioral coverage.

#### Expected Output

- Deleted: `src/__tests__/infrastructure/mocks/electron.test.ts` (14 mock existence tests)
- Deleted: `src/__tests__/infrastructure/helpers/msw.test.ts` (1 shallow existence test)
- Deleted: `src/__tests__/infrastructure/helpers/dataHelper.test.ts` (2 shallow existence tests)

#### Success Criteria

- [ ] File `src/__tests__/infrastructure/mocks/electron.test.ts` does not exist on disk
- [ ] File `src/__tests__/infrastructure/helpers/msw.test.ts` does not exist on disk
- [ ] File `src/__tests__/infrastructure/helpers/dataHelper.test.ts` does not exist on disk
- [ ] No other file imports from any of these deleted files
- [ ] `pnpm run test` exits with code 0

#### Verification

**Level:** NOT NEEDED
**Rationale:** File deletion is a binary operation. Success is confirmed by file non-existence on disk and `pnpm run test` exit code 0. No subjective judgment required.

#### Subtasks

| Sub-task | Description | Agent | Can Parallel |
|----------|-------------|-------|--------------|
| 1a | Delete `src/__tests__/infrastructure/mocks/electron.test.ts` | haiku | Yes |
| 1b | Delete `src/__tests__/infrastructure/helpers/msw.test.ts` | haiku | Yes |
| 1c | Delete `src/__tests__/infrastructure/helpers/dataHelper.test.ts` | haiku | Yes |
| 1d | Run `pnpm run test` and verify exit code 0 | haiku | No (waits for 1a-1c) |

**Note:** Subtasks 1a, 1b, 1c MUST be done in parallel by multiple agents.

---

### Step 2: Remove Redundant vi.stubEnv Calls

**Model:** opus
**Agent:** opus
**Depends on:** None
**Parallel with:** Step 1, Step 3

**Goal**: Remove 7 `vi.stubEnv('PROCESS_TYPE', 'main')` calls from 2 test files. These are redundant because `vitest.config.mts` line 28 already sets `env: { PROCESS_TYPE: 'main' }` for the 'main' project, and `vi.resetModules()` in setup does NOT clear vitest env configuration.

#### Expected Output

- Modified: `src/__tests__/main/services/timeout.test.ts` -- 4 `vi.stubEnv` calls removed
- Modified: `src/__tests__/main/services/registry.test.ts` -- 3 `vi.stubEnv` calls removed

#### Success Criteria

- [ ] `grep -r "vi.stubEnv" src/__tests__/` returns no output
- [ ] `npx vitest run src/__tests__/main/services/` exits with code 0
- [ ] All tests in timeout.test.ts pass (timers, timeouts, service registry)
- [ ] All tests in registry.test.ts pass (API proxy, service invocation, routing)

#### Verification

**Level:** Per-File Judges (2 separate evaluations in parallel)
**Artifacts:** `src/__tests__/main/services/timeout.test.ts`, `src/__tests__/main/services/registry.test.ts`
**Threshold:** 4.0/5.0

**Rubric (per file):**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Contextual Coherence | 0.30 | Test logic flows correctly after stub removal; no tests implicitly relied on `vi.stubEnv` call ordering or side effects for their correctness |
| Surrounding Code Preservation | 0.30 | No unrelated code was modified or accidentally deleted during the vi.stubEnv removal; no leftover comments referencing removed stubs, no orphaned imports or variables introduced by the removal |
| Test Integrity | 0.25 | Test structure (describe blocks, test cases, assertions) remains intact and logically coherent after removals |
| Completeness of Removal | 0.15 | All `vi.stubEnv('PROCESS_TYPE', 'main')` calls are removed from the file with no residual references |

#### Subtasks

| Sub-task | Description | Agent | Can Parallel |
|----------|-------------|-------|--------------|
| 2a | Remove 4 `vi.stubEnv` calls from `src/__tests__/main/services/timeout.test.ts` (lines 7, 377, 410, 434) | opus | Yes |
| 2b | Remove 3 `vi.stubEnv` calls from `src/__tests__/main/services/registry.test.ts` (lines 98, 111, 124) | opus | Yes |
| 2c | Run `npx vitest run src/__tests__/main/services/` and verify all tests pass | opus | No (waits for 2a, 2b) |

**Note:** Subtasks 2a and 2b MUST be done in parallel by multiple agents (they edit different files).

---

### Step 3: Resolve @ts-expect-error in channelHelpers.ts

**Model:** opus
**Agent:** opus
**Depends on:** None
**Parallel with:** Step 1, Step 2

**Goal**: Remove 2 `@ts-expect-error` directives and replace 2 `as any` casts with proper type assertions in the test helper. If removing `@ts-expect-error` surfaces a type error on `setPort` access, use a targeted type assertion in the test helper. Do NOT modify the `ChannelAPI` interface -- `setPort` is only used by test code (user directive).

#### Expected Output

- Modified: `src/__tests__/infrastructure/helpers/channelHelpers.ts` -- 2 `@ts-expect-error` comments removed, 2 `as any` replaced with `as unknown as import('@/shared/channel/impl').Port` (or targeted type assertion if needed)

#### Success Criteria

- [ ] `grep "@ts-expect-error" src/__tests__/infrastructure/helpers/channelHelpers.ts` returns no output
- [ ] No `as any` on setPort call sites in channelHelpers.ts lines 67 and 71 (replaced with `as unknown as import('@/shared/channel/impl').Port`)
- [ ] `npx vitest run` exits with code 0 (no type errors)
- [ ] All consumer tests pass: `npx vitest run src/__tests__/main/`

#### Verification

**Level:** CRITICAL - Panel of 2 Judges with Aggregated Voting
**Artifacts:** `src/__tests__/infrastructure/helpers/channelHelpers.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Type Assertion Correctness | 0.30 | `as any` at setPort call sites (lines 67, 71) is replaced with `as unknown as import('@/shared/channel/impl').Port` -- the double assertion pattern is correctly applied and targets the right import path |
| @ts-expect-error Elimination | 0.25 | Both `@ts-expect-error` directives are fully removed with no remaining suppressions in channelHelpers.ts |
| Consumer Impact Neutrality | 0.20 | No consumer of channelHelpers.ts is broken -- the 4 consumer test files continue to work without modification |
| No `any` Introduction | 0.15 | No new `any` type was introduced at the setPort call sites; the replacement uses proper type narrowing via `unknown` intermediate (note: `lastMessage: undefined as any` at lines 18 and 31 in `createMockMessageChannel()` is intentionally out of scope) |
| No Shared Interface Changes | 0.10 | `ChannelAPI` interface at `src/shared/channel/types.ts` is NOT modified -- type gap is resolved in test helper only |

**Reference Pattern:** `src/shared/channel/impl.ts` (Port type at line 6), `src/shared/channel/index.ts` (Channel class setPort at line 75)

#### Subtasks

- [ ] Remove `// @ts-expect-error - setPort is public API, but TypeScript types don't expose it` from `src/__tests__/infrastructure/helpers/channelHelpers.ts` line 66
- [ ] Replace `mainChannel.setPort(port1 as any)` with `mainChannel.setPort(port1 as unknown as import('@/shared/channel/impl').Port)` at line 67
- [ ] Remove `// @ts-expect-error - setPort is public API, but TypeScript types don't expose it` from line 70
- [ ] Replace `rendererChannel.setPort(port2 as any)` with `rendererChannel.setPort(port2 as unknown as import('@/shared/channel/impl').Port)` at line 71
- [ ] Run `npx vitest run` and check for type errors
- [ ] IF a type error surfaces on `setPort` access: use targeted type assertion `(mainChannel as unknown as { setPort(port: import('@/shared/channel/impl').Port): void }).setPort(port1 as unknown as import('@/shared/channel/impl').Port)` (and similarly for rendererChannel). Do NOT modify `ChannelAPI` interface.
- [ ] Run `npx vitest run src/__tests__/main/` to verify all consumer tests pass

#### Risks

Medium. Removing `@ts-expect-error` may surface a TypeScript error on `setPort` access. The `Channel` class at `src/shared/channel/index.ts:75` has `setPort` as a public method, and the `createChannelMock()` return type uses the class type `Channel` (not the `ChannelAPI` interface), so the call should work. If Vite's type resolution differs and a type error surfaces, use a targeted type assertion in the test helper. The `ChannelAPI` interface must NOT be modified. Mitigation: the agent handles both the removal and the conditional type assertion atomically.

#### Definition of Done

- [ ] No `@ts-expect-error` in channelHelpers.ts
- [ ] No `as any` on setPort call sites in channelHelpers.ts (lines 67, 71)
- [ ] `npx vitest run` passes with no type errors
- [ ] All consumer tests pass

---

### Step 4: Final Verification

**Model:** haiku
**Agent:** haiku
**Depends on:** Step 1, Step 2, Step 3
**Parallel with:** None

**Goal**: Confirm all acceptance criteria (FR-1 through FR-6) are met after all changes.

#### Expected Output

- All remaining tests pass
- No `vi.stubEnv` in any test file
- No `@ts-expect-error` in channelHelpers.ts
- Test count reduced by 17

#### Success Criteria

- [ ] `pnpm run test` exits with code 0
- [ ] `grep -r "vi.stubEnv" src/__tests__/` returns no output (FR-1)
- [ ] File `src/__tests__/infrastructure/mocks/electron.test.ts` does not exist (FR-2)
- [ ] File `src/__tests__/infrastructure/helpers/msw.test.ts` does not exist (FR-3)
- [ ] File `src/__tests__/infrastructure/helpers/dataHelper.test.ts` does not exist (FR-4)
- [ ] `grep "@ts-expect-error" src/__tests__/infrastructure/helpers/channelHelpers.ts` returns no output (FR-5)
- [ ] Test count is approximately 86 (103 - 17) (NFR: Performance)
- [ ] TypeScript compilation produces no errors related to `setPort` access (FR-5, NFR: Type Safety)

#### Verification

**Level:** NOT NEEDED
**Rationale:** Binary verification -- grep commands either return output or they do not, `pnpm run test` either exits with code 0 or it does not. No subjective judgment required. All checks are pass/fail with objective criteria.

#### Subtasks

- [ ] Run `pnpm run test` and verify exit code 0 (FR-6)
- [ ] Run `grep -r "vi.stubEnv" src/__tests__/` and verify no output (FR-1)
- [ ] Run `grep "@ts-expect-error" src/__tests__/infrastructure/helpers/channelHelpers.ts` and verify no output (FR-5)
- [ ] Verify test count is approximately 86 (103 original - 17 deleted)
- [ ] Run TypeScript type check to verify no type errors

#### Definition of Done

- [ ] All acceptance criteria verified
- [ ] Full test suite passes
- [ ] All grep checks clean

---

## Implementation Summary

| Step | Goal | Output | Est. Effort | Agent |
|------|------|--------|-------------|-------|
| 1 | Delete 3 dead test files | 17 tests removed, 3 files deleted | S | haiku |
| 2 | Remove 7 redundant `vi.stubEnv` calls | 2 files cleaned of env stubs | S | opus |
| 3 | Resolve `@ts-expect-error` (type assertion only) | Type-safe test helper | M | opus |
| 4 | Final verification | All acceptance criteria confirmed | S | haiku |

**Total Steps**: 4
**Critical Path**: Steps 1, 2, 3 (parallel) -> Step 4
**Max Parallelization Depth**: 3 steps simultaneously (Steps 1, 2, 3)

---

## Verification Summary

| Step | Verification Level | Judges | Threshold | Artifacts |
|------|-------------------|--------|-----------|-----------|
| 1 | None | - | - | 3 deleted test files |
| 2 | Per-File (2) | 2 | 4.0/5.0 | timeout.test.ts, registry.test.ts |
| 3 | Panel (2) | 2 | 4.0/5.0 | channelHelpers.ts |
| 4 | None | - | - | Binary grep/test checks |

**Total Evaluations:** 4 judge runs: 2 per-file judges (Step 2) + 2 panel judges (Step 3)
**Implementation Command:** `/implement .specs/tasks/todo/improve-test-practices.feature.md`

---

## Risks & Blockers Summary

### High Priority

None.

### Medium Priority

| Risk/Blocker | Impact | Likelihood | Mitigation |
|--------------|--------|------------|------------|
| `@ts-expect-error` removal causes type error | Step 3 needs type assertion | Medium | Agent uses targeted type assertion `(channel as unknown as { setPort(...): void }).setPort(...)` as part of same step. ChannelAPI is NOT modified. |

### Low Priority

| Risk/Blocker | Impact | Likelihood | Mitigation |
|--------------|--------|------------|------------|
| `vi.stubEnv` removal causes test failure | Step 2 blocked | Low | Verify `vitest.config.mts:28` already sets `PROCESS_TYPE: 'main'` |

---

## Definition of Done (Task Level)

- [x] All implementation steps completed
- [x] All acceptance criteria (FR-1 through FR-6) verified
- [x] No `vi.stubEnv` calls remain in any test file
- [x] No `@ts-expect-error` directives remain in channelHelpers.ts
- [x] Test count reduced by 17 tests (14 + 1 + 2) from deleted files (NOTE: deleted files were outside vitest include patterns so were never counted — vitest still shows 103; the 17 tests are confirmed deleted from disk)
- [x] All remaining tests pass with exit code 0
- [x] TypeScript compilation succeeds with no type errors (vitest confirms zero type errors; tsc --noEmit has pre-existing dist/ artifact issue unrelated to changes)
- [x] No `any` casts introduced without proper type narrowing
