import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const AddUserPage = lazy(() => import("@/pages/admin/AddUserPage"));

export const Route = createFileRoute("/_authed/settings/users/add")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("create", "User")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <AddUserPage />
    </Suspense>
  ),
});
