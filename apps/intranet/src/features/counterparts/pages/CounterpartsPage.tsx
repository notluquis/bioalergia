import { Chip } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, OnChangeFn, PaginationState } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Search } from "lucide-react";
import { Suspense, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  assignRutToPayouts,
  type CounterpartUpsertPayload,
  createCounterpart,
  fetchCounterparts,
  fetchUnassignedPayoutAccounts,
  syncCounterparts,
  updateCounterpart,
} from "@/features/counterparts/api";
import { CounterpartForm } from "@/features/counterparts/components/CounterpartForm";
import { CounterpartList } from "@/features/counterparts/components/CounterpartList";
import { SUMMARY_RANGE_MONTHS } from "@/features/counterparts/constants";
import { counterpartKeys } from "@/features/counterparts/queries";
import type {
  Counterpart,
  CounterpartCategory,
  UnassignedPayoutAccount,
} from "@/features/counterparts/types";
import { fmtCLP } from "@/lib/format";
import { normalizeRut, validateRut } from "@/lib/rut";
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
  selectedId: null | number;
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
  selectedId,
  updateMutation,
}: SaveCounterpartArgs): Promise<number> {
  if (!payload.identificationNumber?.trim()) {
    throw new Error("El número de identificación es obligatorio");
  }

  if (!payload.bankAccountHolder?.trim()) {
    throw new Error("El titular de la cuenta es obligatorio");
  }

  let savedId = selectedId;
  if (selectedId) {
    await updateMutation.mutateAsync({ id: selectedId, payload });
  } else {
    const result = await createMutation.mutateAsync(payload);
    savedId = result.counterpart.id;
  }

  if (!savedId) {
    throw new Error("No se pudo obtener el ID de la contraparte");
  }

  return savedId;
}

