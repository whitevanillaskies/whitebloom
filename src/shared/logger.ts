export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogMetadata = Record<string, unknown>

type LogEntry = {
  level: LogLevel
  scope?: string
  message: string
  args: unknown[]
  metadata?: LogMetadata
  timestamp: string
}

export interface LogBackend {
  log(entry: LogEntry): void
}

type LogMethod = (message: string, ...args: unknown[]) => void

function isDevelopmentEnvironment(): boolean {
  const globalProcess = globalThis.process
  if (globalProcess?.env?.NODE_ENV) {
    return globalProcess.env.NODE_ENV !== 'production'
  }

  return true
}

class ConsoleLogBackend implements LogBackend {
  log(entry: LogEntry): void {
    if (entry.level === 'debug' && !isDevelopmentEnvironment()) {
      return
    }

    const prefix = entry.scope ? `[${entry.scope}] ${entry.message}` : entry.message
    const payload = entry.metadata ? [...entry.args, entry.metadata] : entry.args

    switch (entry.level) {
      case 'debug':
        console.debug(prefix, ...payload)
        break
      case 'info':
        console.info(prefix, ...payload)
        break
      case 'warn':
        console.warn(prefix, ...payload)
        break
      case 'error':
        console.error(prefix, ...payload)
        break
    }
  }
}

let activeBackend: LogBackend = new ConsoleLogBackend()

function write(level: LogLevel, scope: string | undefined, message: string, args: unknown[]): void {
  activeBackend.log({
    level,
    scope,
    message,
    args,
    timestamp: new Date().toISOString()
  })
}

function createLogMethod(level: LogLevel, scope?: string): LogMethod {
  return (message, ...args) => write(level, scope, message, args)
}

export type Logger = {
  debug: LogMethod
  info: LogMethod
  warn: LogMethod
  error: LogMethod
  child: (scope: string, metadata?: LogMetadata) => Logger
}

function withMetadata(logger: Logger, metadata: LogMetadata): Logger {
  return {
    debug: (message, ...args) => logger.debug(message, ...args, metadata),
    info: (message, ...args) => logger.info(message, ...args, metadata),
    warn: (message, ...args) => logger.warn(message, ...args, metadata),
    error: (message, ...args) => logger.error(message, ...args, metadata),
    child: (scope, childMetadata) =>
      withMetadata(logger.child(scope), childMetadata ? { ...metadata, ...childMetadata } : metadata)
  }
}

export function createLogger(scope?: string): Logger {
  const logger: Logger = {
    debug: createLogMethod('debug', scope),
    info: createLogMethod('info', scope),
    warn: createLogMethod('warn', scope),
    error: createLogMethod('error', scope),
    child: (childScope, metadata) => {
      const nextScope = scope ? `${scope}:${childScope}` : childScope
      const childLogger = createLogger(nextScope)
      return metadata ? withMetadata(childLogger, metadata) : childLogger
    }
  }

  return logger
}

export function setLogBackend(backend: LogBackend): void {
  activeBackend = backend
}

export const logger = createLogger()
