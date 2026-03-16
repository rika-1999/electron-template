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
}
