import { useFindManyCounterpart } from "@finanzas/db/hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Suspense, useState } from "react";

import type { Counterpart, CounterpartCategory, CounterpartPersonType } from "@/features/counterparts/types";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  attachCounterpartRut,
  type CounterpartUpsertPayload,
  createCounterpart,
  updateCounterpart,
} from "@/features/counterparts/api";
import CounterpartForm from "@/features/counterparts/components/CounterpartForm";
import CounterpartList from "@/features/counterparts/components/CounterpartList";
import { SUMMARY_RANGE_MONTHS } from "@/features/counterparts/constants";
import { counterpartKeys } from "@/features/counterparts/queries";
import { ServicesGrid, ServicesHero, ServicesSurface } from "@/features/services/components/ServicesShell";
import { getPersonFullName } from "@/lib/person";
import { normalizeRut } from "@/lib/rut";

import CounterpartDetailSection from "../components/CounterpartDetailSection";

export default function CounterpartsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<null | number>(null);

  const canCreate = can("create", "Counterpart");
  const canUpdate = can("update", "Counterpart");
  const [error, setError] = useState<null | string>(null);

  const [summaryRange, setSummaryRange] = useState<{ from: string; to: string }>(() => ({
    from: dayjs().subtract(SUMMARY_RANGE_MONTHS, "month").startOf("month").format("YYYY-MM-DD"),
    to: dayjs().endOf("month").format("YYYY-MM-DD"),
  }));
  const { error: toastError, info: toastInfo, success: toastSuccess } = useToast();
  const [personTypeFilter, setPersonTypeFilter] = useState<"ALL" | CounterpartPersonType>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | CounterpartCategory>("ALL");
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formCounterpart, setFormCounterpart] = useState<Counterpart | null>(null);

  const openFormModal = (target: Counterpart | null = null) => {
    setFormCounterpart(target);
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setFormCounterpart(null);
  };

  // ZenStack hook for list query
  const { data: counterpartsData, error: listError } = useFindManyCounterpart({
    include: { person: true },
  });

  // Transform ZenStack data to match frontend Counterpart type
  type ZenStackCounterpart = NonNullable<typeof counterpartsData>[number];
  const counterparts: Counterpart[] = (counterpartsData ?? []).map((row: ZenStackCounterpart) => {
    const person = (
      row as {
        person?: {
          email?: null | string;
          fatherName?: null | string;
          motherName?: null | string;
          names?: string;
          personType?: string;
          rut?: string;
        };
      }
    ).person;
    return {
      category: row.category as Counterpart["category"],
      created_at: (row as { createdAt?: Date }).createdAt?.toISOString() ?? new Date().toISOString(),
      email: person?.email ?? null,
      employeeId: null,
      id: row.id,
      name: person
        ? getPersonFullName(person as { fatherName?: null | string; motherName?: null | string; names: string })
        : "Sin nombre",
      notes: row.notes ?? null,
      personType: (person?.personType ?? "NATURAL") as Counterpart["personType"],
      rut: person?.rut ?? null,
      updated_at: (row as { updatedAt?: Date }).updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  });

  // Derived error state (combine/prioritize)
  const displayError = error || (listError instanceof Error ? listError.message : null);

  // Use REST API mutations (they handle Person+Counterpart relationship correctly)
  const createMutation = useMutation({
    mutationFn: createCounterpart,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["Counterpart"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CounterpartUpsertPayload> }) =>
      updateCounterpart(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["Counterpart"] });
      // Detail invalidation handled by key factory invalidation if needed, or exact key match
      if (selectedId) {
        void queryClient.invalidateQueries({ queryKey: counterpartKeys.detail(selectedId).queryKey });
      }
    },
  });

  async function handleSaveCounterpart(payload: CounterpartUpsertPayload) {
    setError(null);
    const normalizedRut = normalizeRut(payload.rut ?? null);

    try {
      if (!payload.name) throw new Error("El nombre es obligatorio");

      let savedId = selectedId;
      let isNew = false;

      if (selectedId) {
        await updateMutation.mutateAsync({ id: selectedId, payload });
        toastSuccess("Contraparte actualizada correctamente");
      } else {
        const result = await createMutation.mutateAsync(payload);
        savedId = result.counterpart.id;
        isNew = true;
        toastSuccess("Contraparte creada correctamente");
      }

      setSelectedId(savedId);
      setIsFormModalOpen(false);

      // Handle RUT attachment auto-logic
      if (savedId && normalizedRut && isNew) {
        try {
          await attachCounterpartRut(savedId, normalizedRut);
          void queryClient.invalidateQueries({ queryKey: ["counterpart"] });
          toastInfo("Cuentas detectadas vinculadas automáticamente");
        } catch (attachError) {
          console.warn("Auto-attach failed", attachError);
        }
      }
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : "Error al guardar contraparte";
      setError(message);
      toastError(message);
    }
  }

  const handleSelectCounterpart = (id: null | number) => {
    setSelectedId(id);
  };

  const handleSummaryRangeChange = (update: Partial<{ from: string; to: string }>) => {
    setSummaryRange((prev) => ({ ...prev, ...update }));
  };

  const PERSON_FILTERS: { label: string; value: "ALL" | CounterpartPersonType }[] = [
    { label: "Todas las personas", value: "ALL" },
    { label: "Persona natural", value: "NATURAL" },
    { label: "Empresa", value: "JURIDICAL" },
  ];
  const CATEGORY_FILTERS: { label: string; value: "ALL" | CounterpartCategory }[] = [
    { label: "Todos los tipos", value: "ALL" },
    { label: "Proveedores", value: "SUPPLIER" },
    { label: "Prestamistas", value: "LENDER" },
    { label: "Clientes", value: "CLIENT" },
    { label: "Empleados", value: "EMPLOYEE" },
    { label: "Ocasionales", value: "OCCASIONAL" },
  ];

  const deduplicatedCounterparts = (() => {
    const map = new Map<string, Counterpart>();
    for (const item of counterparts) {
      const rutKey = item.rut ? normalizeRut(item.rut) : null;
      const nameKey = item.name.trim().toLowerCase();
      const key = (rutKey ?? nameKey) || item.id.toString();
      if (!map.has(key)) {
        map.set(key, item);
      }
    }
    return [...map.values()];
  })();

  const visibleCounterparts = deduplicatedCounterparts.filter((item) => {
    const matchesPersonType = personTypeFilter === "ALL" || item.personType === personTypeFilter;
    const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
    return matchesPersonType && matchesCategory;
  });

  return (
    <section className="space-y-8">
      <ServicesHero
        actions={
          canCreate ? (
            <Button
              onClick={() => {
                openFormModal(null);
              }}
            >
              + Nueva contraparte
            </Button>
          ) : null
        }
        description="Gestiona proveedores, prestamistas y clientes con sus cuentas asociadas y movimientos históricos."
        title="Contrapartes"
      />
      <ServicesSurface>
        <div className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base-content/60 text-xs font-semibold tracking-[0.4em] uppercase">Filtros rápidos</p>
              <p className="text-base-content/70 text-sm">Acota la lista por tipo de persona y clasificación.</p>
            </div>
            <Button
              onClick={() => {
                setPersonTypeFilter("ALL");
                setCategoryFilter("ALL");
              }}
              size="sm"
              variant="ghost"
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
                    onClick={() => {
                      setPersonTypeFilter(filter.value);
                    }}
                    size="sm"
                    variant={personTypeFilter === filter.value ? "primary" : "ghost"}
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
                    onClick={() => {
                      setCategoryFilter(filter.value);
                    }}
                    size="sm"
                    variant={categoryFilter === filter.value ? "primary" : "ghost"}
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
            className="max-h-[calc(100vh-220px)]"
            counterparts={visibleCounterparts}
            onSelectCounterpart={handleSelectCounterpart}
            selectedId={selectedId}
          />
        </ServicesSurface>

        <div className="h-full">
          {!selectedId && (
            <ServicesSurface className="h-full">
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <p className="text-base-content/60 text-sm">Selecciona una contraparte para ver los detalles</p>
              </div>
            </ServicesSurface>
          )}

          {selectedId && (
            <Suspense
              fallback={
                <ServicesSurface className="space-y-4">
                  <Skeleton className="h-8 w-1/2" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </ServicesSurface>
              }
            >
              <CounterpartDetailSection
                canUpdate={canUpdate}
                counterpartId={selectedId}
                onEdit={openFormModal}
                onSummaryRangeChange={handleSummaryRangeChange}
                summaryRange={summaryRange}
              />
            </Suspense>
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
          error={error ?? displayError}
          onSave={handleSaveCounterpart}
          saving={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>
    </section>
  );
}
