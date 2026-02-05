import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PAGE_CONTAINER } from "@/lib/styles";

// Certificates section layout
export const Route = createFileRoute("/_authed/certificates")({
  component: CertificatesLayout,
});

function CertificatesLayout() {
  return (
    <div className={PAGE_CONTAINER}>
      {/* No navigation tabs for now - single page */}
      <div className="space-y-6">
        <header>
          <h1 className="font-bold text-2xl text-foreground">Certificados Médicos</h1>
          <p className="mt-1 text-foreground-500 text-sm">
            Genera certificados médicos con firma digital FEA
          </p>
        </header>

        {/* Content rendered by child routes */}
        <Outlet />
      </div>
    </div>
  );
}
