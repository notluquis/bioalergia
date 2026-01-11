import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const PersonManagementPage = lazy(() => import("@/features/users/pages/PersonManagementPage"));

export const Route = createFileRoute("/_authed/settings/people")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Person")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <PersonManagementPage />
    </Suspense>
  ),
});
