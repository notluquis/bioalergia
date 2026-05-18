import type { Key } from "@heroui/react";
import { useCallback } from "react";

/**
 * URL-synced tab state for tabbed pages.
 *
 * Wraps the TanStack Router `useSearch` + `useNavigate` pair so a page
 * with internal `<Tabs>` can persist the active tab to the `?tab=` query
 * param. Deep-links, browser back/forward, and shareable URLs all work
 * without extra plumbing per page.
 *
 * Caller owns the search schema (Zod via `validateSearch` on the
 * route). This hook is just the controlled-state bridge.
 *
 * Usage:
 *
 *   const { tab, onTabChange } = useTabSearchParam(Route, "inbox");
 *   return <Tabs selectedKey={tab} onSelectionChange={onTabChange}>...</Tabs>;
 *
 * @param route — the file-route handle (the `Route` exported by the
 *   route file). Must expose `useSearch()` + `useNavigate()`.
 * @param defaultKey — fallback when the URL has no `tab` param (should
 *   match the route's `validateSearch` zod default).
 *
 * Navigation uses `replace: true` so tab switches don't bloat browser
 * history — back/forward jumps between PAGES, not tab toggles.
 */
export interface TabHostRoute {
  useSearch: () => { tab?: string };
  useNavigate: () => (opts: {
    search: (prev: Record<string, unknown>) => Record<string, unknown>;
    replace?: boolean;
  }) => void;
}

export function useTabSearchParam<TKey extends string>(
  route: TabHostRoute,
  defaultKey: TKey
): { tab: TKey; onTabChange: (key: Key) => void } {
  const search = route.useSearch();
  const navigate = route.useNavigate();

  const onTabChange = useCallback(
    (key: Key) => {
      navigate({
        search: (prev) => ({ ...prev, tab: String(key) }),
        replace: true,
      });
    },
    [navigate]
  );

  return {
    tab: (search.tab as TKey | undefined) ?? defaultKey,
    onTabChange,
  };
}
