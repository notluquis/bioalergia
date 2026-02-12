import { schema as schemaLite } from "@finanzas/db/schema-lite";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useClientQueries } from "@zenstackhq/tanstack-query/react";
import dayjs from "dayjs";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  attachCounterpartRut,
  type CounterpartUpsertPayload,
  createCounterpart,
  updateCounterpart,
} from "@/features/counterparts/api";
import { CounterpartForm } from "@/features/counterparts/components/CounterpartForm";
import { CounterpartList } from "@/features/counterparts/components/CounterpartList";
import { SUMMARY_RANGE_MONTHS } from "@/features/counterparts/constants";
import { counterpartKeys } from "@/features/counterparts/queries";
import type { Counterpart, CounterpartCategory } from "@/features/counterparts/types";
import {
  ServicesGrid,
  ServicesHero,
  ServicesSurface,
} from "@/features/services/components/ServicesShell";
import { CounterpartDetailSection } from "../components/CounterpartDetailSection";

export function CounterpartsPage() {
  const client = useClientQueries(schemaLite);

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
  const { data: counterpartsData, error: listError } = client.counterpart.useFindMany({
    include: {
      accounts: true,
      withdrawTransactions: true,
      releaseTransactions: true,
      settlementTransactions: true,
    },
  });

  // Transform ZenStack data to match frontend Counterpart type
  const counterparts: Counterpart[] = (counterpartsData ?? []).map((row) => ({
    id: row.id,
    identificationNumber: row.identificationNumber,
    bankAccountHolder: row.bankAccountHolder,
    category: row.category,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  // Derived error state (combine/prioritize)
  const displayError = error || (listError instanceof Error ? listError.message : null);

  // Use REST API mutations
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
      // Detail invalidation
      if (selectedId) {
        void queryClient.invalidateQueries({
          queryKey: counterpartKeys.detail(selectedId).queryKey,
        });
      }
    },
  });

  async function handleSaveCounterpart(payload: CounterpartUpsertPayload) {
    setError(null);

    try {
      if (!payload.identificationNumber?.trim()) {
        throw new Error("El número de identificación es obligatorio");
      }

      if (!payload.bankAccountHolder?.trim()) {
        throw new Error("El titular de la cuenta es obligatorio");
      }

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

      // Handle RUT attachment auto-logic on new counterparts
      if (savedId && isNew && payload.identificationNumber) {
        try {
          await attachCounterpartRut(savedId, payload.identificationNumber);
          void queryClient.invalidateQueries({ queryKey: ["Counterpart"] });
          toastInfo("Cuentas detectadas vinculadas automáticamente");
        } catch {
          // Auto-attach failed, silently continue
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

  const CATEGORY_FILTERS: { label: string; value: "ALL" | CounterpartCategory }[] = [
    { label: "Todos los tipos", value: "ALL" },
    { label: "Proveedores", value: "SUPPLIER" },
    { label: "Prestamistas", value: "LENDER" },
    { label: "Clientes", value: "CLIENT" },
    { label: "Empleados", value: "EMPLOYEE" },
    { label: "Socios", value: "PARTNER" },
    { label: "Otros", value: "OTHER" },
  ];

  // Filter counterparts by category
  const visibleCounterparts = counterparts.filter((item) => {
    const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
    return matchesCategory;
  });

  return (
    <section className="space-y-8">
      <ServicesHero title="Contrapartes" />

      <ServicesSurface>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-default-500 text-xs uppercase tracking-[0.4em]">
                Filtros rápidos
              </p>
              <p className="text-default-600 text-sm">Acota la lista por clasificación.</p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                onClick={() => {
                  setCategoryFilter("ALL");
                }}
                size="sm"
                variant="ghost"
              >
                Reset filtros
              </Button>
              {canCreate ? (
                <Button
                  onClick={() => {
                    openFormModal(null);
                  }}
                  size="sm"
                >
                  + Nueva contraparte
                </Button>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-default-500 text-xs uppercase tracking-[0.3em]">
              Clasificación
            </p>
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
                <p className="text-default-500 text-sm">
                  Selecciona una contraparte para ver los detalles
                </p>
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
