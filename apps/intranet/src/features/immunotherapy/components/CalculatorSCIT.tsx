import { Card, Chip, RadioGroup, Radio } from "@heroui/react";
import { Calculator, FlaskConical, Syringe } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAllergenById } from "../data/allergens_db";
import type { ClinicalRelevanceMode, DoctorSelection, Provider } from "../data/types";
import { useScitCalculator } from "../hooks/useScitCalculator";
import { AllergenSelector } from "./AllergenSelector";
import { ClinicalAlerts } from "./ClinicalAlerts";
import { RelevanceSelector } from "./RelevanceSelector";
import { VialCard } from "./VialCard";

export function CalculatorSCIT() {
  const [provider, setProvider] = useState<Provider>("inmunotek");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [relevanceMode, setRelevanceMode] = useState<ClinicalRelevanceMode | undefined>();
  const [dominantId, setDominantId] = useState<string | undefined>();

  // ── Derived state ──────────────────────────────────────────────────────
  const nonProteolyticIds = useMemo(
    () =>
      selectedIds.filter((id) => {
        const a = getAllergenById(id);
        return a && !a.isProteolytic;
      }),
    [selectedIds]
  );

  const needsRelevanceChoice = nonProteolyticIds.length >= 2 && nonProteolyticIds.length <= 3;

  // Reset relevance/dominant when selection changes structurally
  useEffect(() => {
    if (!needsRelevanceChoice) {
      setRelevanceMode(undefined);
      setDominantId(undefined);
    }
  }, [needsRelevanceChoice]);

  // Reset dominant if the dominant allergen was removed
  useEffect(() => {
    if (dominantId && !nonProteolyticIds.includes(dominantId)) {
      setDominantId(undefined);
    }
  }, [dominantId, nonProteolyticIds]);

  // ── Selection object for the rules engine ──────────────────────────────
  const selection = useMemo<DoctorSelection>(
    () => ({
      selectedAllergenIds: selectedIds,
      provider,
      relevanceMode,
      dominantAllergenId: dominantId,
    }),
    [selectedIds, provider, relevanceMode, dominantId]
  );

  const result = useScitCalculator(selection);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleAdd = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const handleRemove = useCallback((id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  // ── Compute selected allergens for display ─────────────────────────────

  return (
    <div className="space-y-6">
      {/* ════════════════════════════════════════════════════════════════════
           HEADER
         ════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Calculator size={22} />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-xl tracking-tight">Calculadora SCIT</h1>
            <p className="text-default-500 text-sm">
              Selector de alérgenos y dosificación por microgramos
            </p>
          </div>
          <Chip color="accent" size="sm" variant="soft">
            v1.0
          </Chip>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
           STEP 1: PROVIDER SELECTOR
         ════════════════════════════════════════════════════════════════════ */}
      <Card className="p-5">
        <Card.Header className="p-0 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary text-xs">
              1
            </span>
            <Card.Title className="text-base">Seleccionar laboratorio</Card.Title>
          </div>
          <Card.Description className="mt-1 text-xs">
            El algoritmo de dosificación varía según la formulación del fabricante.
          </Card.Description>
        </Card.Header>
        <Card.Content className="p-0">
          <RadioGroup
            orientation="horizontal"
            value={provider}
            onChange={(e) => setProvider(e as unknown as Provider)}
            className="gap-4 flex-row"
          >
            <Radio
              value="inmunotek"
              className="cursor-pointer rounded-xl border border-default-200 p-3 transition-all data-[selected=true]:border-primary data-[selected=true]:bg-primary/5"
            >
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <Radio.Content>
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-sm">Inmunotek</span>
                  <span className="text-default-500 text-xs">Alutek, Clustek, Modigoid</span>
                </div>
              </Radio.Content>
            </Radio>
            <Radio
              value="diater"
              className="cursor-pointer rounded-xl border border-default-200 p-3 transition-all data-[selected=true]:border-primary data-[selected=true]:bg-primary/5"
            >
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <Radio.Content>
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-sm">Diater</span>
                  <span className="text-default-500 text-xs">Moleculares, Polymerized</span>
                </div>
              </Radio.Content>
            </Radio>
            <Radio
              value="roxall"
              className="cursor-pointer rounded-xl border border-default-200 p-3 transition-all data-[selected=true]:border-primary data-[selected=true]:bg-primary/5"
            >
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <Radio.Content>
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-sm">Roxall</span>
                  <span className="text-default-500 text-xs">Cluxin, Modigoid</span>
                </div>
              </Radio.Content>
            </Radio>
          </RadioGroup>
        </Card.Content>
      </Card>

      {/* ════════════════════════════════════════════════════════════════════
           STEP 2: ALLERGEN SELECTOR
         ════════════════════════════════════════════════════════════════════ */}
      <Card className="p-5">
        <Card.Header className="p-0 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary text-xs">
              2
            </span>
            <Card.Title className="text-base">Seleccionar alérgenos</Card.Title>
          </div>
          <Card.Description className="mt-1 text-xs">
            Agregue los alérgenos del paciente. Máximo recomendado: 3 por frasco.
          </Card.Description>
        </Card.Header>
        <Card.Content className="p-0">
          <AllergenSelector selectedIds={selectedIds} onAdd={handleAdd} onRemove={handleRemove} />
        </Card.Content>
      </Card>

      {/* ════════════════════════════════════════════════════════════════════
           STEP 3: RELEVANCE SELECTOR (condicional)
         ════════════════════════════════════════════════════════════════════ */}
      {needsRelevanceChoice && provider !== "diater" && (
        <Card className="p-5">
          <Card.Header className="p-0 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-lg bg-warning/10 font-semibold text-warning text-xs">
                3
              </span>
              <Card.Title className="text-base">Relevancia clínica</Card.Title>
            </div>
            <Card.Description className="mt-1 text-xs">
              ¿Los alérgenos tienen la misma severidad o hay uno dominante?
            </Card.Description>
          </Card.Header>
          <Card.Content className="p-0">
            <RelevanceSelector
              allergenIds={nonProteolyticIds}
              relevanceMode={relevanceMode}
              dominantAllergenId={dominantId}
              onRelevanceModeChange={setRelevanceMode}
              onDominantChange={setDominantId}
            />
          </Card.Content>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════
           RESULTS: CLINICAL ALERTS
         ════════════════════════════════════════════════════════════════════ */}
      {result.alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="flex items-center gap-2 font-semibold text-foreground text-sm">
            <span className="flex size-6 items-center justify-center rounded-lg bg-danger/10 font-semibold text-danger text-xs">
              !
            </span>
            Alertas clínicas
          </h2>
          <ClinicalAlerts alerts={result.alerts} />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
           RESULTS: VIAL CARDS
         ════════════════════════════════════════════════════════════════════ */}
      {result.vials.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold text-foreground text-sm">
              <span className="flex size-6 items-center justify-center rounded-lg bg-success/10 font-semibold text-success text-xs">
                <FlaskConical size={12} />
              </span>
              Prescripción recomendada
            </h2>
            {result.rulesApplied.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.rulesApplied.map((rule) => (
                  <Chip key={rule} size="sm" variant="soft" color="default">
                    {rule}
                  </Chip>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {result.vials.map((vial, idx) => (
              <VialCard key={vial.vialNumber} vial={vial} index={idx} />
            ))}
          </div>

          {/* ── Summary ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 rounded-xl border border-default-100 bg-default-50 p-3 text-default-600 text-sm">
            <Syringe size={16} className="shrink-0 text-primary" />
            <p>{result.summary}</p>
          </div>

          {/* ── Venom notice ────────────────────────────────────────────── */}
          <p className="text-default-400 text-xs italic">
            Nota: Las dosis de venenos de himenópteros (abeja/avispa) se calculan en 100 μg
            estandarizados y no aplican las reglas SCIT convencionales mostradas aquí. Ventana
            terapéutica EAACI: 5–20 μg por inyección.
          </p>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {selectedIds.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-default-100 border-dashed py-16 text-default-300">
          <FlaskConical size={40} strokeWidth={1.5} />
          <p className="text-center text-sm">
            Seleccione alérgenos para generar la prescripción de frascos
          </p>
        </div>
      )}
    </div>
  );
}
