import { createFileRoute } from "@tanstack/react-router";
import { Stethoscope } from "lucide-react";
import { requirePermission } from "@/lib/authz/route-guards";
import { ProgramsManager } from "@/features/occupational/components/ProgramsManager";
import { PAGE_CONTAINER } from "@/lib/styles";

// El backend gatea estos procedimientos sobre el subject `ReactivoLead`
// (mismo staff comercial gestiona ambos tipos de lead/programa B2B).
export const Route = createFileRoute("/_authed/settings/occupational")({
  staticData: {
    nav: {
      iconKey: "Stethoscope",
      label: "Salud ocupacional",
      order: 90,
      section: "Sistema",
    },
    permission: { action: "read", subject: "ReactivoLead" },
    title: "Configuración — Salud ocupacional",
  },
  beforeLoad: requirePermission("read", "ReactivoLead"),
  component: OccupationalPage,
});

function OccupationalPage() {
  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-semibold text-xl">
            <Stethoscope size={22} /> Salud ocupacional
          </h1>
          <p className="text-default-500 text-sm">
            Programas de testeo de drogas/alcohol B2B con gate de atestación RIOHS y resultados
            agregados (sin datos individuales del trabajador).
          </p>
        </div>
      </div>

      <ProgramsManager />
    </div>
  );
}