export function CounterpartsPage() {
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
  const [payoutSearchQuery, setPayoutSearchQuery] = useState("");
  const [payoutPagination, setPayoutPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formCounterpart, setFormCounterpart] = useState<Counterpart | null>(null);
  const [isAssignRutModalOpen, setIsAssignRutModalOpen] = useState(false);
  const [assigningPayoutAccounts, setAssigningPayoutAccounts] = useState<string[]>([]);
  const [assignRutValue, setAssignRutValue] = useState("");
  const [assignHolderValue, setAssignHolderValue] = useState("");
  const [selectedPayoutAccounts, setSelectedPayoutAccounts] = useState<string[]>([]);

  const openFormModal = (target: Counterpart | null = null) => {
    setFormCounterpart(target);
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setFormCounterpart(null);
  };

  const {
    data: counterparts = [],
    error: listError,
    isLoading: isListLoading,
  } = useQuery({
    queryFn: fetchCounterparts,
    queryKey: counterpartKeys.lists(),
  });
  const { data: unassignedPayoutData, isLoading: isUnassignedPayoutLoading } = useQuery({
    queryFn: () =>
      fetchUnassignedPayoutAccounts({
        page: payoutPagination.pageIndex + 1,
        pageSize: payoutPagination.pageSize,
        query: payoutSearchQuery,
      }),
    queryKey: [
      ...counterpartKeys.all,
      "unassigned-payout",
      payoutSearchQuery,
      payoutPagination.pageIndex,
      payoutPagination.pageSize,
    ],
  });

  // Derived error state (combine/prioritize)
  const displayError = error || (listError instanceof Error ? listError.message : null);

  // Use REST API mutations
  const createMutation = useMutation({
    mutationFn: createCounterpart,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: counterpartKeys.lists() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CounterpartUpsertPayload> }) =>
      updateCounterpart(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: counterpartKeys.lists() });
      // Detail invalidation
      if (selectedId) {
        void queryClient.invalidateQueries({
          queryKey: counterpartKeys.detail(selectedId).queryKey,
        });
      }
    },
  });

  const syncMutation = useMutation({
    mutationFn: syncCounterparts,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: counterpartKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: [...counterpartKeys.all, "unassigned-payout"],
      });
      toastSuccess(
        `Sync completado: ${result.syncedCounterparts} contrapartes, ${result.syncedAccounts} cuentas, ${result.conflictCount ?? 0} conflictos.`,
      );
    },
    onError: (error_) => {
      const message =
        error_ instanceof Error ? error_.message : "No se pudo sincronizar contrapartes";
      setError(message);
      toastError(message);
    },
  });

  const handleSaveCounterpart = async (payload: CounterpartUpsertPayload) => {
    setError(null);

    try {
      const wasUpdating = Boolean(selectedId);
      const savedId = await saveCounterpartWithFeedback({
        createMutation,
        payload,
        selectedId,
        updateMutation,
      });
      toastSuccess(
        wasUpdating ? "Contraparte actualizada correctamente" : "Contraparte creada correctamente",
      );

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
  const normalizedAssignRut = normalizeRut(assignRutValue);
  const assignRutIsValid = validateRut(assignRutValue);
  const assignRutCompact = normalizedAssignRut?.replaceAll("-", "") ?? "";
  const assignExistingCounterpart =
    assignRutCompact.length > 0
      ? (counterparts.find(
          (item) => item.identificationNumber.toUpperCase() === assignRutCompact.toUpperCase(),
        ) ?? null)
      : null;
  const assignPreviewMessage =
    assignRutValue.trim().length === 0
      ? "Ingresa un RUT para ver qué acción se aplicará."
      : !assignRutIsValid
        ? "RUT inválido. Corrige el formato/verificador para continuar."
        : assignExistingCounterpart
          ? `Se asociará a contraparte existente: ${assignExistingCounterpart.bankAccountHolder}.`
          : "Se creará una nueva contraparte con este RUT y se asociarán las cuentas payout.";
  const handleCreateFromPayout = (payoutBankAccountNumber: string) => {
    setAssigningPayoutAccounts([payoutBankAccountNumber]);
    setAssignRutValue("");
    setAssignHolderValue("");
    setIsAssignRutModalOpen(true);
  };
  const handleBulkAssignFromSelection = () => {
    if (selectedPayoutAccounts.length === 0) {
      return;
    }
    setAssigningPayoutAccounts(selectedPayoutAccounts);
    setAssignRutValue("");
    setAssignHolderValue("");
    setIsAssignRutModalOpen(true);
  };
  const handleAssignRutToPayout = async () => {
    if (assigningPayoutAccounts.length === 0) {
      return;
    }
    if (!assignRutIsValid) {
      setError("RUT inválido");
      toastError("Ingresa un RUT válido para asignar la contraparte");
      return;
    }

    const normalized = normalizedAssignRut;
    if (!normalized) {
      setError("RUT inválido");
      toastError("Ingresa un RUT válido para asignar la contraparte");
      return;
    }

    setError(null);

    try {
      const result = await assignRutToPayouts({
        accountNumbers: assigningPayoutAccounts,
        bankAccountHolder: assignHolderValue.trim() || undefined,
        rut: normalized,
      });
      setSelectedId(result.counterpart.id);
      if (result.conflicts.length > 0) {
        toastInfo(
          `Asignadas ${result.assignedCount}. ${result.conflicts.length} cuentas quedaron en conflicto.`,
        );
      } else {
        toastSuccess(`Asignadas ${result.assignedCount} cuentas a la contraparte.`);
      }

      setIsAssignRutModalOpen(false);
      setAssigningPayoutAccounts([]);
      setSelectedPayoutAccounts([]);
      setAssignRutValue("");
      setAssignHolderValue("");
      void queryClient.invalidateQueries({ queryKey: counterpartKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: [...counterpartKeys.all, "unassigned-payout"],
      });
    } catch (error_) {
      const message =
        error_ instanceof Error ? error_.message : "No se pudo asignar el RUT a la cuenta payout";
      setError(message);
      toastError(message);
    }
  };

  return (
    <section className="space-y-6">
      <CounterpartsToolbar
        canCreate={canCreate}
        canSync={canUpdate}
        categoryFilter={categoryFilter}
        clientCount={clientCount}
        lenderCount={lenderCount}
        onCategoryFilterChange={setCategoryFilter}
        onCreate={() => {
          openFormModal(null);
        }}
        onSync={() => {
          syncMutation.mutate();
        }}
        onResetFilters={() => {
          setCategoryFilter("ALL");
          setSearchQuery("");
        }}
        syncLoading={syncMutation.isPending}
        onSearchQueryChange={setSearchQuery}
        searchQuery={searchQuery}
        selectedCounterpart={selectedCounterpart}
        supplierCount={supplierCount}
        totalCount={counterparts.length}
        visibleCount={visibleCounterparts.length}
      />
      <UnassignedPayoutAccountsTable
        canCreate={canCreate}
        loading={isUnassignedPayoutLoading}
        onBulkAssign={handleBulkAssignFromSelection}
        onCreateFromPayout={handleCreateFromPayout}
        onPaginationChange={setPayoutPagination}
        onSearchQueryChange={(value) => {
          setPayoutSearchQuery(value);
          setPayoutPagination((prev) => ({ ...prev, pageIndex: 0 }));
        }}
        pageCount={
          unassignedPayoutData
            ? Math.max(Math.ceil(unassignedPayoutData.total / unassignedPayoutData.pageSize), 1)
            : 0
        }
        pagination={payoutPagination}
        rows={unassignedPayoutData?.rows ?? []}
        searchQuery={payoutSearchQuery}
        selectedAccounts={selectedPayoutAccounts}
        setSelectedAccounts={setSelectedPayoutAccounts}
        total={unassignedPayoutData?.total ?? 0}
      />

      <div className="grid min-h-0 items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="surface-recessed h-full rounded-[28px] p-6 shadow-inner">
          {isListLoading ? <Skeleton className="mb-4 h-8 w-44" /> : null}
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
      <Modal
        isOpen={isAssignRutModalOpen}
        onClose={() => {
          setIsAssignRutModalOpen(false);
          setAssigningPayoutAccounts([]);
          setAssignRutValue("");
          setAssignHolderValue("");
        }}
        title="Asignar RUT a cuenta payout"
      >
        <div className="space-y-4">
          <Input
            readOnly
            label="Cuentas payout seleccionadas"
            value={String(assigningPayoutAccounts.length)}
          />
          <Input
            label="RUT de contraparte"
            onChange={(event) => {
              setAssignRutValue(event.target.value);
            }}
            placeholder="12.345.678-5"
            value={assignRutValue}
          />
          <Input
            label="Titular (opcional)"
            onChange={(event) => {
              setAssignHolderValue(event.target.value);
            }}
            placeholder="Nombre contraparte"
            value={assignHolderValue}
          />
          <p
            className={`text-xs ${
              assignRutIsValid || assignRutValue.trim().length === 0
                ? "text-default-500"
                : "text-danger"
            }`}
          >
            {assignPreviewMessage}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setIsAssignRutModalOpen(false);
                setAssigningPayoutAccounts([]);
                setAssignRutValue("");
                setAssignHolderValue("");
              }}
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button disabled={!assignRutIsValid} onClick={handleAssignRutToPayout}>
              Confirmar asignación
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

function UnassignedPayoutAccountsTable({
  canCreate,
  loading,
  onBulkAssign,
  onCreateFromPayout,
  onPaginationChange,
  onSearchQueryChange,
  pageCount,
  pagination,
  rows,
  searchQuery,
  selectedAccounts,
  setSelectedAccounts,
  total,
}: {
  canCreate: boolean;
  loading: boolean;
  onBulkAssign: () => void;
  onCreateFromPayout: (payoutBankAccountNumber: string) => void;
  onPaginationChange: OnChangeFn<PaginationState>;
  onSearchQueryChange: (value: string) => void;
  pageCount: number;
  pagination: PaginationState;
  rows: UnassignedPayoutAccount[];
  searchQuery: string;
  selectedAccounts: string[];
  setSelectedAccounts: (value: string[]) => void;
  total: number;
}) {
  const selectedSet = new Set(selectedAccounts);
  const allCurrentPageSelected =
    rows.length > 0 && rows.every((row) => selectedSet.has(row.payoutBankAccountNumber));

  const columns: ColumnDef<UnassignedPayoutAccount>[] = [
    {
      cell: ({ row }) => (
        <input
          checked={selectedSet.has(row.original.payoutBankAccountNumber)}
          onChange={() => {
            const account = row.original.payoutBankAccountNumber;
            if (selectedSet.has(account)) {
              setSelectedAccounts(selectedAccounts.filter((value) => value !== account));
            } else {
              setSelectedAccounts([...selectedAccounts, account]);
            }
          }}
          type="checkbox"
        />
      ),
      header: () => (
        <input
          checked={allCurrentPageSelected}
          onChange={() => {
            if (allCurrentPageSelected) {
              const currentAccounts = new Set(rows.map((row) => row.payoutBankAccountNumber));
              setSelectedAccounts(
                selectedAccounts.filter((account) => !currentAccounts.has(account)),
              );
            } else {
              const merged = new Set([
                ...selectedAccounts,
                ...rows.map((row) => row.payoutBankAccountNumber),
              ]);
              setSelectedAccounts([...merged]);
            }
          }}
          type="checkbox"
        />
      ),
      id: "select",
    },
    {
      accessorKey: "payoutBankAccountNumber",
      header: "Cuenta payout",
    },
    {
      accessorKey: "movementCount",
      header: "Movimientos",
    },
    {
      accessorKey: "totalGrossAmount",
      cell: ({ row }) => fmtCLP(row.original.totalGrossAmount),
      header: "Total bruto",
    },
    {
      cell: ({ row }) =>
        row.original.conflict ? (
          <span className="font-medium text-danger text-xs">
            Conflicto: linked {row.original.counterpartRut ?? "-"} / withdraw{" "}
            {row.original.withdrawRut ?? "-"}
          </span>
        ) : (
          <span className="text-default-500 text-xs">Sin conflicto</span>
        ),
      header: "Estado",
      id: "status",
    },
    {
      cell: ({ row }) =>
        canCreate ? (
          <Button
            size="sm"
            onClick={() => {
              onCreateFromPayout(row.original.payoutBankAccountNumber);
            }}
          >
            Asignar RUT
          </Button>
        ) : null,
      header: "Acciones",
      id: "actions",
    },
  ];

  return (
    <section className="surface-recessed rounded-[28px] p-5 shadow-inner sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base">Vista Payouts Sin RUT</h3>
          <p className="text-default-500 text-xs">
            `payout_bank_account_number` detectados en release y aún sin vínculo por RUT.
          </p>
        </div>
        <Chip size="sm" variant="soft">
          {total} pendientes
        </Chip>
      </div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-default-500 text-xs">{selectedAccounts.length} seleccionadas</span>
        <Button
          disabled={!canCreate || selectedAccounts.length === 0}
          onClick={onBulkAssign}
          size="sm"
        >
          Asignar RUT en lote
        </Button>
      </div>
      <div className="mb-3">
        <Input
          placeholder="Buscar cuenta payout"
          startContent={<Search className="h-4 w-4 text-default-400" />}
          value={searchQuery}
          onChange={(event) => {
            onSearchQueryChange(event.target.value);
          }}
        />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        containerVariant="plain"
        enableExport={false}
        enableGlobalFilter={false}
        isLoading={loading}
        onPaginationChange={onPaginationChange}
        pageCount={pageCount}
        pagination={pagination}
        pageSizeOptions={[10, 20, 50, 100]}
        noDataMessage="No hay cuentas payout pendientes."
      />
    </section>
  );
}

interface CounterpartsToolbarProps {
  canCreate: boolean;
  canSync: boolean;
  categoryFilter: "ALL" | CounterpartCategory;
  clientCount: number;
  lenderCount: number;
  onCategoryFilterChange: (value: "ALL" | CounterpartCategory) => void;
  onCreate: () => void;
  onResetFilters: () => void;
  onSync: () => void;
  onSearchQueryChange: (value: string) => void;
  searchQuery: string;
  selectedCounterpart: Counterpart | null;
  supplierCount: number;
  syncLoading: boolean;
  totalCount: number;
  visibleCount: number;
}

function CounterpartsToolbar({
  canCreate,
  canSync,
  categoryFilter,
  clientCount,
  lenderCount,
  onCategoryFilterChange,
  onCreate,
  onResetFilters,
  onSync,
  onSearchQueryChange,
  searchQuery,
  selectedCounterpart,
  supplierCount,
  syncLoading,
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
          <div className="flex items-center gap-2">
            {canSync ? (
              <Button disabled={syncLoading} onClick={onSync} size="sm" variant="ghost">
                {syncLoading ? "Sincronizando..." : "Sincronizar contrapartes"}
              </Button>
            ) : null}
            {canCreate ? (
              <Button onClick={onCreate} size="sm">
                + Nueva contraparte
              </Button>
            ) : null}
          </div>
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
