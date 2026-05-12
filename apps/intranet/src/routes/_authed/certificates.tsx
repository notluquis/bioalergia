import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PAGE_CONTAINER } from "@/lib/styles";

// Certificates section layout
export const Route = createFileRoute("/_authed/certificates")({
  component: CertificatesLayout,
});

function CertificatesLayout() {
  return (
    <div className={PAGE_CONTAINER}>
      <Outlet />
    </div>
  );
}
