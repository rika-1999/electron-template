# Cross-Process Communication Example

This example demonstrates a complete cross-process communication flow using the ServiceRegistry and Channel systems in this Electron template.

## Overview

The Counter example demonstrates:

- Main → Renderer: Service calling service across processes
- Renderer → Main: Component calling main service
- Automatic routing via ServiceRegistry
- Type-safe API definitions

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Main Process                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  CounterService (extends CounterMainApi)                  │ │
│  │  - count: number                                          │ │
│  │  - increment() → { count } + notifyRenderer()           │ │
│  │  - decrement() → { count } + notifyRenderer()           │ │
│  │  - notifyRenderer() → counterRendererApi.updateCount()   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           │                                     │
│                           │ channel.request()                  │
│                           ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ServiceRegistry                                          │ │
│  │  - Routes CounterRendererApi calls to renderer process   │ │
│  │  - Creates proxy that uses Channel                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ MessagePort (Channel)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Renderer Process                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  CounterRendererService (extends CounterRendererApi)     │ │
│  │  - updateCount(count) → useCounterStore.setState()        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           │                                     │
│                           ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  useCounterStore (Zustand)                                 │ │
│  │  - state: { count: number }                               │ │
│  │  - setState({ count })                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Step-by-Step Implementation

### Step 1: Define Service API in Shared Layer

**File**: `src/shared/services/rendererApi.ts`

```typescript
import { serviceRegistry } from '@/shared/serviceRegistry';

export abstract class CounterRendererApi {
  abstract updateCount(count: number): Promise<void>;
}

export const counterRendererApi = serviceRegistry.defineApi(CounterRendererApi, 'renderer');
```

### Step 2: Implement Main Process Service

**File**: `src/main/services/counterService.ts`

```typescript
import { CounterMainApi, CounterRendererApi } from '@/shared/services';
import { Singleton } from '@/utils/singleton';
import { counterRendererApi } from '@/shared/services';
import { channel } from '@/shared/channel';

@Singleton()
class CounterService extends CounterMainApi {
  private count = 0;
  private rendererApi: CounterRendererApi;

  constructor() {
    super();
    this.rendererApi = counterRendererApi.use(channel);
  }

  async increment(): Promise<{ count: number }> {
    this.count++;
    await this.notifyRenderer();
    return { count: this.count };
  }

  async decrement(): Promise<{ count: number }> {
    this.count--;
    await this.notifyRenderer();
    return { count: this.count };
  }

  private async notifyRenderer(): Promise<void> {
    try {
      await this.rendererApi.updateCount(this.count);
    } catch (error) {
      console.error('Failed to notify renderer:', error);
    }
  }
}

export const counterService = new CounterService();
```

### Step 3: Implement Renderer Process Service

**File**: `src/renderer/services/counterService.ts`

```typescript
import { CounterRendererApi } from '@/shared/services';
import { Singleton } from '@/utils/singleton';
import { useCounterStore } from '../stores/counterStore';

@Singleton()
class CounterRendererService extends CounterRendererApi {
  async updateCount(count: number): Promise<void> {
    useCounterStore.setState({ count });
  }
}

export const counterRendererService = new CounterRendererService();
```

### Step 4: Register Service Implementation

```typescript
import { serviceRegistry } from '@/shared/serviceRegistry';
import { CounterRendererService } from '@/renderer/services/counterService';
import { channel } from '@/shared/channel';

serviceRegistry.implementService(channel, new CounterRendererService());
```

## Component Example: Counter (Renderer → Main)

### Component Code

**File**: `src/renderer/components/Counter/index.tsx`

