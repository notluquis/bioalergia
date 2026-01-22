import { createFileRoute } from "@tanstack/react-router";

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
          <h1 className="text-2xl font-bold text-foreground">Certificados Médicos</h1>
          <p className="text-foreground-500 text-sm mt-1">
            Genera certificados médicos con firma digital FEA
          </p>
        </header>

        {/* Content rendered by child routes */}
        <div>{/* Placeholder - will be replaced by medical.tsx */}</div>
      </div>
    </div>
  );
}
