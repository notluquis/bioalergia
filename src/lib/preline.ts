export async function loadPreline(): Promise<void> {
  try {
    // dynamic import so Vite can code-split
    // dynamic import may not exist in some environments; ignore type errors
    // @ts-ignore - optional dependency
    await import("preline/dist/index.js").catch(() => {});
  } catch (err) {
    // non-fatal — if Preline isn't installed or import fails, ignore
    // console.debug("Preline load failed", err);
  }
}

export function autoInit(types?: string[] | string) {
  try {
    // use `any` to access runtime-only global safely without TS errors
    const w = window as any;
    if (w.HSStaticMethods && typeof w.HSStaticMethods.autoInit === "function") {
      // allow passing a single type or array
      w.HSStaticMethods.autoInit(types ? (Array.isArray(types) ? types : [types]) : undefined);
    }
  } catch (err) {
    // ignore
  }
}
