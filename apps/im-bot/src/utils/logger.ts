/**
 * 简单日志工具
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = 'info';

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

export function setLogLevel(level: string): void {
  if (level in LEVEL_PRIORITY) {
    currentLevel = level as LogLevel;
  }
}

export function debug(tag: string, ...args: unknown[]): void {
  if (shouldLog('debug')) {
    console.log(`[${timestamp()}] [DEBUG] [${tag}]`, ...args);
  }
}

export function info(tag: string, ...args: unknown[]): void {
  if (shouldLog('info')) {
    console.log(`[${timestamp()}] [INFO]  [${tag}]`, ...args);
  }
}

export function warn(tag: string, ...args: unknown[]): void {
  if (shouldLog('warn')) {
    console.warn(`[${timestamp()}] [WARN]  [${tag}]`, ...args);
  }
}

export function error(tag: string, ...args: unknown[]): void {
  if (shouldLog('error')) {
    console.error(`[${timestamp()}] [ERROR] [${tag}]`, ...args);
  }
}

const logger = { debug, info, warn, error, setLogLevel };
export default logger;
