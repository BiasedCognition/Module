type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogMeta {
  [key: string]: unknown
}

function invokeElectronLog(level: LogLevel, message: string, meta?: LogMeta) {
  if (typeof window === 'undefined') return
  const api = (window as any).electronAPI
  if (api && typeof api.log === 'function') {
    api.log(level, message, meta)
  }
}

function log(level: LogLevel, message: string, meta?: LogMeta) {
  if (!message) return
  const consoleFn =
    level === 'error' ? console.error :
    level === 'warn' ? console.warn :
    level === 'debug' ? console.debug :
    console.info

  consoleFn(`[${level.toUpperCase()}] ${message}`, meta ?? '')
  try {
    invokeElectronLog(level, message, meta)
  } catch (error) {
    console.warn('发送日志到主进程失败', error)
  }
}

export const logger = {
  debug: (message: string, meta?: LogMeta) => log('debug', message, meta),
  info: (message: string, meta?: LogMeta) => log('info', message, meta),
  warn: (message: string, meta?: LogMeta) => log('warn', message, meta),
  error: (message: string, meta?: LogMeta) => log('error', message, meta),
}

