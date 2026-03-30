// Usage Example:
// @Singleton()
// class MyService { }
//
// @Singleton('main', 'renderer')
// class SharedService { }
//
// const service1 = new MyService()
// const service2 = new MyService()
// console.log(service1 === service2) // true

type ProcessType = 'main' | 'preload' | 'renderer'

type Constructor = new (...args: unknown[]) => unknown

const singletonInstances = new WeakMap<Constructor, unknown>()

export function Singleton(...processTypes: ProcessType[]): ClassDecorator {
  return (target: Constructor) => {
    const currentProcessType = (process.env.PROCESS_TYPE as ProcessType) || 'main'
    const shouldSingleton = processTypes.length === 0 || processTypes.includes(currentProcessType)

    if (!shouldSingleton) {
      return target // No-op: return original constructor unchanged
    }

    const wrappedConstructor = new Proxy(target, {
      construct(targetConstructor, args) {
        const existingInstance = singletonInstances.get(targetConstructor as Constructor)
        if (existingInstance !== undefined) {
          return existingInstance
        }

        const instance = Reflect.construct(targetConstructor, args)
        singletonInstances.set(targetConstructor as Constructor, instance)
        return instance
      },
    })

    return wrappedConstructor as unknown as ClassDecorator
  }
}
