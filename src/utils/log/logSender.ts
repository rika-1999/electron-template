import type { LogLevel, LogContext } from './types'
import { env } from '@/utils/env'

export interface LogSender {
  sendLog(level: LogLevel, ctx: LogContext, serializedParams: string[]): void
}

let sender: LogSender | null = null
let initPromise = Promise.resolve(undefined as unknown)

async function initSender() {
  if (sender) {
    return sender
  }

  if (env.isMain()) {
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
  } else if (env.isPreload()) {
    const { contextBridge, ipcRenderer } = await import('electron')
    const sendLog = (level: LogLevel, ctx: LogContext, serializedParams: string[]) => {
      ipcRenderer.send('__app_log__', { level, ctx, serializedParams })
    }
    contextBridge.exposeInMainWorld('__app_log__', { sendLog })
    sender = { sendLog }
  } else if (env.isRenderer()) {
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
