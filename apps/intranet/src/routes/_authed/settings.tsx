import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PAGE_CONTAINER } from "@/lib/styles";

// Settings section layout
export const Route = createFileRoute("/_authed/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <div className={PAGE_CONTAINER}>
      <Outlet />
    </div>
  );
}
