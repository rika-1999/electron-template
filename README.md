# electron-test

Electron + React + TypeScript desktop application scaffold.

## Tech Stack

- **Runtime**: Electron ^34
- **Package Manager**: pnpm
- **Renderer**: React 18 + TypeScript + Vite
- **Main/Preload Build**: Vite
- **Packaging**: electron-builder
- **Auto-update**: electron-updater (generic provider)
- **Logging**: electron-log
- **Testing**: Vitest + Testing Library

## Requirements

- Node.js >= 18
- pnpm >= 9

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (renderer + main + electron)
pnpm run dev
```

> **Note**: Electron will auto-restart when the renderer changes (Vite HMR). For main process changes, restart manually.

## Build

```bash
# Build renderer + main + preload
pnpm run build

# Type check
pnpm run typecheck

# Lint
pnpm run lint
```

## Packaging

```bash
# Windows installer (NSIS x64)
pnpm run dist:win

# All platforms (current OS)
pnpm run dist
```

Output goes to `release/`.

## Testing

```bash
# Run tests once
pnpm run test

# Watch mode
pnpm run test:watch

# With coverage
pnpm run test:coverage
```

## Auto-update Configuration

Copy `.env.example` to `.env` and configure:

```env
UPDATE_SERVER_URL=https://your-update-server.com/releases
AUTO_CHECK_ON_STARTUP=true
AUTO_DOWNLOAD=false
UPDATE_CHECK_INTERVAL=3600000
```

The update server must serve `latest.yml` (Windows) or `latest-mac.yml` (macOS) at the configured URL, compatible with `electron-updater` generic provider format.

## IPC Communication

All inter-process communication goes through a unified `channel` built on Electron's `MessageChannelMain`. It supports bidirectional request-response between main and renderer.

**Main process** — register handlers and push events:

```ts
import { channel } from '@/utils/channel'

// Handle requests from renderer
channel.on('my:method', async (payload) => {
  return { result: 'ok' }
})

// Push event to renderer (fire-and-forget)
channel.request('my:event', data)
```

**Renderer** — same API as main, import directly:

```ts
import { channel } from '@/utils/channel'

// Send a request and await response
const result = await channel.request('my:method', payload)

// Listen for events pushed from main
channel.on('my:event', (data) => { ... })
channel.off('my:event')
```

## Path Alias

`@` maps to `src/`. Available in all processes (main, preload, renderer):

```ts
import { log } from '@/utils/log'
import { channel } from '@/utils/channel'
```

## Project Structure

```
src/
├── main/
│   ├── index.ts           # App lifecycle entry
│   ├── window.ts          # BrowserWindow creation
│   ├── ipc.ts             # IPC / channel handler registration
│   ├── updater/
│   │   ├── index.ts       # Auto-update service
│   │   └── types.ts       # Update types
│   └── utils/
│       └── paths.ts       # Runtime path helpers
├── preload/
│   └── index.ts           # Initializes channel (auto-exposes window.channel)
├── renderer/
│   ├── index.html
│   ├── main.tsx           # React entry
│   ├── App.tsx
│   └── styles/
├── shared/
│   └── channel.ts         # Shared message protocol types
├── utils/
│   ├── channel.ts         # Unified IPC channel (main + preload/renderer)
│   ├── env.ts             # Process environment helpers
│   └── log.ts             # Unified logger (electron-log wrapper)
└── test/
    └── setup.ts
```
