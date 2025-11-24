import { useState } from "react";

export function useAppBadge() {
  const [badgeCount, setBadgeCount] = useState(0);

  const setBadge = async (count: number) => {
    setBadgeCount(count);
    if ("setAppBadge" in navigator) {
      try {
        if (count > 0) {
          await navigator.setAppBadge(count);
        } else {
          await navigator.clearAppBadge();
        }
      } catch (e) {
        console.error("Failed to set app badge", e);
      }
    }
  };

  const clearBadge = async () => {
    await setBadge(0);
  };

  // Auto-clear on unmount isn't always desired, so we leave it manual

  return { badgeCount, setBadge, clearBadge };
}
