import { useCallback, useState } from "react";

export function useLazyTabs<TTab extends string>(initialTab: TTab) {
  const [mountedTabs, setMountedTabs] = useState<Set<TTab>>(() => new Set([initialTab]));

  const markTabAsMounted = useCallback((tab: TTab) => {
    setMountedTabs((prev) => {
      if (prev.has(tab)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, []);

  const isTabMounted = useCallback((tab: TTab) => mountedTabs.has(tab), [mountedTabs]);

  return {
    isTabMounted,
    markTabAsMounted,
  };
}
