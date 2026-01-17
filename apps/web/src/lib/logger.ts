/**
 * Lightweight Logger for Browser
 *
 * Zero-dependency logger with environment-aware levels.
 * In production: only warn and error are shown.
 * In development: all levels are shown.
 */

const isDev = Boolean(import.meta.env?.DEV);

type LogMethod = (...args: unknown[]) => void;

function createMethod(fn: LogMethod, showInProd = false): LogMethod {
  return (...args: unknown[]) => {
    if (isDev || showInProd) {
      fn(...args);
    }
  };
}

/**
 * Create a namespaced logger
 */
export function createLogger(namespace?: string) {
  const prefix = namespace ? `[${namespace}]` : "";

  const withPrefix = (fn: LogMethod): LogMethod => {
    return (...args: unknown[]) => {
      if (prefix) {
        fn(prefix, ...args);
      } else {
        fn(...args);
      }
    };
  };

  return {
    debug: createMethod(withPrefix(console.debug)),
    info: createMethod(withPrefix(console.info)),
    log: createMethod(withPrefix(console.log)),
    warn: createMethod(withPrefix(console.warn), true), // Always show in prod
    error: createMethod(withPrefix(console.error), true), // Always show in prod
  };
}

// Default logger instance
export const logger = createLogger();

// Convenience exports
export const { debug, info, log, warn, error } = logger;
