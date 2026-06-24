import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { requirePermission } from "@/lib/authz/route-guards";
import { OrdersManager } from "@/features/occupational-testing/components/OrdersManager";
import { PAGE_CONTAINER } from "@/lib/styles";

// Salud ocupacional stage-C — resultado INDIVIDUAL (compliance-by-design).
// El backend gatea estos procedimientos sobre el subject clínico
// `ImmunotherapyAdministration` (PHI): el resultado individual es dato sensible
// de salud. El empleador NUNCA accede a esta superficie.
export const Route = createFileRoute("/_authed/settings/occupational-testing")({
  staticData: {
    nav: {
      iconKey: "ClipboardList",
      label: "Testeo ocupacional (individual)",
      order: 91,
      section: "Sistema",
    },
    permission: { action: "read", subject: "ImmunotherapyAdministration" },
    title: "Configuración — Testeo ocupacional individual",
  },
  beforeLoad: requirePermission("read", "ImmunotherapyAdministration"),
  component: OccupationalTestingPage,
});

function OccupationalTestingPage() {
  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-semibold text-xl">
            <ClipboardList size={22} /> Testeo ocupacional individual
          </h1>
          <p className="text-default-500 text-sm">
            Resultado individual de testeo de drogas/alcohol (stage-C, compliance por diseño).
            Sujeto pseudónimo, cadena de custodia append-only, confirmación GC-MS obligatoria y
            divulgación al empleador gateada por consentimiento.
          </p>
        </div>
      </div>

      <OrdersManager />
    </div>
  );
}
