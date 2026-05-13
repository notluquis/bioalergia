import { useCallback, useEffect, useState } from "react";

// The SW (apps/intranet/src/sw.ts) intercepts POST /share-target
// from the Web Share Target API, stashes the form data in the
// "share-target-inbox-v1" Cache, and 303-redirects to
// /wa-cloud?shared=1. This hook pulls the cached payload back out
// of CacheStorage so the inbox can preview the files + text and
// offer to attach them to a conversation.
//
// The hook does NOT auto-clear — the operator must dismiss
// explicitly so a quick redirect bounce doesn't lose the data.

const CACHE_NAME = "share-target-inbox-v1";

export type SharedPayloadFile = {
  blob: Blob;
  name: string;
  type: string;
  size: number;
};

export type SharedPayload = {
  title: string;
  text: string;
  url: string;
  fileCount: number;
  files: SharedPayloadFile[];
  ts: number;
};

export function useSharedPayload(active: boolean) {
  const [payload, setPayload] = useState<SharedPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active || typeof caches === "undefined") return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const metaRes = await cache.match("/__share_payload");
        if (!metaRes) return;
        const meta = (await metaRes.json()) as {
          title?: string;
          text?: string;
          url?: string;
          fileCount?: number;
          ts?: number;
        };
        const files: SharedPayloadFile[] = [];
        for (let i = 0; i < (meta.fileCount ?? 0); i++) {
          const fileRes = await cache.match(`/__share_file_${i}`);
          if (!fileRes) continue;
          const blob = await fileRes.blob();
          const rawName = fileRes.headers.get("x-filename") ?? `file-${i}`;
          const name = (() => {
            try {
              return decodeURIComponent(rawName);
            } catch {
              return rawName;
            }
          })();
          files.push({ blob, name, type: blob.type, size: blob.size });
        }
        if (!cancelled) {
          setPayload({
            title: meta.title ?? "",
            text: meta.text ?? "",
            url: meta.url ?? "",
            fileCount: meta.fileCount ?? 0,
            files,
            ts: meta.ts ?? Date.now(),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  const clear = useCallback(async () => {
    setPayload(null);
    if (typeof caches === "undefined") return;
    try {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      await Promise.all(keys.map((k) => cache.delete(k)));
    } catch {
      // ignore
    }
  }, []);

  return { payload, loading, clear };
}
