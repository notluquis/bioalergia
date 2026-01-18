import { Outlet } from "@tanstack/react-router";

import { PAGE_CONTAINER } from "@/lib/styles";

export default function CalendarLayout() {
  return (
    <div className={PAGE_CONTAINER}>
      <Outlet />
    </div>
  );
}
