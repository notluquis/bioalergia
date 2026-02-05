import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader";

const AccountSettingsPage = lazy(() =>
  import("@/pages/AccountSettingsPage").then((m) => ({ default: m.AccountSettingsPage })),
);

// Account page - accessible to all authenticated users (no permission required)
export const Route = createFileRoute("/_authed/account")({
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <AccountSettingsPage />
    </Suspense>
  ),
});
