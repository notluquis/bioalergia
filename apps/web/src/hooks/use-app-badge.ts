import { useState } from "react";

export function useAppBadge() {
  const [badgeCount, setBadgeCount] = useState(0);

  const setBadge = async (count: number) => {
    setBadgeCount(count);
    if ("setAppBadge" in navigator) {
      try {
        await (count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge());
      } catch (error) {
        console.error("Failed to set app badge", error);
      }
    }
  };

  const clearBadge = async () => {
    await setBadge(0);
  };

  // Auto-clear on unmount isn't always desired, so we leave it manual

  return { badgeCount, clearBadge, setBadge };
}
