/**
 * Performance detection utility.
 * Heuristically determines if the device is "low-end" to disable expensive CSS effects.
 */

export function initPerformanceMonitoring() {
  if (typeof window === "undefined") return;

  let isLowEnd = false;

  // 1. Check Hardware Concurrency (CPU Cores)
  // Most modern phones have 8 cores. Low end often have 4 or less.
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
    isLowEnd = true;
  }

  // 2. Check Device Memory (RAM in GB) - Chrome only
  // @ts-ignore
  if (navigator.deviceMemory && navigator.deviceMemory < 4) {
    isLowEnd = true;
  }

  // 3. Check Data Saver / Lite Mode
  // @ts-ignore
  if (navigator.connection && navigator.connection.saveData) {
    isLowEnd = true;
  }

  // 4. Check Low Power Mode (iOS/Mac) - Media Query
  // This is dynamic, so we use a listener, but for init we check matches
  /*
  const isLowPowerMode = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (isLowPowerMode) isLowEnd = true;
  */

  // Apply class to HTML
  const html = document.documentElement;
  if (isLowEnd) {
    html.classList.add("perf-low");
    html.classList.remove("perf-high");
    console.log("[Perf] Low-end device detected. Disabling expensive effects.");
  } else {
    html.classList.add("perf-high");
    html.classList.remove("perf-low");
    console.log("[Perf] High-end device detected. Enabling full effects.");
  }
}
