/**
 * Performance detection utility.
 * Heuristically determines if the device is "low-end" to disable expensive CSS effects.
 */

interface NavigatorWithMemory extends Navigator {
  connection?: {
    saveData: boolean;
  };
  deviceMemory?: number;
}

export function initPerformanceMonitoring() {
  let isLowEnd = false;

  const nav = navigator as NavigatorWithMemory;

  // 1. Check Hardware Concurrency (CPU Cores)
  // Most modern phones have 8 cores. Low end often have 4 or less.
  if (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) {
    isLowEnd = true;
  }

  // 2. Check Device Memory (RAM in GB) - Chrome only
  if (nav.deviceMemory && nav.deviceMemory < 4) {
    isLowEnd = true;
  }

  // 3. Check Data Saver / Lite Mode
  if (nav.connection?.saveData) {
    isLowEnd = true;
  }

  // 4. Check Low Power Mode (iOS/Mac) - Media Query
  // This is dynamic, so we use a listener, but for init we check matches

  // Apply class to HTML
  const html = document.documentElement;
  if (isLowEnd) {
    html.classList.add("perf-low");
    html.classList.remove("perf-high");
  } else {
    html.classList.add("perf-high");
    html.classList.remove("perf-low");
  }
}
