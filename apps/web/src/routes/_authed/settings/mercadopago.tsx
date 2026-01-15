import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const MercadoPagoSettingsPage = lazy(() => import("@/pages/settings/MercadoPagoSettingsPage"));

export const Route = createFileRoute("/_authed/settings/mercadopago")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Integration")) {
      const routeApi = getRouteApi("/_authed/settings/mercadopago");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <MercadoPagoSettingsPage />
    </Suspense>
  ),
});
