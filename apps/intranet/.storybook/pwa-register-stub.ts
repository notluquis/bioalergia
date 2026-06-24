/**
 * Stub for `virtual:pwa-register/react`.
 *
 * The PWA plugin (`vite-plugin-pwa`) only runs inside the intranet's
 * production Vite config. Storybook + addon-vitest spin up an isolated
 * Vite instance without that plugin, so the virtual module is unresolved.
 *
 * Components that import `useRegisterSW` (e.g. `UpdateNotification`) need
 * a deterministic stand-in so their stories can render in headless
 * browser tests. We expose the same shape (`needRefresh` tuple +
 * `updateServiceWorker`) but as a no-op: `needRefresh` defaults to
 * `false`, the setter is a normal `useState` setter, and
 * `updateServiceWorker` resolves immediately. Stories that want to
 * exercise the "update available" UI can call the setter inside their
 * own render to flip the state.
 */
import { useEffect, useState } from "react";

interface RegisterSWOptions {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: () => void;
  onRegisterError?: (error: unknown) => void;
}

const FORCE_FLAG = "__SB_PWA_FORCE_NEED_REFRESH__";

export function useRegisterSW(options: RegisterSWOptions = {}) {
  const initial = Boolean((globalThis as Record<string, unknown>)[FORCE_FLAG]);
  const [needRefresh, setNeedRefresh] = useState(initial);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    if (initial) {
      options.onNeedRefresh?.();
    }
    options.onRegistered?.();
    // We intentionally read `initial` once at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    needRefresh: [needRefresh, setNeedRefresh] as const,
    offlineReady: [offlineReady, setOfflineReady] as const,
    updateServiceWorker: async (_reload?: boolean) => {
      /* no-op in storybook */
    },
  };
}
