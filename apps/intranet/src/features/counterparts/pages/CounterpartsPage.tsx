import {
  Checkbox,
  Chip,
  ComboBox,
  EmptyState,
  Input as HeroInput,
  Label,
  ListBox,
  ScrollShadow,
  SearchField,
  Separator,
  Surface,
  Tabs,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import type { ColumnDef, OnChangeFn, PaginationState } from "@tanstack/react-table";
import { Filter, Plus, RefreshCcw } from "lucide-react";
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
import { CATEGORY_LABELS } from "@/features/counterparts/constants";
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
  { label: "Gasto personal (socios)", value: "PERSONAL_EXPENSE" },
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

type CounterpartsTab = "counterparts" | "unassigned-payouts";
const counterpartsRouteApi = getRouteApi("/_authed/finanzas/counterparts");

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

function buildAssignPreviewMessage(params: {
  assignExistingCounterpart: Counterpart | null;
  assignRutIsValid: boolean;
  assignRutValue: string;
}) {
  if (params.assignRutValue.trim().length === 0) {
    return "Ingresa un RUT para ver qué acción se aplicará.";
  }
  if (!params.assignRutIsValid) {
    return "RUT inválido. Corrige el formato/verificador para continuar.";
  }
  if (params.assignExistingCounterpart) {
    return `Se asociará a contraparte existente: ${params.assignExistingCounterpart.bankAccountHolder}.`;
  }
  return "Se creará una nueva contraparte con este RUT y se asociarán las cuentas payout.";
}

function useCounterpartsState() {
  const [selectedId, setSelectedId] = useState<null | number>(null);
  const [error, setError] = useState<null | string>(null);
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

  const resetAssignRutModalState = () => {
    setIsAssignRutModalOpen(false);
    setAssigningPayoutAccounts([]);
    setAssignRutValue("");
    setAssignHolderValue("");
  };

  return {
    assignHolderValue,
    assigningPayoutAccounts,
    assignRutValue,
    categoryFilter,
    closeFormModal,
    error,
    formCounterpart,
    isAssignRutModalOpen,
    isFormModalOpen,
    openFormModal,
    payoutPagination,
    payoutSearchQuery,
    resetAssignRutModalState,
    searchQuery,
    selectedId,
    selectedPayoutAccounts,
    setAssignHolderValue,
    setAssigningPayoutAccounts,
    setAssignRutValue,
    setCategoryFilter,
    setError,
    setIsAssignRutModalOpen,
    setIsFormModalOpen,
    setPayoutPagination,
    setPayoutSearchQuery,
    setSearchQuery,
    setSelectedId,
    setSelectedPayoutAccounts,
  };
}

function useCounterpartsData(payoutPagination: PaginationState, payoutSearchQuery: string) {
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

  return {
    counterparts,
    isListLoading,
    isUnassignedPayoutLoading,
    listError,
    unassignedPayoutData,
  };
}

function useCounterpartsMutations(params: {
  queryClient: ReturnType<typeof useQueryClient>;
  selectedId: null | number;
  setError: (value: null | string) => void;
  toastError: (message: string) => void;
  toastSuccess: (message: string) => void;
}) {
  const createMutation = useMutation({
    mutationFn: createCounterpart,
    onSuccess: () => {
      void params.queryClient.invalidateQueries({ queryKey: counterpartKeys.lists() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CounterpartUpsertPayload> }) =>
      updateCounterpart(id, payload),
    onSuccess: () => {
      void params.queryClient.invalidateQueries({ queryKey: counterpartKeys.lists() });
      if (params.selectedId) {
        void params.queryClient.invalidateQueries({
          queryKey: counterpartKeys.detail(params.selectedId).queryKey,
        });
      }
    },
  });

  const syncMutation = useMutation({
    mutationFn: syncCounterparts,
    onSuccess: (result) => {
      void params.queryClient.invalidateQueries({ queryKey: counterpartKeys.lists() });
      void params.queryClient.invalidateQueries({
        queryKey: [...counterpartKeys.all, "unassigned-payout"],
      });
      params.toastSuccess(
        `Sync completado: ${result.syncedCounterparts} contrapartes, ${result.syncedAccounts} cuentas, ${result.conflictCount ?? 0} conflictos.`,
      );
    },
    onError: (error_) => {
      const message =
        error_ instanceof Error ? error_.message : "No se pudo sincronizar contrapartes";
      params.setError(message);
      params.toastError(message);
    },
  });

  return { createMutation, syncMutation, updateMutation };
}

function useCounterpartsDerived(params: {
  assignRutValue: string;
  categoryFilter: "ALL" | CounterpartCategory;
  counterparts: Counterpart[];
  searchQuery: string;
  selectedId: null | number;
}) {
  const normalizedQuery = params.searchQuery.trim().toLowerCase();
  const selectedCounterpart = params.selectedId
    ? (params.counterparts.find((counterpart) => counterpart.id === params.selectedId) ?? null)
    : null;

  const visibleCounterparts = params.counterparts.filter((item) => {
    const matchesCategory =
      params.categoryFilter === "ALL" || item.category === params.categoryFilter;
    const matchesQuery =
      normalizedQuery.length === 0 ||
      item.bankAccountHolder.toLowerCase().includes(normalizedQuery) ||
      item.identificationNumber.toLowerCase().includes(normalizedQuery);
    return matchesCategory && matchesQuery;
  });

  const normalizedAssignRut = normalizeRut(params.assignRutValue);
  const assignRutIsValid = validateRut(params.assignRutValue);
  const assignRutCompact = normalizedAssignRut?.replaceAll("-", "") ?? "";
  const assignExistingCounterpart =
    assignRutCompact.length > 0
      ? (params.counterparts.find(
          (item) => item.identificationNumber.toUpperCase() === assignRutCompact.toUpperCase(),
        ) ?? null)
      : null;
  const assignPreviewMessage = buildAssignPreviewMessage({
    assignExistingCounterpart,
    assignRutIsValid,
    assignRutValue: params.assignRutValue,
  });

  return {
    assignExistingCounterpart,
    assignPreviewMessage,
    assignRutIsValid,
    normalizedAssignRut,
    normalizedQuery,
    selectedCounterpart,
    visibleCounterparts,
  };
}

function useCounterpartsActions(params: {
  assignHolderValue: string;
  assigningPayoutAccounts: string[];
  assignRutIsValid: boolean;
  createMutation: SaveCounterpartArgs["createMutation"];
  normalizedAssignRut: null | string;
  queryClient: ReturnType<typeof useQueryClient>;
  resetAssignRutModalState: () => void;
  selectedId: null | number;
  selectedPayoutAccounts: string[];
  setAssignHolderValue: (value: string) => void;
  setAssigningPayoutAccounts: (value: string[]) => void;
  setAssignRutValue: (value: string) => void;
  setError: (value: null | string) => void;
  setIsAssignRutModalOpen: (value: boolean) => void;
  setIsFormModalOpen: (value: boolean) => void;
  setSelectedId: (value: null | number) => void;
  setSelectedPayoutAccounts: (value: string[]) => void;
  syncMutate: () => void;
  toastError: (message: string) => void;
  toastInfo: (message: string) => void;
  toastSuccess: (message: string) => void;
  updateMutation: SaveCounterpartArgs["updateMutation"];
}) {
  const handleSaveCounterpart = async (payload: CounterpartUpsertPayload) => {
    params.setError(null);

    try {
      const wasUpdating = Boolean(params.selectedId);
      const savedId = await saveCounterpartWithFeedback({
        createMutation: params.createMutation,
        payload,
        selectedId: params.selectedId,
        updateMutation: params.updateMutation,
      });
      params.toastSuccess(
        wasUpdating ? "Contraparte actualizada correctamente" : "Contraparte creada correctamente",
      );

      params.setSelectedId(savedId);
      params.setIsFormModalOpen(false);
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : "Error al guardar contraparte";
      params.setError(message);
      params.toastError(message);
    }
  };

  const handleCreateFromPayout = (payoutBankAccountNumber: string) => {
    params.setAssigningPayoutAccounts([payoutBankAccountNumber]);
    params.setAssignRutValue("");
    params.setAssignHolderValue("");
    params.setIsAssignRutModalOpen(true);
  };

  const handleBulkAssignFromSelection = () => {
    if (params.selectedPayoutAccounts.length === 0) {
      return;
    }
    params.setAssigningPayoutAccounts(params.selectedPayoutAccounts);
    params.setAssignRutValue("");
    params.setAssignHolderValue("");
    params.setIsAssignRutModalOpen(true);
  };

  const handleAssignRutToPayout = async () => {
    if (params.assigningPayoutAccounts.length === 0) {
      return;
    }
    if (!params.assignRutIsValid || !params.normalizedAssignRut) {
      params.setError("RUT inválido");
      params.toastError("Ingresa un RUT válido para asignar la contraparte");
      return;
    }

    params.setError(null);

    try {
      const result = await assignRutToPayouts({
        accountNumbers: params.assigningPayoutAccounts,
        bankAccountHolder: params.assignHolderValue.trim() || undefined,
        rut: params.normalizedAssignRut,
      });
      params.setSelectedId(result.counterpart.id);
      if (result.conflicts.length > 0) {
        params.toastInfo(
          `Asignadas ${result.assignedCount}. ${result.conflicts.length} cuentas quedaron en conflicto.`,
        );
      } else {
        params.toastSuccess(`Asignadas ${result.assignedCount} cuentas a la contraparte.`);
      }

      params.resetAssignRutModalState();
      params.setSelectedPayoutAccounts([]);
      void params.queryClient.invalidateQueries({ queryKey: counterpartKeys.lists() });
      void params.queryClient.invalidateQueries({
        queryKey: [...counterpartKeys.all, "unassigned-payout"],
      });
    } catch (error_) {
      const message =
        error_ instanceof Error ? error_.message : "No se pudo asignar el RUT a la cuenta payout";
      params.setError(message);
      params.toastError(message);
    }
  };

  return {
    handleAssignRutToPayout,
    handleBulkAssignFromSelection,
    handleCreateFromPayout,
    handleSaveCounterpart,
    triggerSync: params.syncMutate,
  };
}

export function CounterpartsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/finanzas/counterparts" });
  const { tab } = counterpartsRouteApi.useSearch();
  const state = useCounterpartsState();
  const { error: toastError, info: toastInfo, success: toastSuccess } = useToast();
  const canCreate = can("create", "Counterpart");
  const canUpdate = can("update", "Counterpart");
  const { counterparts, isUnassignedPayoutLoading, listError, unassignedPayoutData } =
    useCounterpartsData(state.payoutPagination, state.payoutSearchQuery);
  const mutations = useCounterpartsMutations({
    queryClient,
    selectedId: state.selectedId,
    setError: state.setError,
    toastError,
    toastSuccess,
  });
  const derived = useCounterpartsDerived({
    assignRutValue: state.assignRutValue,
    categoryFilter: state.categoryFilter,
    counterparts,
    searchQuery: state.searchQuery,
    selectedId: state.selectedId,
  });
  const actions = useCounterpartsActions({
    assignHolderValue: state.assignHolderValue,
    assigningPayoutAccounts: state.assigningPayoutAccounts,
    assignRutIsValid: derived.assignRutIsValid,
    createMutation: mutations.createMutation,
    normalizedAssignRut: derived.normalizedAssignRut,
    queryClient,
    resetAssignRutModalState: state.resetAssignRutModalState,
    selectedId: state.selectedId,
    selectedPayoutAccounts: state.selectedPayoutAccounts,
    setAssignHolderValue: state.setAssignHolderValue,
    setAssigningPayoutAccounts: state.setAssigningPayoutAccounts,
    setAssignRutValue: state.setAssignRutValue,
    setError: state.setError,
    setIsAssignRutModalOpen: state.setIsAssignRutModalOpen,
    setIsFormModalOpen: state.setIsFormModalOpen,
    setSelectedId: state.setSelectedId,
    setSelectedPayoutAccounts: state.setSelectedPayoutAccounts,
    syncMutate: () => mutations.syncMutation.mutate(),
    toastError,
    toastInfo,
    toastSuccess,
    updateMutation: mutations.updateMutation,
  });
  const displayError = state.error || (listError instanceof Error ? listError.message : null);
  const unassignedPageCount = unassignedPayoutData
    ? Math.max(Math.ceil(unassignedPayoutData.total / unassignedPayoutData.pageSize), 1)
    : 0;
  const unassignedTotal = unassignedPayoutData?.total ?? 0;
  const selectedTab: CounterpartsTab = tab === "unassigned-payouts" ? tab : "counterparts";

  const handleTabSelectionChange = (nextValue: string) => {
    const nextTab: CounterpartsTab =
      nextValue === "unassigned-payouts" ? "unassigned-payouts" : "counterparts";
    void navigate({
      search: (prev) => ({ ...prev, tab: nextTab }),
    });
  };

  return (
    <section className="space-y-5">
      <Tabs
        aria-label="Gestión de contrapartes"
        onSelectionChange={(key) => {
          handleTabSelectionChange(String(key));
        }}
        selectedKey={selectedTab}
      >
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Secciones"
            className="rounded-2xl border border-default-200/60 bg-background/70 p-1"
          >
            <Tabs.Tab id="counterparts">
              Contrapartes
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="unassigned-payouts">
              Cuentas sin RUT
              {unassignedTotal > 0 ? <Chip size="sm">{unassignedTotal}</Chip> : null}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel className="space-y-5 pt-4" id="counterparts">
          <CounterpartsToolbar
            canCreate={canCreate}
            canSync={canUpdate}
            categoryFilter={state.categoryFilter}
            onCategoryFilterChange={state.setCategoryFilter}
            onCreate={() => {
              state.openFormModal(null);
            }}
            onSync={() => {
              actions.triggerSync();
            }}
            onResetFilters={() => {
              state.setCategoryFilter("ALL");
              state.setSearchQuery("");
            }}
            onClearSelection={() => {
              state.setSelectedId(null);
            }}
            syncLoading={mutations.syncMutation.isPending}
            onSearchQueryChange={state.setSearchQuery}
            searchQuery={state.searchQuery}
            selectedCounterpart={derived.selectedCounterpart}
            visibleCounterparts={derived.visibleCounterparts}
            onSelectCounterpart={state.setSelectedId}
            selectedId={state.selectedId}
            totalCount={counterparts.length}
            visibleCount={derived.visibleCounterparts.length}
          />

          <div className="min-h-[calc(100vh-220px)]">
            <CounterpartDetailPane
              canCreate={canCreate}
              canUpdate={canUpdate}
              counterpartId={state.selectedId}
              onCreate={() => {
                state.openFormModal(null);
              }}
              onEdit={state.openFormModal}
            />
          </div>
        </Tabs.Panel>

        <Tabs.Panel className="space-y-4 pt-4" id="unassigned-payouts">
          <UnassignedPayoutAccountsTable
            canCreate={canCreate}
            loading={isUnassignedPayoutLoading}
            onBulkAssign={actions.handleBulkAssignFromSelection}
            onCreateFromPayout={actions.handleCreateFromPayout}
            onPaginationChange={state.setPayoutPagination}
            onSearchQueryChange={(value) => {
              state.setPayoutSearchQuery(value);
              state.setPayoutPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            pageCount={unassignedPageCount}
            pagination={state.payoutPagination}
            rows={unassignedPayoutData?.rows ?? []}
            searchQuery={state.payoutSearchQuery}
            selectedAccounts={state.selectedPayoutAccounts}
            setSelectedAccounts={state.setSelectedPayoutAccounts}
            total={unassignedTotal}
          />
        </Tabs.Panel>
      </Tabs>
      <Modal
        isOpen={state.isFormModalOpen}
        onClose={state.closeFormModal}
        title={state.formCounterpart ? "Editar contraparte" : "Nueva contraparte"}
      >
        <CounterpartForm
          counterpart={state.formCounterpart}
          error={state.error ?? displayError}
          onSave={actions.handleSaveCounterpart}
          saving={mutations.createMutation.isPending || mutations.updateMutation.isPending}
        />
      </Modal>
      <Modal
        isOpen={state.isAssignRutModalOpen}
        onClose={state.resetAssignRutModalState}
        title="Asignar RUT a cuenta payout"
      >
        <div className="space-y-4">
          <Input
            readOnly
            label="Cuentas payout seleccionadas"
            value={String(state.assigningPayoutAccounts.length)}
          />
          <Input
            label="RUT de contraparte"
            onChange={(event) => {
              state.setAssignRutValue(event.target.value);
            }}
            placeholder="12.345.678-5"
            value={state.assignRutValue}
          />
          <Input
            label="Titular (opcional)"
            onChange={(event) => {
              state.setAssignHolderValue(event.target.value);
            }}
            placeholder="Nombre contraparte"
            value={state.assignHolderValue}
          />
          <p
            className={`text-xs ${
              derived.assignRutIsValid || state.assignRutValue.trim().length === 0
                ? "text-default-500"
                : "text-danger"
            }`}
          >
            {derived.assignPreviewMessage}
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={state.resetAssignRutModalState} variant="ghost">
              Cancelar
            </Button>
            <Button disabled={!derived.assignRutIsValid} onClick={actions.handleAssignRutToPayout}>
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
  const selectedOnCurrentPage = rows.filter((row) =>
    selectedSet.has(row.payoutBankAccountNumber),
  ).length;
  const allCurrentPageSelected = rows.length > 0 && selectedOnCurrentPage === rows.length;
  const partiallySelectedCurrentPage =
    selectedOnCurrentPage > 0 && selectedOnCurrentPage < rows.length;

  const columns: ColumnDef<UnassignedPayoutAccount>[] = [
    {
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Seleccionar cuenta ${row.original.payoutBankAccountNumber}`}
          isSelected={selectedSet.has(row.original.payoutBankAccountNumber)}
          onChange={() => {
            const account = row.original.payoutBankAccountNumber;
            if (selectedSet.has(account)) {
              setSelectedAccounts(selectedAccounts.filter((value) => value !== account));
            } else {
              setSelectedAccounts([...selectedAccounts, account]);
            }
          }}
          variant="secondary"
        >
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
        </Checkbox>
      ),
      header: () => (
        <Checkbox
          aria-label="Seleccionar todas las cuentas de la página actual"
          isIndeterminate={partiallySelectedCurrentPage}
          isSelected={allCurrentPageSelected}
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
          variant="secondary"
        >
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
        </Checkbox>
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
    <Surface className="rounded-[28px] border border-default-200/70 p-5 sm:p-6" variant="secondary">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base tracking-tight">Cuentas payout sin RUT</h3>
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
        <SearchField onChange={onSearchQueryChange} value={searchQuery} variant="secondary">
          <Label className="sr-only">Buscar cuenta payout</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Buscar cuenta payout" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>
      <div className="overflow-hidden rounded-2xl border border-default-200/70 bg-background/70">
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
      </div>
    </Surface>
  );
}

interface CounterpartsToolbarProps {
  canCreate: boolean;
  canSync: boolean;
  categoryFilter: "ALL" | CounterpartCategory;
  onCategoryFilterChange: (value: "ALL" | CounterpartCategory) => void;
  onClearSelection: () => void;
  onCreate: () => void;
  onResetFilters: () => void;
  onSelectCounterpart: (value: null | number) => void;
  onSync: () => void;
  onSearchQueryChange: (value: string) => void;
  searchQuery: string;
  selectedId: null | number;
  selectedCounterpart: Counterpart | null;
  syncLoading: boolean;
  totalCount: number;
  visibleCounterparts: Counterpart[];
  visibleCount: number;
}

function CounterpartsToolbar({
  canCreate,
  canSync,
  categoryFilter,
  onCategoryFilterChange,
  onClearSelection,
  onCreate,
  onResetFilters,
  onSelectCounterpart,
  onSync,
  onSearchQueryChange,
  searchQuery,
  selectedId,
  selectedCounterpart,
  syncLoading,
  totalCount,
  visibleCounterparts,
  visibleCount,
}: CounterpartsToolbarProps) {
  return (
    <div className="space-y-3">
      <Surface
        className="rounded-[28px] border border-default-200/70 p-5 sm:p-6"
        variant="secondary"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Chip size="sm" variant="soft">
                  {visibleCount} visibles
                </Chip>
                <Chip size="sm" variant="soft">
                  {totalCount} totales
                </Chip>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canSync ? (
                <Button disabled={syncLoading} onClick={onSync} size="sm" variant="secondary">
                  <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                  {syncLoading ? "Sincronizando..." : "Sincronizar"}
                </Button>
              ) : null}
              {canCreate ? (
                <Button onClick={onCreate} size="sm">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Nueva contraparte
                </Button>
              ) : null}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {CATEGORY_FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  onClick={() => {
                    onCategoryFilterChange(filter.value);
                  }}
                  size="sm"
                  variant={categoryFilter === filter.value ? "secondary" : "ghost"}
                  className={
                    categoryFilter === filter.value
                      ? "border border-primary/35 bg-primary/10 text-primary"
                      : ""
                  }
                >
                  {filter.label}
                </Button>
              ))}
            </div>

            <ComboBox
              allowsEmptyCollection
              className="w-full"
              defaultFilter={() => true}
              inputValue={searchQuery}
              menuTrigger="input"
              onInputChange={onSearchQueryChange}
              onSelectionChange={(key) => {
                if (key === null) {
                  onSelectCounterpart(null);
                  return;
                }
                const parsed = Number(String(key));
                onSelectCounterpart(Number.isFinite(parsed) ? parsed : null);
              }}
              selectedKey={selectedId === null ? null : String(selectedId)}
            >
              <Label className="sr-only">Buscar contraparte por titular o RUT</Label>
              <ComboBox.InputGroup>
                <HeroInput placeholder="Buscar por titular o RUT" variant="secondary" />
                <ComboBox.Trigger />
              </ComboBox.InputGroup>
              <ComboBox.Popover className="rounded-2xl border border-default-200/70 bg-background/95 p-1.5 shadow-2xl backdrop-blur-md">
                <ScrollShadow className="max-h-72" hideScrollBar>
                  <ListBox
                    className="overflow-y-auto"
                    renderEmptyState={() => (
                      <EmptyState>No hay resultados con los filtros seleccionados.</EmptyState>
                    )}
                  >
                    {visibleCounterparts.map((item) => (
                      <ListBox.Item
                        id={String(item.id)}
                        key={item.id}
                        textValue={`${item.bankAccountHolder} ${item.identificationNumber}`}
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <span className="font-medium text-foreground tracking-tight">
                            {item.bankAccountHolder}
                          </span>
                          <Chip size="sm" variant={selectedId === item.id ? "secondary" : "soft"}>
                            {CATEGORY_LABELS[item.category] ?? item.category}
                          </Chip>
                        </div>
                        {item.identificationNumber ? (
                          <span className="mt-0.5 block text-default-500 text-xs">
                            RUT {item.identificationNumber}
                          </span>
                        ) : null}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </ScrollShadow>
              </ComboBox.Popover>
            </ComboBox>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-default-500 text-xs">
                <span>Resultados: {visibleCount}</span>
                <span>Total: {totalCount}</span>
                {selectedCounterpart ? (
                  <span>Seleccionada: {selectedCounterpart.bankAccountHolder}</span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={!selectedCounterpart}
                  onClick={onClearSelection}
                  size="sm"
                  variant="ghost"
                >
                  Limpiar selección
                </Button>
                <Button onClick={onResetFilters} size="sm" variant="ghost">
                  <Filter className="mr-1.5 h-3.5 w-3.5" />
                  Limpiar filtros
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
}

interface CounterpartDetailPaneProps {
  canCreate: boolean;
  canUpdate: boolean;
  counterpartId: null | number;
  onCreate: () => void;
  onEdit: (counterpart: Counterpart) => void;
}

function CounterpartDetailPane({
  canCreate,
  canUpdate,
  counterpartId,
  onCreate,
  onEdit,
}: CounterpartDetailPaneProps) {
  if (!counterpartId) {
    return (
      <Surface
        className="h-full rounded-[28px] border border-default-200/70 p-6"
        variant="secondary"
      >
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
      </Surface>
    );
  }

  return (
    <Suspense
      fallback={
        <Surface
          className="space-y-4 rounded-[28px] border border-default-200/70 p-6"
          variant="secondary"
        >
          <Skeleton className="h-8 w-1/2" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </Surface>
      }
    >
      <CounterpartDetailSection
        canUpdate={canUpdate}
        counterpartId={counterpartId}
        onEdit={onEdit}
      />
    </Suspense>
  );
}
