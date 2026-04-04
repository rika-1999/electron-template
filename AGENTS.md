# AGENTS.md

## What this repo is

Electron 34 + React 18 + TypeScript desktop application with MessagePort-based IPC and comprehensive testing.

## Universal Tooling

- Stack: Electron, React, TypeScript, Vite
- Package Manager: pnpm 9.0.0
- Testing: Vitest (unit) + Playwright (E2E)
- Primary Docs: [README.md](README.md)

## Commands

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

## Key Singletons

| Singleton         | Location                      | Purpose                                  |
| ----------------- | ----------------------------- | ---------------------------------------- |
| `viewManager`     | `src/main/viewManager/`       | Manages all `WebContentsView` instances  |
| `windowManager`   | `src/main/windowManager/`     | Manages all `BrowserWindow` instances    |
| `channel`         | `src/shared/channel.ts`       | Default IPC channel (MessageChannelMain) |
| `serviceRegistry` | `src/shared/serviceRegistry/` | Service registration, routing & timeouts |

## Progressive Disclosure

- [Architecture & Patterns](docs/architecture.md) — Project structure and architectural patterns
- [Code Style](docs/code-style.md) — Naming, formatting, and TypeScript conventions
- [IPC Channel System](docs/channel.md) — MessagePort-based communication design
- [Testing Patterns](docs/patterns.md) — Mock rules and testing strategies

## Agent Configuration

- Process type guard: `process.env.PROCESS_TYPE === 'main'/'renderer'`
- Path alias: `@/*` maps to `src/`
- Project-specific skills: `.claude/skills/` (auto-discovered)