```typescript
import React from 'react';
import { Button } from '@/components/ui/button';
import { useCounterStore } from '@/renderer/stores/counterStore';
import { counterMainApi } from '@/shared/services';

export function Counter() {
  const { count } = useCounterStore();

  const handleIncrement = async () => {
    try {
      await counterMainApi.increment();
    } catch (error) {
      console.error('Failed to increment:', error);
    }
  };

  const handleDecrement = async () => {
    try {
      await counterMainApi.decrement();
    } catch (error) {
      console.error('Failed to decrement:', error);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 rounded-2xl bg-white/10 p-12 backdrop-blur-lg shadow-2xl">
      <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
        Electron Counter
      </h1>
      <div className="flex flex-col items-center gap-4">
        <p className="text-6xl font-bold text-white">{count}</p>
        <div className="flex gap-4">
          <Button onClick={handleDecrement} variant="outline" size="lg">-</Button>
          <Button onClick={handleIncrement} variant="outline" size="lg">+</Button>
        </div>
      </div>
    </div>
  );
}
```

**API Definition**:

```typescript
// src/shared/services/counterApi.ts
export abstract class CounterMainApi {
  abstract increment(): Promise<{ count: number }>;
  abstract decrement(): Promise<{ count: number }>;
}

export const counterMainApi = serviceRegistry.defineApi(CounterMainApi, 'main');
```

### Component Test

**File**: `src/__tests__/renderer/components/Counter/Counter.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Counter } from '@/renderer/components/Counter';
import { createMainChannelMock } from '@/__tests__/infrastructure/helpers/channelHelpers';

describe('Counter Component', () => {
  it('should call increment API when + button is clicked', async () => {
    const mainChannel = await createMainChannelMock();

    let calledCount = 0;
    mainChannel.onRequest('CounterMainApi:increment', () => {
      calledCount += 1;
    });

    render(<Counter />);

    const incrementButton = screen.getByText('+');
    fireEvent.click(incrementButton);

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(calledCount).toBe(1);
  });
});
```

**Test Helper**:

```typescript
// src/__tests__/infrastructure/helpers/channelHelpers.ts
export async function createMainChannelMock() {
  process.env.PROCESS_TYPE = 'preload';
  vi.mock('electron', () => createMockElectron());

  const { mainChannel, rendererChannel } = await createChannelPairMock(
    (await import('@/shared/channel')).channel,
  );
  await rendererChannel.init();
  process.env.PROCESS_TYPE = 'renderer';
  serviceRegistry.setDefaultChannel((await import('@/shared/channel')).channel);
  return mainChannel;
}
```

## Testing

### Test Helper

```typescript
export async function createChannelPairMock(
  existingChannel: import('@/shared/channel').Channel,
): Promise<{
  mainChannel: import('@/shared/channel').Channel;
  rendererChannel: import('@/shared/channel').Channel;
}> {
  const { Channel } = await import('@/shared/channel');
  const { port1, port2 } = createMockMessageChannel();

  existingChannel.setPort(port1 as unknown as import('@/shared/channel/impl').Port);

  const rendererChannel = new Channel();
  rendererChannel.setPort(port2 as unknown as import('@/shared/channel/impl').Port);

  return {
    mainChannel: existingChannel,
    rendererChannel,
  };
}
```

### Service Test

```typescript
import { describe, it, expect } from 'vitest';
import { createChannelPairMock } from '@/__tests__/infrastructure/helpers/channelHelpers';

describe('CounterService (Main)', () => {
  it('should increment count and call renderer updateCount via channel', async () => {
    const renderParams: number[] = [];
    const { rendererChannel } = await createChannelPairMock(
      (await import('@/shared/channel')).channel,
    );
    const { counterService } = await import('@/main/services/counterService');
    rendererChannel.onRequest('CounterRendererApi:updateCount', (data) => {
      renderParams.push(...(data as number[]));
    });

    const result = await counterService.increment();

    expect(result.count).toBe(1);
    expect(renderParams).toEqual([1]);
  });
});
```

## Best Practices

### API Definition

```typescript
// src/shared/services/rendererApi.ts
export abstract class CounterRendererApi {
  abstract updateCount(count: number): Promise<void>;
}
```

### Parameter Handling

```typescript
rendererChannel.onRequest('CounterRendererApi:updateCount', (data) => {
  renderParams.push(...(data as number[]));
  return undefined;
});
```

### Test Isolation

```typescript
it('should work', async () => {
  const { counterService } = await import('@/main/services/counterService');
  const rendererChannel = await mockRenderChannel();
});
```
