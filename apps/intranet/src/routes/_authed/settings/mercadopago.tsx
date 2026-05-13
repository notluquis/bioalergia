import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const MercadoPagoSettingsPage = lazy(() =>
  import("@/pages/settings/MercadoPagoSettingsPage").then((m) => ({
    default: m.MercadoPagoSettingsPage,
  }))
);

export const Route = createFileRoute("/_authed/settings/mercadopago")({
  staticData: {
    nav: { iconKey: "CreditCard", label: "MercadoPago", order: 60, section: "Sistema" },
    permission: { action: "read", subject: "Integration" },
    title: "Configuración — MercadoPago",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Integration")) {
      const routeApi = getRouteApi("/_authed/settings/mercadopago");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner label="Cargando MercadoPago" />
        </div>
      }
    >
      <MercadoPagoSettingsPage />
    </Suspense>
  ),
});
