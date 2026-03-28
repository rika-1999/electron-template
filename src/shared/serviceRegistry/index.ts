import type { ChannelCenter } from '@/shared/channel/types'

export interface ServiceInfo {
  serviceName: string
  processType: 'main' | 'preload' | 'renderer'
}

type ChannelLike =
  | {
      request(method: string, payload?: unknown): Promise<unknown>
      onRequest(method: string, handler: (payload: unknown) => unknown): void
    }
  | {
      onAnyRequest(method: string, handler: (viewId: string, payload: unknown) => unknown): void
    }

type ApiType<T> = T & {
  use: (channel: ChannelLike) => ApiType<T>
}

export class ServiceRegistry {
  private apiDefinitions = new Map<abstract new () => object, ServiceInfo & { apiProxy: unknown }>()
  private serviceImplementations = new Map<string, { instance: object; processType: string }>()
  private defaultChannel: ChannelLike | null = null

  setDefaultChannel(channel: ChannelLike): void {
    this.defaultChannel = channel
  }

  defineApi<T extends object>(
    ApiClass: abstract new () => T,
    processType: 'main' | 'preload' | 'renderer',
  ): ApiType<T> {
    const serviceName = this.getServiceName(ApiClass.name)

    ;(ApiClass as unknown as Record<string, unknown>).__serviceInfo__ = {
      serviceName,
      processType,
    }

    const createProxy = (channel: ChannelLike | null): ApiType<T> => {
      return new Proxy({} as T, {
        get: (target, prop) => {
          if (prop === 'use') {
            return (newChannel: ChannelLike) => createProxy(newChannel)
          }

          if (typeof prop === 'string') {
            if (this.getCurrentProcessType() === processType) {
              return (...args: unknown[]) => {
                const impl = this.serviceImplementations.get(serviceName)
                if (!impl || !impl.instance) {
                  throw new Error(`Service '${serviceName}' not implemented`)
                }
                const method = (impl.instance as Record<string, unknown>)[prop]
                if (typeof method === 'function') {
                  return (method as (...args: unknown[]) => unknown).apply(impl.instance, args)
                }
                return method
              }
            } else {
              return (...args: unknown[]) => {
                const channelToUse = channel || this.defaultChannel
                if (!channelToUse) {
                  throw new Error(
                    `No channel specified for remote service '${serviceName}'. Call .use(channel) first.`,
                  )
                }
                return this.invokeRemote(channelToUse, serviceName, prop, args)
              }
            }
          }
          return target[prop as keyof T]
        },
      }) as ApiType<T>
    }

    const apiProxy = createProxy(null)

    this.apiDefinitions.set(ApiClass, {
      serviceName,
      processType,
      apiProxy,
    })

    return apiProxy
  }

  implementService(channelLike: ChannelLike, ...instances: object[]): void {
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

      this.registerChannelHandlers(channelLike, instance, serviceInfo.serviceName)
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
        if ('onAnyRequest' in channelLike && typeof channelLike.onAnyRequest === 'function') {
          const channelCenter = channelLike as unknown as ChannelCenter
          channelCenter.onAnyRequest(channelMethod, (_viewId: string, payload: unknown) => {
            return (serviceMethod as (...args: unknown[]) => unknown).apply(
              instance,
              payload as unknown[],
            )
          })
        } else if ('onRequest' in channelLike && typeof channelLike.onRequest === 'function') {
          channelLike.onRequest(channelMethod, (payload: unknown) => {
            return (serviceMethod as (...args: unknown[]) => unknown).apply(
              instance,
              payload as unknown[],
            )
          })
        }
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

  private async invokeRemote(
    channelLike: ChannelLike,
    serviceId: string,
    method: string,
    args: unknown[],
  ): Promise<unknown> {
    const channelMethod = `${serviceId}:${method}`

    if ('requestTo' in channelLike && 'onAnyRequest' in channelLike) {
      throw new Error(
        'Cannot use ChannelCenter directly. Please use specific channel via .use(channel)',
      )
    }

    if ('request' in channelLike && typeof channelLike.request === 'function') {
      return channelLike.request(channelMethod, args)
    }

    throw new Error('Channel does not support request method')
  }

  private getCurrentProcessType(): 'main' | 'preload' | 'renderer' {
    return (process.env.PROCESS_TYPE as 'main' | 'preload' | 'renderer') || 'main'
  }

  private getServiceName(className: string): string {
    return className.replace(/Api$/, '').toLowerCase()
  }
}

export const serviceRegistry = new ServiceRegistry()
