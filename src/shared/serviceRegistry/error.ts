export class ServiceTimeoutError extends Error {
  constructor(service: string, method: string, timeout: number) {
    super(`Service '${service}.${method}' timed out after ${timeout}ms`)
    this.name = 'ServiceTimeoutError'
  }
}
