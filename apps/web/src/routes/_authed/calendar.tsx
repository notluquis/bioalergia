import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PAGE_CONTAINER } from "@/lib/styles";

// Calendar section layout - provides shared container for all calendar pages
export const Route = createFileRoute("/_authed/calendar")({
  component: CalendarLayout,
});

function CalendarLayout() {
  return (
    <div className={PAGE_CONTAINER}>
      <Outlet />
    </div>
  );
}
