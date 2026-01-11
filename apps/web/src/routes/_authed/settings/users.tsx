import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const UserManagementPage = lazy(() => import("@/features/users/pages/UserManagementPage"));

export const Route = createFileRoute("/_authed/settings/users")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "User")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <UserManagementPage />
    </Suspense>
  ),
});
