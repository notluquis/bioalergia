const shouldLog = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

type LogMethod = (...args: unknown[]) => void;

function createLogger(fn: LogMethod): LogMethod {
  return (...args: unknown[]) => {
    if (shouldLog) {
      fn(...args);
    }
  };
}

export const logger = {
  info: createLogger((...args) => console.info(...args)),
  warn: createLogger((...args) => console.warn(...args)),
  error: createLogger((...args) => console.error(...args)),
};
