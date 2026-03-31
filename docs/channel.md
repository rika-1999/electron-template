# Channel Architecture

The `Channel` class provides a MessagePort-based IPC abstraction that separates lifecycle management from request/response logic.

See [Architecture](architecture.md) for project overview and [Patterns](patterns.md) for testing guidelines.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                           Channel                             │
│  (lifecycle, init, port management, channel registry)         │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    ChannelApiImpl                       │ │
│  │  (request/response, handlers, pending, timeouts,       │ │
│  │   message dispatch, error serialization)               │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### Channel (`src/utils/channel/index.ts`)

**Responsibilities**: Registration and initialization

- Creates and manages `MessageChannelMain` ports
- Maintains module-level `channelRegistry` (maps `webContentsId` → `port2`)
- Registers IPC handler for `__channel_request_port__`
- Implements `ChannelAPI` interface via delegation to `ChannelApiImpl`
- Process-specific setup: `setupMain()` / `setupPreload()` / `init()`
- Lifecycle: `destroy()` cleans up port, registry, and calls `api.clearPending()`

**Process behavior**:

- **Main**: Creates `MessageChannelMain`, keeps `port1`, stores `port2` in registry
- **Preload**: Requests port via IPC, sets up port, optionally exposes API to renderer
- **Renderer**: Uses `window.__app_channel__` as API (no port management)

### ChannelApiImpl (`src/utils/channel/channel-api-impl.ts`)

**Responsibilities**: Message handling and state

- Manages `handlers` Map (method → handler function)
- Manages `pending` Map (request ID → response handler)
- Manages `timeouts` Map (request ID → timeout ID)
- `dispatch()`: routes incoming messages (requests call handlers, responses resolve promises)
- `request()`: sends request, waits for response with configurable timeout
- `onRequest()` / `offRequest()`: register/remove method handlers
- `clearPending()`: resolves all pending with 'Channel destroyed', clears timeouts

**No process-type checks** — pure MessagePort logic that works in any process.

## Message Flow

### Renderer → Main (Request)

```
Renderer                        Preload                      Main
========                        =======                     =====
channel.request('method')
  → window.__app_channel__.request()
     → port2.postMessage(ChannelRequest)
        |                    dispatch(ChannelRequest)
        |                       → handler(msg.payload)
        |                       → port1.postMessage(ChannelResponse)
        |  <───────────────────────────
  dispatch(ChannelResponse)
    → resolve promise
```

### Main → Renderer (Request)

```
Main                             Preload                  Renderer
====                              =======                 ========
channel.request('method')
  → port1.postMessage(ChannelRequest)
     |                    dispatch(ChannelRequest)
     |                       → handler(msg.payload)
     |                       → port2.postMessage(ChannelResponse)
     |  <───────────────────────────
  dispatch(ChannelResponse)
    → resolve promise
```

## Error Handling

- Handler errors are serialized via `serialize()` (preserves Error name, message, stack)
- Errors are deserialized on receiving side via `deserialize()`
- Timeouts throw `ChannelTimeoutError` with the method name
- `destroy()` resolves all pending promises with 'Channel destroyed' error

## Renderer Exposure

In preload, `Channel.init()` exposes the API via `contextBridge`:

```typescript
contextBridge.exposeInMainWorld('__app_channel__', {
  request: this.api.request.bind(this.api),
  onRequest: this.api.onRequest.bind(this.api),
  offRequest: this.api.offRequest.bind(this.api),
  setDefaultTimeout: this.api.setDefaultTimeout.bind(this.api),
})
```

Note: Methods must be bound because `contextBridge` only copies own enumerable properties, not prototype methods.

## Usage

### Main process

```typescript
import { channel } from '@/shared/channel'

await channel.init({ webContentsId: webContents.id })

channel.onRequest('updater:checkForUpdates', async () => {
  return await checkForUpdates()
})
```

### Renderer process

```typescript
// Preload has exposed window.__app_channel__
const result = await window.__app_channel__.request('updater:checkForUpdates')
```

### ViewManager integration

`ViewManager` implements `ChannelCenter` for multi-view coordination:

```typescript
viewManager.requestTo(viewId, 'method', payload)
viewManager.broadcast('method', payload)
viewManager.onAnyRequest('method', (viewId, payload) => {
  /* ... */
})
```

### Service Registry integration

For higher-level service abstraction, use the ServiceRegistry instead of direct channel calls:

```typescript
import { updaterServiceApi } from '@/shared/services/updaterApi'

// Auto-routing: same process invokes directly, cross-process uses channel
await updaterServiceApi.checkForUpdates()

// Explicit channel selection
const updater = updaterServiceApi.use(channel)
await updater.checkForUpdates()
```

See `src/shared/serviceRegistry/index.ts` for ServiceRegistry API documentation.

## Key Files

| File                                    | Purpose                                               |
| --------------------------------------- | ----------------------------------------------------- |
| `src/utils/channel/index.ts`            | `Channel` facade class                                |
| `src/utils/channel/channel-api-impl.ts` | `ChannelApiImpl` core logic                           |
| `src/utils/channel/types.ts`            | `ChannelRequest`, `ChannelResponse`, `ChannelMessage` |
| `src/utils/channel/error.ts`            | `ChannelTimeoutError`                                 |
| `src/shared/channel.ts`                 | `ChannelAPI`, `ChannelCenter` interfaces              |
| `src/utils/serialize/index.ts`          | `serialize()` / `deserialize()` for errors            |
