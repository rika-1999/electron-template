import type { ChannelLike } from '@/shared/channel/types'
import type { ApiType } from './api-definitions'
import type { ServiceInfo } from './types'
import { apiDefinitions } from './api-definitions'
export { ServiceTimeoutError } from './error'

export class ServiceRegistry {
  private serviceImplementations = new Map<string, { instance: object; processType: string }>()

  constructor() {
    apiDefinitions.setServiceImplementationGetter((serviceName) => {
      return this.serviceImplementations.get(serviceName)
    })
  }

  setDefaultChannel(channel: ChannelLike): void {
    apiDefinitions.setDefaultChannel(channel)
  }

  setDefaultTimeout(timeout: number): void {
    apiDefinitions.setDefaultTimeout(timeout)
  }

  defineApi<T extends object>(
    ApiClass: abstract new () => T,
    processType: 'main' | 'preload' | 'renderer',
  ): ApiType<T> {
    return apiDefinitions.defineApi(ApiClass, processType)
  }

  implementService(channelLike: ChannelLike | ChannelLike[], ...instances: object[]): void {
    for (const instance of instances) {
      const apiClass = this.findApiClass(instance)

      if (!apiClass) {
        throw new Error(
          `Service ${instance.constructor.name} does not extend a defined API. ` +
            `Ensure service extends an API class defined by defineApi.`,
        )
      }

      const serviceInfo = (apiClass as unknown as Record<string, unknown>)
        .__serviceInfo__ as ServiceInfo
      this.serviceImplementations.set(serviceInfo.serviceName, {
        instance,
        processType: serviceInfo.processType,
      })

      const channels = Array.isArray(channelLike) ? channelLike : [channelLike]
      for (const channel of channels) {
        this.registerChannelHandlers(channel, instance, serviceInfo.serviceName)
      }
    }
  }

  private registerChannelHandlers(
    channelLike: ChannelLike,
    instance: object,
    serviceName: string,
  ): void {
    const methods = this.getServiceMethods(instance)

    for (const method of methods) {
      const methodName = method as string
      const channelMethod = `${serviceName}:${methodName}`
      const serviceMethod = (instance as Record<string, unknown>)[methodName]

      if (typeof serviceMethod === 'function') {
        channelLike.onRequest(channelMethod, (payload: unknown) => {
          return (serviceMethod as (...args: unknown[]) => unknown).apply(
            instance,
            payload as unknown[],
          )
        })
      }
    }
  }

  private getServiceMethods(instance: object): string[] {
    const methods: string[] = []
    let proto = Object.getPrototypeOf(instance)
    while (proto && proto !== Object.prototype) {
      const names = Object.getOwnPropertyNames(proto)
      for (const name of names) {
        if (
          name !== 'constructor' &&
          typeof (proto as Record<string, unknown>)[name] === 'function'
        ) {
          methods.push(name)
        }
      }
      proto = Object.getPrototypeOf(proto)
    }
    return methods
  }

  private findApiClass(instance: object): abstract new () => object | null {
    let proto = instance.constructor as unknown as abstract new () => object
    while (proto && proto !== Function.prototype) {
      if ((proto as unknown as Record<string, unknown>).__serviceInfo__) {
        return proto
      }
      proto = Object.getPrototypeOf(proto) as unknown as abstract new () => object
    }
    return null as unknown as abstract new () => object | null
  }
}

export const serviceRegistry = new ServiceRegistry()
