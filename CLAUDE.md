# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

All detailed guidance is in **AGENTS.md** — commands, code style, naming conventions, architecture patterns, and project structure are documented there.

## Quick Reference

| Command                  | Description                                       |
| ------------------------ | ------------------------------------------------- |
| `pnpm run dev`           | Build dev assets + start Electron with hot reload |
| `pnpm run build`         | Production build (main/preload/renderer)          |
| `pnpm run package:win`   | Build + package for Windows (NSIS x64)            |
| `pnpm run package`       | Build + package for all platforms                 |
| `pnpm run lint -- --fix` | Auto-fix lint issues                              |
| `npx vitest run <file>`  | Run single test file                              |

## Key Architecture

- **Main process** (`src/main/`) — manages windows, views, tray, updater
- **viewManager** — singleton managing all `WebContentsView` instances
- **windowManager** — singleton managing all `BrowserWindow` instances
- **channel** — default IPC channel (MessageChannelMain) for renderer↔main
- **Path alias**: `@/*` maps to `src/`
- **Process type guards**: `process.env.PROCESS_TYPE === 'main'/'renderer'`
