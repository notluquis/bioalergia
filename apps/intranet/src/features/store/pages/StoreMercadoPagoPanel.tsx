import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { lazy, Suspense } from "react";

const MercadoPagoSettingsPage = lazy(() =>
  import("@/pages/settings/MercadoPagoSettingsPage").then((m) => ({
    default: m.MercadoPagoSettingsPage,
  }))
);

/**
 * `/store?tab=mercadopago` panel — was `/settings/mercadopago`.
 *
 * Lazy-loaded (the original route did the same — keeps the 1MB+ payment
 * integration bundle off the initial /store load).
 */
export function StoreMercadoPagoPanel() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner label="Cargando MercadoPago" />
        </div>
      }
    >
      <MercadoPagoSettingsPage />
    </Suspense>
  );
}
