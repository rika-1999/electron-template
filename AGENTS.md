# AGENTS.md

## Project Notes

- The default branch in this repo is `main`
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE
- Tests cannot run from repo root; run from project root with `pnpm run test`
- Configuration files use `.mts` extension for ESM compatibility

## What this repo is

Electron 34 + React 18 + TypeScript desktop application with MessagePort-based IPC and comprehensive testing.

## Universal Tooling

- Stack: Electron, React, TypeScript, Vite
- Package Manager: pnpm 9.0.0
- Testing: Vitest (unit) + Playwright (E2E)
- Primary Docs: [README.md](README.md)

## Style Guide (Quick Reference)

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type (use `unknown` and type narrow)
- Rely on type inference when possible; avoid explicit type annotations unless necessary for exports or clarity
- Reduce total variable count by inlining when a value is only used once

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```typescript
obj.a
obj.b
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```typescript
const foo = condition ? 1 : 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```typescript
function foo() {
  if (condition) return 1
  return 2
}
```

### Functional Array Methods

Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference.

*For detailed style rules, see [Code Style](docs/code-style.md)*

## Commands

**IMPORTANT:** `pnpm run dev` is a long-running process that will block the CLI. Do NOT run this command directly. Users should run it themselves if manual testing is needed.

| Command                   | Description                                       |
| ------------------------- | ------------------------------------------------- |
| `pnpm run dev`            | Build dev assets + start Electron with hot reload |
| `pnpm run build`          | Production build (main/preload/renderer)          |
| `pnpm run package:win`    | Build + package for Windows (NSIS x64)            |
| `pnpm run package`        | Build + package for all platforms                 |
| `pnpm run lint -- --fix`  | Auto-fix lint issues                              |
| `pnpm run test`           | Run all unit tests                                |
| `pnpm run test:main`      | Run main process tests                            |
| `pnpm run test:renderer`  | Run renderer process tests                        |
| `pnpm run test:preload`   | Run preload tests                                 |
| `npx vitest run <file>`   | Run single test file                              |
| `pnpm run test:e2e`       | Run Playwright E2E tests                          |
| `pnpm run test:e2e:debug` | Run E2E tests with debugger                       |

## Testing

- Tests cannot run from repo root; run from project root with `pnpm run test`
- Mock rules: `vi.mock` must be in setup files only; test files import mocks from `@/__tests__/infrastructure/mocks/electron`
- Setup files handle singleton cleanup automatically with `vi.resetModules()`
- Use Vitest for unit/integration tests; Playwright for E2E tests

*For detailed testing patterns, see [Testing Patterns](docs/patterns.md)*

## Type Checking

- Run `pnpm run lint -- --fix` before committing
- Lint fixes: `pnpm run lint -- --fix`
- Always run tests from project root, not repo root

## Progressive Disclosure

- [Architecture & Patterns](docs/architecture.md) — Project structure and architectural patterns
- [Code Style](docs/code-style.md) — Naming, formatting, and TypeScript conventions
- [IPC Channel System](docs/channel.md) — MessagePort-based communication design
- [Testing Patterns](docs/patterns.md) — Mock rules and testing strategies
- [Key Singletons](docs/singletons.md) — Singleton instances and usage patterns

## Agent Configuration

- Process type guard: `process.env.PROCESS_TYPE === 'main'/'renderer'`
- Path alias: `@/*` maps to `src/`
- Project-specific skills: `.claude/skills/` (auto-discovered)
