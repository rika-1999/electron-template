import type { LogFunctions } from 'electron-log'

export interface LogPayload {
  message: string
  params?: unknown[]
}

let _log: LogFunctions | null = null

async function getLog(): Promise<LogFunctions> {
  if (_log) return _log

  if (process.env.PROCESS_TYPE === 'main') {
    _log = (await import('electron-log/main')).default
  } else {
    _log = (await import('electron-log/renderer')).default
  }

  return _log!
}

function buildPayload(message: string, ...params: unknown[]): LogPayload {
  return params.length > 0 ? { message, params } : { message }
}

export async function initLog(): Promise<void> {
  if (process.env.PROCESS_TYPE === 'main') {
    const mainLog = (await import('electron-log/main')).default
    mainLog.initialize()
  }
}

export const log = {
  info(message: string, ...params: unknown[]) {
    ;(async () => (await getLog()).info(buildPayload(message, ...params)))()
  },
  warn(message: string, ...params: unknown[]) {
    ;(async () => (await getLog()).warn(buildPayload(message, ...params)))()
  },
  error(message: string, ...params: unknown[]) {
    ;(async () => (await getLog()).error(buildPayload(message, ...params)))()
  },
  debug(message: string, ...params: unknown[]) {
    ;(async () => (await getLog()).debug(buildPayload(message, ...params)))()
  },
}
