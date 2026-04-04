export function Timeout(ms: number): ClassDecorator {
  return (target) => {
    (target as { __serviceTimeout__?: number }).__serviceTimeout__ = ms;
  };
}

export function MethodTimeout(ms: number): MethodDecorator {
  return (target, propertyKey) => {
    if (!propertyKey) {
      return;
    }

    const constructor = target.constructor as unknown as Record<string, unknown>;

    const methodTimeouts = constructor.__methodTimeouts__ as Map<string, number> | undefined;
    const newMethodTimeouts = methodTimeouts ?? new Map<string, number>();

    if (!methodTimeouts) {
      constructor.__methodTimeouts__ = newMethodTimeouts;
    }

    newMethodTimeouts.set(propertyKey as string, ms);
  };
}
