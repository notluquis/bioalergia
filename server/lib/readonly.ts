// server/lib/readonly.ts

export const readonly = <T extends Record<string, unknown>>(obj: T): Readonly<T> => Object.freeze(obj);
