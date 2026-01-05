import { useCreateCounterpart, useFindManyCounterpart, useUpdateCounterpart } from "@finanzas/db/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/context/ToastContext";
import {
  attachCounterpartRut,
  type CounterpartUpsertPayload,
  fetchCounterpart,
  fetchCounterpartSummary,
} from "@/features/counterparts/api";
import AssociatedAccounts from "@/features/counterparts/components/AssociatedAccounts";
import CounterpartForm from "@/features/counterparts/components/CounterpartForm";
import CounterpartList from "@/features/counterparts/components/CounterpartList";
import { SUMMARY_RANGE_MONTHS } from "@/features/counterparts/constants";
import type { Counterpart, CounterpartCategory, CounterpartPersonType } from "@/features/counterparts/types";
import { ServicesGrid, ServicesHero, ServicesSurface } from "@/features/services/components/ServicesShell";
import { normalizeRut } from "@/lib/rut";

export default function CounterpartsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [summaryRange, setSummaryRange] = useState<{ from: string; to: string }>(() => ({
    from: dayjs().subtract(SUMMARY_RANGE_MONTHS, "month").startOf("month").format("YYYY-MM-DD"),
    to: dayjs().endOf("month").format("YYYY-MM-DD"),
  }));
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const [personTypeFilter, setPersonTypeFilter] = useState<CounterpartPersonType | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<CounterpartCategory | "ALL">("ALL");
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formCounterpart, setFormCounterpart] = useState<Counterpart | null>(null);

  const openFormModal = useCallback((target: Counterpart | null = null) => {
    setFormCounterpart(target);
    setIsFormModalOpen(true);
  }, []);

  const closeFormModal = useCallback(() => {
    setIsFormModalOpen(false);
    setFormCounterpart(null);
  }, []);

  // ZenStack hooks for counterparts
  const {
    data: counterpartsData,
    isLoading: listLoading,
    error: listError,
  } = useFindManyCounterpart({
    orderBy: { name: "asc" },
  });

  // Wrap counterparts in useMemo for stable reference
  const counterparts = useMemo(() => {
    return (counterpartsData as Counterpart[]) ?? [];
  }, [counterpartsData]);

  // Detail query for selected counterpart with accounts (using original API for complete data)
  const {
    data: detail,
    isLoading: detailLoading,
    error: detailError,
  } = useQuery({
    queryKey: ["counterpart-detail", selectedId],
    queryFn: () => fetchCounterpart(selectedId!),
    enabled: !!selectedId,
  });

  // Summary query (kept as manual since it's a custom aggregation endpoint)
  const { data: summary, error: summaryError } = useQuery({
    queryKey: ["counterpart-summary", selectedId, summaryRange],
    queryFn: () => fetchCounterpartSummary(selectedId!, summaryRange),
    enabled: !!selectedId,
  });

  // Derived error state (combine/prioritize)
  const displayError =
    error ||
    (listError instanceof Error ? listError.message : null) ||
    (detailError instanceof Error ? detailError.message : null) ||
    (summaryError instanceof Error ? summaryError.message : null);

  // ZenStack mutations
  const createMutation = useCreateCounterpart();
  const updateMutation = useUpdateCounterpart();

  async function handleSaveCounterpart(payload: CounterpartUpsertPayload) {
    setError(null);
    const normalizedRut = normalizeRut(payload.rut ?? null);
    const previousRut = normalizeRut(detail?.counterpart?.rut ?? null);

    try {
      if (!payload.name) throw new Error("El nombre es obligatorio");

      let savedId = selectedId;
      let isNew = false;

      if (selectedId) {
        await updateMutation.mutateAsync({
          where: { id: selectedId },
          data: {
            name: payload.name,
            rut: payload.rut,
            email: payload.email,
            category: payload.category,
            personType: payload.personType,
          },
        });
        toastSuccess("Contraparte actualizada correctamente");
      } else {
        const result = await createMutation.mutateAsync({
          name: payload.name,
          rut: payload.rut,
          email: payload.email,
          category: payload.category,
          personType: payload.personType,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        savedId = (result as any)?.id;
        isNew = true;
        toastSuccess("Contraparte creada correctamente");
      }

      setSelectedId(savedId);
      setIsFormModalOpen(false);

      // Handle RUT attachment auto-logic
      if (savedId && normalizedRut && (isNew || normalizedRut !== previousRut)) {
        try {
          await attachCounterpartRut(savedId, normalizedRut);
          queryClient.invalidateQueries({ queryKey: ["counterpart"] });
          toastInfo("Cuentas detectadas vinculadas automáticamente");
        } catch (attachError) {
          console.warn("Auto-attach failed", attachError);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al guardar contraparte";
      setError(message);
      toastError(message);
    }
  }

  const handleSelectCounterpart = useCallback((id: number | null) => {
    setSelectedId(id);
  }, []);

  const handleSummaryRangeChange = useCallback((update: Partial<{ from: string; to: string }>) => {
    setSummaryRange((prev) => ({ ...prev, ...update }));
  }, []);

  const PERSON_FILTERS: Array<{ label: string; value: CounterpartPersonType | "ALL" }> = [
    { label: "Todas las personas", value: "ALL" },
    { label: "Persona natural", value: "NATURAL" },
    { label: "Empresa", value: "JURIDICAL" },
  ];
  const CATEGORY_FILTERS: Array<{ label: string; value: CounterpartCategory | "ALL" }> = [
    { label: "Todos los tipos", value: "ALL" },
    { label: "Proveedores", value: "SUPPLIER" },
    { label: "Prestamistas", value: "LENDER" },
    { label: "Clientes", value: "CLIENT" },
    { label: "Empleados", value: "EMPLOYEE" },
    { label: "Ocasionales", value: "OCCASIONAL" },
  ];

  const deduplicatedCounterparts = useMemo(() => {
    const map = new Map<string, Counterpart>();
    for (const item of counterparts) {
      const rutKey = item.rut ? normalizeRut(item.rut) : null;
      const nameKey = item.name.trim().toLowerCase();
      const key = (rutKey ?? nameKey) || item.id.toString();
      if (!map.has(key)) {
        map.set(key, item);
      }
    }
    return Array.from(map.values());
  }, [counterparts]);

  const visibleCounterparts = useMemo(() => {
    return deduplicatedCounterparts.filter((item) => {
      const matchesPersonType = personTypeFilter === "ALL" || item.personType === personTypeFilter;
      const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
      return matchesPersonType && matchesCategory;
    });
  }, [deduplicatedCounterparts, personTypeFilter, categoryFilter]);

  return (
    <section className="space-y-8">
      <ServicesHero
        title="Contrapartes"
        description="Gestiona proveedores, prestamistas y clientes con sus cuentas asociadas y movimientos históricos."
        actions={<Button onClick={() => openFormModal(null)}>+ Nueva contraparte</Button>}
      />
      <ServicesSurface>
        <div className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base-content/60 text-xs font-semibold tracking-[0.4em] uppercase">Filtros rápidos</p>
              <p className="text-base-content/70 text-sm">Acota la lista por tipo de persona y clasificación.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPersonTypeFilter("ALL");
                setCategoryFilter("ALL");
              }}
            >
              Reset filtros
            </Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-base-content/60 text-xs font-semibold tracking-[0.3em] uppercase">Tipo de persona</p>
              <div className="flex flex-wrap gap-2">
                {PERSON_FILTERS.map((filter) => (
                  <Button
                    key={filter.value}
                    size="sm"
                    variant={personTypeFilter === filter.value ? "primary" : "ghost"}
                    onClick={() => setPersonTypeFilter(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-base-content/60 text-xs font-semibold tracking-[0.3em] uppercase">Clasificación</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_FILTERS.map((filter) => (
                  <Button
                    key={filter.value}
                    size="sm"
                    variant={categoryFilter === filter.value ? "primary" : "ghost"}
                    onClick={() => setCategoryFilter(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ServicesSurface>

      <ServicesGrid>
        <ServicesSurface className="h-full">
          <CounterpartList
            counterparts={visibleCounterparts}
            selectedId={selectedId}
            onSelectCounterpart={handleSelectCounterpart}
            className="max-h-[calc(100vh-220px)]"
          />
        </ServicesSurface>

        <div className="space-y-6">
          <ServicesSurface className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base-content/60 text-xs tracking-[0.3em] uppercase">Contraparte activa</p>
                <h3 className="text-base-content text-lg font-semibold">
                  {detail?.counterpart.name ?? "Selecciona un registro"}
                </h3>
                {detail?.counterpart.rut && (
                  <p className="text-base-content/70 text-xs">RUT {detail.counterpart.rut}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={!detail}
                onClick={() => detail && openFormModal(detail.counterpart)}
              >
                {detail ? "Editar contraparte" : "Selecciona para editar"}
              </Button>
            </div>
            {detail ? (
              <div className="text-base-content/70 grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <p className="text-base-content/60 font-semibold">Clasificación</p>
                  <p className="text-base-content text-sm">{detail.counterpart.category ?? "—"}</p>
                </div>
                <div>
                  <p className="text-base-content/60 font-semibold">Tipo de persona</p>
                  <p className="text-base-content text-sm">{detail.counterpart.personType}</p>
                </div>
                {detail.counterpart.email && (
                  <div className="sm:col-span-2">
                    <p className="text-base-content/60 font-semibold">Correo electrónico</p>
                    <p className="text-base-content text-sm">{detail.counterpart.email}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="border-base-300 bg-base-200/70 text-base-content/70 rounded-2xl border border-dashed p-6 text-xs">
                Haz clic en una contraparte para ver sus cuentas activas, movimientos y opciones rápidas.
              </div>
            )}
          </ServicesSurface>

          {selectedId && detail && (
            <AssociatedAccounts
              selectedId={selectedId}
              detail={detail}
              summary={summary ?? null}
              summaryRange={summaryRange}
              onSummaryRangeChange={handleSummaryRangeChange}
            />
          )}
        </div>
      </ServicesGrid>
      <Modal
        isOpen={isFormModalOpen}
        onClose={closeFormModal}
        title={formCounterpart ? "Editar contraparte" : "Nueva contraparte"}
      >
        <CounterpartForm
          counterpart={formCounterpart}
          onSave={handleSaveCounterpart}
          error={error ?? displayError}
          saving={createMutation.isPending || updateMutation.isPending}
          loading={listLoading || detailLoading}
        />
      </Modal>
    </section>
  );
}
