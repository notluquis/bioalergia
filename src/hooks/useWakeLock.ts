import { useEffect, useRef, useState } from "react";

export function useWakeLock() {
  const [isLocked, setIsLocked] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    // Function to request wake lock
    const requestWakeLock = async () => {
      if ("wakeLock" in navigator) {
        try {
          const wakeLock = await navigator.wakeLock.request("screen");
          wakeLockRef.current = wakeLock;
          setIsLocked(true);
          console.log("[WakeLock] Screen wake lock active");

          // Re-acquire lock if visibility changes (e.g. tab switch)
          document.addEventListener("visibilitychange", handleVisibilityChange);

          wakeLock.addEventListener("release", () => {
            console.log("[WakeLock] Screen wake lock released");
            setIsLocked(false);
          });
        } catch (err) {
          // Ignore NotAllowedError as it's expected if user denies permission or tab is hidden
          if ((err as Error).name !== "NotAllowedError") {
            console.error(`[WakeLock] Failed to acquire wake lock: ${(err as Error).name}, ${(err as Error).message}`);
          }
        }
      }
    };

    const handleVisibilityChange = async () => {
      if (wakeLockRef.current !== null && document.visibilityState === "visible") {
        await requestWakeLock();
      }
    };

    requestWakeLock();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, []);

  return { isLocked };
}
