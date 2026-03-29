export const env = {
  isDev() {
    return process.env.NODE_ENV === 'development'
  },
  isMain() {
    return process.env.PROCESS_TYPE === 'main'
  },
  isPreload() {
    return process.env.PROCESS_TYPE === 'preload'
  },
  isRenderer() {
    return process.env.PROCESS_TYPE === 'renderer'
  },
  getProcessType(): 'main' | 'preload' | 'renderer' {
    return (process.env.PROCESS_TYPE as 'main' | 'preload' | 'renderer') || 'main'
  },
}
