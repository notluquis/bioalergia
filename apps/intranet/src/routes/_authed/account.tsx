import { createFileRoute } from "@tanstack/react-router";

import { AccountSettingsPage } from "@/pages/AccountSettingsPage";

// Account page - accessible to all authenticated users (no permission required)
export const Route = createFileRoute("/_authed/account")({
  component: AccountSettingsPage,
});
