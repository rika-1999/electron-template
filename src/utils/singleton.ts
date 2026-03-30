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

// 【改进1】加入泛型 T，继承自构造函数，并推断出实例类型 InstanceType<T>
type Constructor<T = any> = new (...args: any[]) => T

const singletonInstances = new WeakMap<Constructor, any>()

// 【改进2】函数返回值改为具体的类型推断，而不是通用的 ClassDecorator
export function Singleton<T extends Constructor>(...processTypes: ProcessType[]): (target: T) => T {
  return (target: T) => {
    const currentProcessType = process.env.PROCESS_TYPE as ProcessType
    const shouldSingleton = processTypes.length === 0 || processTypes.includes(currentProcessType)

    if (!shouldSingleton) {
      return target // No-op
    }

    const wrappedConstructor = new Proxy(target, {
      construct(_targetConstructor, args, newTarget) {
        // 【注意】这里必须用外层的 target 作为 key，不能用 _targetConstructor
        // 因为在 Proxy 内部，this 指向可能变化，target 是最稳定的引用
        const existingInstance = singletonInstances.get(target)
        if (existingInstance !== undefined) {
          return existingInstance
        }

        // 【改进3】使用 newTarget 确保如果类有继承关系时，原型链依然正确
        const instance = Reflect.construct(target, args, newTarget)
        singletonInstances.set(target, instance)
        return instance
      },
    })

    // 【改进4】断言返回 wrappedConstructor as T，而不是 ClassDecorator
    return wrappedConstructor as T
  }
}
