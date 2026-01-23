import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import type { AuthContextType } from "@/context/AuthContext";

// Lazy load devtools for development only
const TanStackRouterDevtools =
  process.env.NODE_ENV === "production"
    ? () => null
    : lazy(() =>
        import("@tanstack/router-devtools").then((res) => ({
          default: res.TanStackRouterDevtools,
        })),
      );

import type { NavConfig, RoutePermission } from "@/types/navigation";

// Extend the router's static data interface
declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    nav?: NavConfig;
    permission?: RoutePermission;
    title?: string;
    hideFromNav?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    breadcrumb?: string | ((data: any) => string);
  }
}

// Router Context - shared across all routes
export interface RouterContext {
  auth: AuthContextType;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <Outlet />
      <Suspense>
        <TanStackRouterDevtools position="bottom-right" />
      </Suspense>
    </>
  );
}
