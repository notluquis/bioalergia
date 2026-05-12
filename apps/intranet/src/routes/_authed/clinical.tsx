import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PAGE_CONTAINER } from "@/lib/styles";

export const Route = createFileRoute("/_authed/clinical")({
  component: ClinicalLayout,
});

function ClinicalLayout() {
  return (
    <div className={PAGE_CONTAINER}>
      <Outlet />
    </div>
  );
}
