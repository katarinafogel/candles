// The last errors on this device, so a message that flashed by can be read again (and copied
// for the one who fixes it): every red toast, uncaught errors and crashed pages land here.
const KEY = 'errorLog'
const MAX = 30

export interface LoggedError {
  at: string
  path: string
  title: string
  message?: string
  stack?: string
}

const listeners = new Set<() => void>()

export function errorLog(): LoggedError[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as LoggedError[]
  } catch {
    return []
  }
}

export function logError(title: string, message?: string, stack?: string) {
  const entry: LoggedError = {
    at: new Date().toISOString(),
    path: `${location.pathname}${location.hash}`,
    title,
    ...(message ? { message: message.slice(0, 1000) } : {}),
    ...(stack ? { stack: stack.split('\n').slice(0, 8).join('\n') } : {}),
  }
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...errorLog()].slice(0, MAX)))
  } catch {
    // private mode or full: nothing to keep
  }
  for (const f of listeners) f()
}

export function clearErrorLog() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing to clear
  }
  for (const f of listeners) f()
}

export function onErrorLog(f: () => void) {
  listeners.add(f)
  return () => void listeners.delete(f)
}
