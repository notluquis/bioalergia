import { schema as schemaLite } from "@finanzas/db/schema-lite";
import { Chip } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useClientQueries } from "@zenstackhq/tanstack-query/react";
import dayjs from "dayjs";
import { Search } from "lucide-react";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
import { CounterpartDetailSection } from "../components/CounterpartDetailSection";

const CATEGORY_FILTERS: { label: string; value: "ALL" | CounterpartCategory }[] = [
  { label: "Todos los tipos", value: "ALL" },
  { label: "Proveedores", value: "SUPPLIER" },
  { label: "Prestamistas", value: "LENDER" },
  { label: "Clientes", value: "CLIENT" },
  { label: "Empleados", value: "EMPLOYEE" },
  { label: "Socios", value: "PARTNER" },
  { label: "Otros", value: "OTHER" },
];

type SaveCounterpartArgs = {
  createMutation: {
    mutateAsync: (payload: CounterpartUpsertPayload) => Promise<{ counterpart: { id: number } }>;
  };
  payload: CounterpartUpsertPayload;
  queryClient: ReturnType<typeof useQueryClient>;
  selectedId: null | number;
  toastInfo: (message: string) => void;
  toastSuccess: (message: string) => void;
  updateMutation: {
    mutateAsync: (args: {
      id: number;
      payload: Partial<CounterpartUpsertPayload>;
    }) => Promise<unknown>;
  };
};

