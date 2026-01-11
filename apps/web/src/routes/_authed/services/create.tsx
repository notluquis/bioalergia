import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const CreateServicePage = lazy(() => import("@/features/services/pages/CreateServicePage"));

export const Route = createFileRoute("/_authed/services/create")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("create", "Service")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CreateServicePage />
    </Suspense>
  ),
});
