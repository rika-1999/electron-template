import type { LogLevel, LogContext } from './types'

export interface LogSender {
  sendLog(level: LogLevel, ctx: LogContext, serializedParams: string[]): void
}

let sender: LogSender | null = null
let initPromise = Promise.resolve(undefined as unknown)

async function initSender() {
  if (sender) {
    return sender
  }

  if (process.env.PROCESS_TYPE === 'main') {
    const { ipcMain } = await import('electron')
    const mainLog = (await import('electron-log/main')).default
    const sendLog = (level: LogLevel, ctx: LogContext, serializedParams: string[]) => {
      mainLog[level](ctx, ...serializedParams)
    }
    ipcMain.on(
      '__app_log__',
      (_event: any, msg: { level: LogLevel; ctx: LogContext; serializedParams: string[] }) => {
        sendLog(msg.level, msg.ctx, msg.serializedParams)
      },
    )
    sender = { sendLog }
  } else if (process.env.PROCESS_TYPE === 'preload') {
    const { contextBridge, ipcRenderer } = await import('electron')
    const sendLog = (level: LogLevel, ctx: LogContext, serializedParams: string[]) => {
      ipcRenderer.send('__app_log__', { level, ctx, serializedParams })
    }
    contextBridge.exposeInMainWorld('__app_log__', { sendLog })
    sender = { sendLog }
  } else {
    sender = {
      sendLog(level: LogLevel, ctx: LogContext, serializedParams: string[]): void {
        window.__app_log__?.sendLog(level, ctx, serializedParams)
      },
    }
  }
  return sender!
}

export function logSender(): LogSender {
  if (sender) {
    return sender
  }
  initPromise = initPromise.then(initSender)
  return {
    sendLog(level: LogLevel, ctx: LogContext, serializedParams: string[]): void {
      initPromise = initPromise.then(async () =>
        (await initSender()).sendLog(level, ctx, serializedParams),
      )
    },
  }
}