async function saveCounterpartWithFeedback({
  createMutation,
  payload,
  queryClient,
  selectedId,
  toastInfo,
  toastSuccess,
  updateMutation,
}: SaveCounterpartArgs): Promise<number> {
  if (!payload.identificationNumber?.trim()) {
    throw new Error("El número de identificación es obligatorio");
  }

  if (!payload.bankAccountHolder?.trim()) {
    throw new Error("El titular de la cuenta es obligatorio");
  }

  let savedId = selectedId;
  const isNew = !selectedId;

  if (selectedId) {
    await updateMutation.mutateAsync({ id: selectedId, payload });
    toastSuccess("Contraparte actualizada correctamente");
  } else {
    const result = await createMutation.mutateAsync(payload);
    savedId = result.counterpart.id;
    toastSuccess("Contraparte creada correctamente");
  }

  if (!savedId) {
    throw new Error("No se pudo obtener el ID de la contraparte");
  }

  if (isNew && payload.identificationNumber) {
    try {
      await attachCounterpartRut(savedId, payload.identificationNumber);
      void queryClient.invalidateQueries({ queryKey: ["Counterpart"] });
      toastInfo("Cuentas detectadas vinculadas automáticamente");
    } catch {
      // Auto-attach failed, silently continue
    }
  }

  return savedId;
}

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
  const [searchQuery, setSearchQuery] = useState("");
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
    // Keep list query lean: detail/accounts are fetched in the detail section.
    // Avoids oversized generated SQL payloads in ZenStack/Postgres.
    select: {
      id: true,
      identificationNumber: true,
      bankAccountHolder: true,
      category: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
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

  const handleSaveCounterpart = async (payload: CounterpartUpsertPayload) => {
    setError(null);

    try {
      const savedId = await saveCounterpartWithFeedback({
        createMutation,
        payload,
        queryClient,
        selectedId,
        toastInfo,
        toastSuccess,
        updateMutation,
      });

      setSelectedId(savedId);
      setIsFormModalOpen(false);
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : "Error al guardar contraparte";
      setError(message);
      toastError(message);
    }
  };

  const handleSelectCounterpart = (id: null | number) => {
    setSelectedId(id);
  };

  const handleSummaryRangeChange = (update: Partial<{ from: string; to: string }>) => {
    setSummaryRange((prev) => ({ ...prev, ...update }));
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const selectedCounterpart = selectedId
    ? (counterparts.find((counterpart) => counterpart.id === selectedId) ?? null)
    : null;

  // Filter counterparts by category + search
  const visibleCounterparts = counterparts.filter((item) => {
    const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
    const matchesQuery =
      normalizedQuery.length === 0 ||
      item.bankAccountHolder.toLowerCase().includes(normalizedQuery) ||
      item.identificationNumber.toLowerCase().includes(normalizedQuery);
    return matchesCategory && matchesQuery;
  });

  const supplierCount = counterparts.filter((item) => item.category === "SUPPLIER").length;
  const clientCount = counterparts.filter((item) => item.category === "CLIENT").length;
  const lenderCount = counterparts.filter((item) => item.category === "LENDER").length;

  return (
    <section className="space-y-6">
      <CounterpartsToolbar
        canCreate={canCreate}
        categoryFilter={categoryFilter}
        clientCount={clientCount}
        lenderCount={lenderCount}
        onCategoryFilterChange={setCategoryFilter}
        onCreate={() => {
          openFormModal(null);
        }}
        onResetFilters={() => {
          setCategoryFilter("ALL");
          setSearchQuery("");
        }}
        onSearchQueryChange={setSearchQuery}
        searchQuery={searchQuery}
        selectedCounterpart={selectedCounterpart}
        supplierCount={supplierCount}
        totalCount={counterparts.length}
        visibleCount={visibleCounterparts.length}
      />

      <div className="grid min-h-0 items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="surface-recessed h-full rounded-[28px] p-6 shadow-inner">
          <CounterpartList
            className="max-h-[calc(100vh-220px)]"
            counterparts={visibleCounterparts}
            emptyMessage={
              normalizedQuery || categoryFilter !== "ALL"
                ? "No hay resultados con los filtros seleccionados."
                : "No hay contrapartes registradas."
            }
            onSelectCounterpart={handleSelectCounterpart}
            selectedId={selectedId}
          />
        </section>

        <CounterpartDetailPane
          canCreate={canCreate}
          canUpdate={canUpdate}
          counterpartId={selectedId}
          onCreate={() => {
            openFormModal(null);
          }}
          onEdit={openFormModal}
          onSummaryRangeChange={handleSummaryRangeChange}
          summaryRange={summaryRange}
        />
      </div>
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

interface CounterpartsToolbarProps {
  canCreate: boolean;
  categoryFilter: "ALL" | CounterpartCategory;
  clientCount: number;
  lenderCount: number;
  onCategoryFilterChange: (value: "ALL" | CounterpartCategory) => void;
  onCreate: () => void;
  onResetFilters: () => void;
  onSearchQueryChange: (value: string) => void;
  searchQuery: string;
  selectedCounterpart: Counterpart | null;
  supplierCount: number;
  totalCount: number;
  visibleCount: number;
}

function CounterpartsToolbar({
  canCreate,
  categoryFilter,
  clientCount,
  lenderCount,
  onCategoryFilterChange,
  onCreate,
  onResetFilters,
  onSearchQueryChange,
  searchQuery,
  selectedCounterpart,
  supplierCount,
  totalCount,
  visibleCount,
}: CounterpartsToolbarProps) {
  return (
    <section className="surface-recessed rounded-[28px] p-5 shadow-inner sm:p-6">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="soft">
              {visibleCount} visibles
            </Chip>
            <Chip size="sm" variant="soft">
              {totalCount} totales
            </Chip>
            {selectedCounterpart ? (
              <Chip size="sm" variant="secondary">
                Seleccionada: {selectedCounterpart.bankAccountHolder}
              </Chip>
            ) : null}
          </div>
          {canCreate ? (
            <Button onClick={onCreate} size="sm">
              + Nueva contraparte
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Input
            placeholder="Buscar por titular o RUT"
            startContent={<Search className="h-4 w-4 text-default-400" />}
            value={searchQuery}
            onChange={(event) => {
              onSearchQueryChange(event.target.value);
            }}
          />
          <Button onClick={onResetFilters} size="sm" variant="ghost">
            Limpiar filtros
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORY_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              onClick={() => {
                onCategoryFilterChange(filter.value);
              }}
              size="sm"
              variant={categoryFilter === filter.value ? "primary" : "ghost"}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-default-200 bg-background px-3 py-2">
            <p className="text-default-500 text-xs">Proveedores</p>
            <p className="font-semibold text-lg">{supplierCount}</p>
          </div>
          <div className="rounded-2xl border border-default-200 bg-background px-3 py-2">
            <p className="text-default-500 text-xs">Clientes</p>
            <p className="font-semibold text-lg">{clientCount}</p>
          </div>
          <div className="rounded-2xl border border-default-200 bg-background px-3 py-2">
            <p className="text-default-500 text-xs">Prestamistas</p>
            <p className="font-semibold text-lg">{lenderCount}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

interface CounterpartDetailPaneProps {
  canCreate: boolean;
  canUpdate: boolean;
  counterpartId: null | number;
  onCreate: () => void;
  onEdit: (counterpart: Counterpart) => void;
  onSummaryRangeChange: (update: Partial<{ from: string; to: string }>) => void;
  summaryRange: { from: string; to: string };
}

function CounterpartDetailPane({
  canCreate,
  canUpdate,
  counterpartId,
  onCreate,
  onEdit,
  onSummaryRangeChange,
  summaryRange,
}: CounterpartDetailPaneProps) {
  if (!counterpartId) {
    return (
      <section className="surface-recessed h-full rounded-[28px] p-6 shadow-inner">
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-default-600 text-sm">
            Selecciona una contraparte para revisar su resumen, movimientos y cuentas asociadas.
          </p>
          {canCreate ? (
            <Button onClick={onCreate} size="sm" variant="ghost">
              Crear nueva contraparte
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <Suspense
      fallback={
        <section className="surface-recessed space-y-4 rounded-[28px] p-6 shadow-inner">
          <Skeleton className="h-8 w-1/2" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </section>
      }
    >
      <CounterpartDetailSection
        canUpdate={canUpdate}
        counterpartId={counterpartId}
        onEdit={onEdit}
        onSummaryRangeChange={onSummaryRangeChange}
        summaryRange={summaryRange}
      />
    </Suspense>
  );
}
