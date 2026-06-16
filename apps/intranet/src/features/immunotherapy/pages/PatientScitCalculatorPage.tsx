import { Button } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, FileText, Save } from "lucide-react";
import { useCallback, useState } from "react";
import { PAGE_CONTAINER } from "@/lib/styles";
import { toast } from "@/lib/toast-interceptor";
import { createScitPrescription } from "../api";
import { CalculatorSCIT } from "../components/CalculatorSCIT";
import { ScitPrescriptionList } from "../components/ScitPrescriptionList";
import { getAllergenById } from "../data/allergens_db";
import type { DoctorSelection, ScitCalculationResult } from "../data/types";
import { immunoKeys } from "../queries";

const routeApi = getRouteApi("/_authed/patients/$id/scit-calculator");

/**
 * Calculadora SCIT en el contexto de un paciente: el resultado (viales/dosis) se
 * guarda como prescripción (ScitPrescription) y puede precargar el presupuesto.
 */
export function PatientScitCalculatorPage() {
  const { id } = routeApi.useParams();
  const patientId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [snapshot, setSnapshot] = useState<{
    selection: DoctorSelection;
    result: ScitCalculationResult;
  } | null>(null);

  const handleChange = useCallback((selection: DoctorSelection, result: ScitCalculationResult) => {
    setSnapshot({ selection, result });
  }, []);

  const hasResult = (snapshot?.result.vials.length ?? 0) > 0;

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!snapshot) throw new Error("No hay cálculo para guardar");
      const { selection, result } = snapshot;
      return createScitPrescription({
        patientId,
        provider: selection.provider,
        inputs: selection,
        vials: result.vials,
        alerts: result.alerts.length > 0 ? result.alerts : undefined,
        rulesApplied: result.rulesApplied,
        summary: result.summary || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Prescripción SCIT guardada");
      void queryClient.invalidateQueries({
        queryKey: immunoKeys.scitPrescriptions(patientId),
      });
      void queryClient.invalidateQueries({ queryKey: ["patient", id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la prescripción");
    },
  });

  const goToBudget = () => {
    // Precarga por id de catálogo (alg_*): calc y presupuesto comparten el mismo
    // espacio de ids (ClinicalAllergen). Las mezclas aportan sus componentes.
    const prefillIds = (snapshot?.selection.selectedAllergenIds ?? [])
      .flatMap((aid) => {
        const a = getAllergenById(aid);
        if (!a) return [];
        if (a.catalogId) return [a.catalogId];
        return a.componentCatalogIds ?? [];
      })
      .join(",");
    void navigate({
      to: "/patients/$id/immunotherapy-budget",
      params: { id: String(id) },
      search: { prefillIds: prefillIds || undefined },
    });
  };

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          className="gap-2"
          onPress={() => navigate({ to: "/patients/$id", params: { id: String(id) } })}
        >
          <ChevronLeft size={18} />
          Volver
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" isDisabled={!hasResult} onPress={goToBudget}>
            <FileText size={16} />
            Crear presupuesto
          </Button>
          <Button
            className="gap-2"
            isDisabled={!hasResult || saveMutation.isPending}
            onPress={() => saveMutation.mutate()}
          >
            <Save size={16} />
            {saveMutation.isPending ? "Guardando…" : "Guardar prescripción"}
          </Button>
        </div>
      </div>

      <CalculatorSCIT onChange={handleChange} />

      <div className="mt-8 border-default-100 border-t pt-6">
        <h2 className="mb-3 font-semibold text-foreground text-sm">Prescripciones guardadas</h2>
        <ScitPrescriptionList patientId={patientId} />
      </div>
    </div>
  );
}
