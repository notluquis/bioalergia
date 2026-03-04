import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const AccountSettingsPage = lazy(() =>
  import("@/pages/AccountSettingsPage").then((m) => ({ default: m.AccountSettingsPage })),
);

// Account page - accessible to all authenticated users (no permission required)
export const Route = createFileRoute("/_authed/account")({
  component: () => (
    <Suspense fallback={null}>
      <AccountSettingsPage />
    </Suspense>
  ),
});
