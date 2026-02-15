import { Card, Surface } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/context/ToastContext";
import { fetchTransactions } from "@/features/finance/api";
import type { Transaction } from "@/features/finance/types";
import { today } from "@/lib/dates";
import { fmtCLP } from "@/lib/format";
import { formatRut } from "@/lib/rut";
import { addCounterpartAccount, attachCounterpartRut, fetchAccountSuggestions } from "../api";
import type {
  Counterpart,
  CounterpartAccount,
  CounterpartAccountSuggestion,
  CounterpartSummary,
} from "../types";
import { getAccountGroupColumns, getQuickViewColumns } from "./AssociatedAccountsColumns";
import {
  ACCOUNT_FORM_DEFAULT,
  type AccountForm,
  type AccountGroup,
  type AccountTransactionFilter,
  accountFilterKey,
  buildAccountTransactionFilter,
  type DateRange,
} from "./associated-accounts.helpers";

interface AssociatedAccountsProps {
  detail: null | { accounts: CounterpartAccount[]; counterpart: Counterpart };
  onSummaryRangeChange: (update: Partial<DateRange>) => void;
  selectedId: null | number;
  summary: CounterpartSummary | null;
  summaryRange: { from: string; to: string };
}

const buildAccountGrouping = (accounts: CounterpartAccount[] = []) => {
  const groups = new Map<string, AccountGroup>();
  const identifierToKey = new Map<string, string>();

  for (const account of accounts) {
    const label = account.accountNumber;
    identifierToKey.set(account.accountNumber, label);
    const existing = groups.get(label);
    if (existing) {
      existing.accounts.push(account);
    } else {
      groups.set(label, {
        accounts: [account],
        bankName: account.bankName ?? null,
        key: label,
        label,
      });
    }
  }

  const accountGroups = [...groups.values()].toSorted((a, b) =>
    a.label.localeCompare(b.label, "es", { sensitivity: "base" }),
  );

  return { accountGroups, identifierToKey };
};

const buildQuickStats = (rows: Transaction[]) => ({
  count: rows.length,
  total: rows.reduce((sum: number, row: Transaction) => sum + (row.transactionAmount ?? 0), 0),
});

const useAccountSuggestions = () => {
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(suggestionQuery);
    }, 300);
    return () => {
      clearTimeout(handler);
    };
  }, [suggestionQuery]);

  const { data: accountSuggestions = [] } = useQuery({
    enabled: Boolean(debouncedQuery.trim()),
    queryFn: () => fetchAccountSuggestions(debouncedQuery),
    queryKey: ["account-suggestions", debouncedQuery],
    staleTime: 1000 * 60,
  });

  return { accountSuggestions, setSuggestionQuery, suggestionQuery };
};

const fetchTransactionsForFilter = async (filter: AccountTransactionFilter, range: DateRange) => {
  const normalizedAccountNumber = filter.accountNumber?.trim();
  if (!normalizedAccountNumber) {
    return [];
  }

  const pageSize = 200;
  const maxPages = 25;
  const rows: Transaction[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const payload = await fetchTransactions({
      filters: {
        bankAccountNumber: normalizedAccountNumber,
        from: range.from || "",
        includeAmounts: true,
        to: range.to || "",
      },
      includeTotal: false,
      page,
      pageSize,
    });

    const batch = payload.data ?? [];
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }
  }

  return rows;
};

const useQuickViewTransactions = (quickViewGroup: AccountGroup | null, activeRange: DateRange) => {
  const { data: quickViewRows = [] } = useQuery({
    enabled: Boolean(quickViewGroup),
    queryFn: async () => {
      if (!quickViewGroup) {
        return [];
      }
      const accounts = quickViewGroup.accounts;
      const filters = accounts.map((account) => buildAccountTransactionFilter(account));
      const normalized: Record<string, AccountTransactionFilter> = {};
      for (const filter of filters) {
        if (filter.accountNumber) {
          normalized[accountFilterKey(filter)] = filter;
        }
      }
      const uniqueFilters = Object.values(normalized);

      const results = await Promise.all(
        uniqueFilters.map((filter) => fetchTransactionsForFilter(filter, activeRange)),
      );
      const merged = results.flat();

      const dedup = new Map<number, Transaction>();
      for (const movement of merged) {
        if (!dedup.has(movement.id)) {
          dedup.set(movement.id, movement);
        }
      }

      return [...dedup.values()].toSorted(
        (a, b) => dayjs(b.transactionDate).valueOf() - dayjs(a.transactionDate).valueOf(),
      );
    },
    queryKey: [
      "associated-accounts-transactions",
      quickViewGroup?.key ?? "none",
      activeRange.from,
      activeRange.to,
    ],

    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const rows = quickViewRows ?? [];
  const quickStats = buildQuickStats(rows);

  return { rows, quickStats };
};

const useSummaryByGroup = (accountGroups: AccountGroup[], activeRange: DateRange) => {
  const accountGroupKeys = accountGroups.map((group) => group.key).join("|");
  const { data } = useQuery({
    enabled: accountGroups.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        accountGroups.map(async (group) => {
          const filters = group.accounts.map((account) => buildAccountTransactionFilter(account));
          const uniqueFilters = [...new Map(filters.map((f) => [accountFilterKey(f), f])).values()];
          const results = await Promise.all(
            uniqueFilters.map((filter) => fetchTransactionsForFilter(filter, activeRange)),
          );
          const merged = results.flat();
          const dedup = new Map<number, Transaction>();
          for (const movement of merged) {
            if (!dedup.has(movement.id)) {
              dedup.set(movement.id, movement);
            }
          }
          const values = [...dedup.values()];
          return [
            group.key,
            {
              count: values.length,
              total: values.reduce((sum, row) => sum + (row.transactionAmount ?? 0), 0),
            },
          ] as const;
        }),
      );
      return new Map(entries);
    },
    queryKey: [
      "associated-accounts-summary-by-group",
      accountGroupKeys,
      activeRange.from,
      activeRange.to,
    ],
    staleTime: 1000 * 60 * 5,
  });

  return data ?? new Map<string, { count: number; total: number }>();
};

const useAssociatedAccountsModel = ({
  detail,
  onSummaryRangeChange,
  selectedId,
  summaryRange,
}: Readonly<AssociatedAccountsProps>) => {
  const [accountForm, setAccountForm] = useState<AccountForm>(ACCOUNT_FORM_DEFAULT);
  const [quickViewGroup, setQuickViewGroup] = useState<AccountGroup | null>(null);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const { error: toastError, success: toastSuccess } = useToast();
  const queryClient = useQueryClient();
  const { accountSuggestions, setSuggestionQuery } = useAccountSuggestions();

  const fallbackRange: DateRange = {
    from: dayjs().startOf("year").format("YYYY-MM-DD"),
    to: today(),
  };

  const addAccountMutation = useMutation({
    mutationFn: (payload: { data: Parameters<typeof addCounterpartAccount>[1]; id: number }) =>
      addCounterpartAccount(payload.id, payload.data),
    onError: (err: Error) => {
      setError(err.message);
      toastError(err.message);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["counterpart-detail", variables.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["counterpart-summary", variables.id],
      });
      setAccountForm(ACCOUNT_FORM_DEFAULT);
      setSuggestionQuery("");
      setIsAddAccountModalOpen(false);
      toastSuccess("Cuenta asociada agregada");
    },
  });

  const attachRutMutation = useMutation({
    mutationFn: ({ id, rut }: { id: number; rut: string }) => attachCounterpartRut(id, rut),
    onError: (attachError: Error) => {
      setError(attachError.message);
      toastError(attachError.message);
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["counterpart-detail", variables.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["counterpart-summary", variables.id],
      });
      setSuggestionQuery("");
      toastSuccess("RUT vinculado correctamente");
    },
  });

  const handleAddAccount = () => {
    if (!selectedId) {
      setError("Guarda la contraparte antes de agregar cuentas");
      toastError("Guarda la contraparte antes de agregar cuentas");
      return;
    }
    if (!accountForm.accountNumber.trim()) {
      setError("Ingresa un número de cuenta");
      toastError("Ingresa un número de cuenta");
      return;
    }
    setError(null);

    addAccountMutation.mutate({
      data: {
        accountNumber: accountForm.accountNumber.trim(),
        accountType: accountForm.accountType.trim() || null,
        bankName: accountForm.bankName.trim() || null,
      },
      id: selectedId,
    });
  };

  const handleGroupConceptChange = () => {
    // Concept field no longer exists in new model
    // This is a no-op for now
    setError(null);
  };

  const handleSuggestionClick = (suggestion: CounterpartAccountSuggestion) => {
    setAccountForm({
      accountNumber: suggestion.accountIdentifier,
      accountType: suggestion.accountType ?? "",
      bankName: suggestion.bankName ?? "",
    });
    setSuggestionQuery(suggestion.accountIdentifier);
  };

  const handleSuggestionCreate = (suggestion: CounterpartAccountSuggestion) => {
    setAccountForm({
      accountNumber: suggestion.accountIdentifier,
      accountType: suggestion.accountType ?? "",
      bankName: suggestion.bankName ?? "",
    });
    setSuggestionQuery(suggestion.accountIdentifier);
  };

  const handleAttachRut = (rut: null | string | undefined) => {
    if (!selectedId) {
      setError("Selecciona una contraparte para vincular");
      toastError("Selecciona una contraparte antes de vincular un RUT");
      return;
    }
    if (!rut) {
      setError("La sugerencia no contiene un RUT válido");
      toastError("La sugerencia no contiene un RUT válido");
      return;
    }
    setError(null);
    attachRutMutation.mutate({ id: selectedId, rut });
  };

  const accountGrouping = buildAccountGrouping(detail?.accounts ?? []);
  const accountGroups = accountGrouping.accountGroups;

  const updateAccountForm =
    <K extends keyof AccountForm>(key: K) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setAccountForm((prev) => ({ ...prev, [key]: value }));
    };

  const handleAccountIdentifierChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setAccountForm((prev) => ({ ...prev, accountNumber: value }));
    setSuggestionQuery(value);
  };

  const activeRange = summaryRange;
  const summaryByGroup = useSummaryByGroup(accountGroups, activeRange);
  const { rows, quickStats } = useQuickViewTransactions(quickViewGroup, activeRange);

  const accountGroupColumns = getAccountGroupColumns(
    summaryByGroup,
    handleGroupConceptChange,
    setQuickViewGroup,
  );

  const quickViewColumns = getQuickViewColumns();

  return {
    accountForm,
    accountGroupColumns,
    accountGroups,
    accountSuggestions,
    activeRange,
    addAccountMutation,
    attachRutMutation,
    error,
    fallbackRange,
    handleAccountIdentifierChange,
    handleAddAccount,
    handleAttachRut,
    handleSuggestionClick,
    handleSuggestionCreate,
    isAddAccountModalOpen,
    onSummaryRangeChange,
    quickStats,
    quickViewColumns,
    quickViewGroup,
    rows,
    selectedId,
    setIsAddAccountModalOpen,
    summaryRange,
    updateAccountForm,
  };
};
export function AssociatedAccounts(props: Readonly<AssociatedAccountsProps>) {
  const {
    accountForm,
    accountGroupColumns,
    accountGroups,
    accountSuggestions,
    activeRange,
    addAccountMutation,
    attachRutMutation,
    error,
    fallbackRange,
    handleAccountIdentifierChange,
    handleAddAccount,
    handleAttachRut,
    handleSuggestionClick,
    handleSuggestionCreate,
    isAddAccountModalOpen,
    onSummaryRangeChange,
    quickStats,
    quickViewColumns,
    quickViewGroup,
    rows,
    selectedId,
    setIsAddAccountModalOpen,
    summaryRange,
    updateAccountForm,
  } = useAssociatedAccountsModel(props);

  return (
    <Surface className="relative space-y-5 rounded-[28px] p-6" variant="secondary">
      <AssociatedAccountsHeader onAddAccount={() => setIsAddAccountModalOpen(true)} />
      {error && <Alert status="danger">{error}</Alert>}

      <AccountGroupsTable accountGroups={accountGroups} columns={accountGroupColumns} />

      <QuickViewSection
        activeRange={activeRange}
        fallbackRange={fallbackRange}
        onSummaryRangeChange={onSummaryRangeChange}
        quickStats={quickStats}
        quickViewGroup={quickViewGroup}
        rows={rows}
        summaryRange={summaryRange}
        columns={quickViewColumns}
      />

      <AddAccountModal
        accountForm={accountForm}
        addPending={addAccountMutation.isPending}
        isOpen={isAddAccountModalOpen}
        onAccountIdentifierChange={handleAccountIdentifierChange}
        onAddAccount={handleAddAccount}
        onClose={() => setIsAddAccountModalOpen(false)}
        renderSuggestions={
          <SuggestionList
            accountSuggestions={accountSuggestions}
            attachPending={attachRutMutation.isPending}
            onAttachRut={handleAttachRut}
            onSuggestionClick={handleSuggestionClick}
            onSuggestionCreate={handleSuggestionCreate}
            selectedId={selectedId}
          />
        }
        updateAccountForm={updateAccountForm}
      />
    </Surface>
  );
}

function AssociatedAccountsHeader({ onAddAccount }: { onAddAccount: () => void }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-1">
        <h2 className="font-semibold text-lg text-primary drop-shadow-sm">Cuentas asociadas</h2>
        <p className="text-foreground/90 text-xs">
          Identificadores detectados en los movimientos y asignados a esta contraparte.
        </p>
      </div>
      <Button onClick={onAddAccount} size="sm" variant="secondary">
        + Agregar cuenta
      </Button>
    </header>
  );
}

function AccountGroupsTable({
  accountGroups,
  columns,
}: {
  accountGroups: AccountGroup[];
  columns: ReturnType<typeof getAccountGroupColumns>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-default-100 bg-background">
      <DataTable
        columns={columns as ColumnDef<AccountGroup, unknown>[]}
        data={accountGroups}
        containerVariant="plain"
        enablePagination={false}
        enableToolbar={false}
        enableVirtualization={false}
        noDataMessage="Sin cuentas asociadas."
      />
    </div>
  );
}

function QuickViewSection({
  activeRange,
  fallbackRange,
  onSummaryRangeChange,
  quickStats,
  quickViewGroup,
  rows,
  summaryRange,
  columns,
}: {
  activeRange: DateRange;
  fallbackRange: DateRange;
  onSummaryRangeChange: (update: Partial<DateRange>) => void;
  quickStats: { count: number; total: number };
  quickViewGroup: AccountGroup | null;
  rows: Transaction[];
  summaryRange: { from: string; to: string };
  columns: ColumnDef<Transaction, unknown>[];
}) {
  if (!quickViewGroup) {
    return (
      <Card className="rounded-[28px] border border-default-200/70 border-dashed bg-background/40 p-8 text-center text-default-500 text-sm shadow-none">
        <Card.Content className="p-0">
          Selecciona una cuenta en la tabla superior para ver su resumen y movimientos históricos.
        </Card.Content>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-default-500 text-xs uppercase tracking-[0.3em]">Resumen mensual</p>
          <h3 className="font-semibold text-foreground text-lg">Transferencias</h3>
          <p className="text-default-500 text-xs">{quickViewGroup.label}</p>
          <p className="text-default-400 text-xs">
            {activeRange.from} – {activeRange.to}
          </p>
        </div>
        <div className="flex gap-4">
          <div className="rounded-2xl border border-default-200/60 bg-background/60 px-4 py-2 font-semibold text-default-600 text-xs uppercase tracking-[0.2em]">
            Movimientos {quickStats.count}
          </div>
          <div className="rounded-2xl border border-default-200/60 bg-background/60 px-4 py-2 font-semibold text-default-600 text-xs uppercase tracking-[0.2em]">
            Total {fmtCLP(quickStats.total)}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3 text-default-600 text-xs">
        <Input
          className="w-36"
          label="Desde"
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onSummaryRangeChange({ from: event.target.value });
          }}
          type="date"
          value={summaryRange.from}
        />

        <Input
          className="w-36"
          label="Hasta"
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onSummaryRangeChange({ to: event.target.value });
          }}
          type="date"
          value={summaryRange.to}
        />

        <Button
          onClick={() => {
            onSummaryRangeChange({
              from: fallbackRange.from,
              to: fallbackRange.to,
            });
          }}
          size="sm"
          variant="ghost"
        >
          Año en curso
        </Button>
      </div>
      <Surface className="border border-default-200/70 p-4" variant="secondary">
        <div className="overflow-hidden rounded-lg border border-default-100">
          <DataTable
            columns={columns as ColumnDef<Transaction, unknown>[]}
            data={rows}
            containerVariant="plain"
            enablePagination={false}
            enableToolbar={false}
            enableVirtualization={false}
            noDataMessage="Sin movimientos dentro del rango seleccionado."
          />
        </div>
      </Surface>
    </div>
  );
}

function SuggestionList({
  accountSuggestions,
  attachPending,
  onAttachRut,
  onSuggestionClick,
  onSuggestionCreate,
  selectedId,
}: {
  accountSuggestions: CounterpartAccountSuggestion[];
  attachPending: boolean;
  onAttachRut: (rut: null | string | undefined) => void;
  onSuggestionClick: (suggestion: CounterpartAccountSuggestion) => void;
  onSuggestionCreate: (suggestion: CounterpartAccountSuggestion) => void;
  selectedId: number | null;
}) {
  if (accountSuggestions.length === 0) {
    return (
      <span className="text-default-500 text-xs">No hay sugerencias para este identificador.</span>
    );
  }
  return (
    <div className="max-h-48 overflow-y-auto rounded-xl border border-default-200 bg-background">
      {accountSuggestions.map((suggestion) => (
        <div
          className="flex flex-col gap-1 border-default-200 border-b px-3 py-2 text-xs last:border-b-0"
          key={suggestion.accountIdentifier}
        >
          <span className="font-semibold text-foreground">{suggestion.accountIdentifier}</span>
          {suggestion.bankName && (
            <span className="text-foreground/90 text-xs">Banco: {suggestion.bankName}</span>
          )}
          {suggestion.accountType && (
            <span className="text-foreground/90 text-xs">Tipo: {suggestion.accountType}</span>
          )}
          {suggestion.identificationNumber && (
            <span className="text-foreground/90 text-xs">
              RUT: {formatRut(suggestion.identificationNumber)}
            </span>
          )}
          <span className="text-foreground/90 text-xs">
            Total: {fmtCLP(suggestion.totalAmount)}
          </span>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              onClick={() => {
                onSuggestionClick(suggestion);
              }}
              size="sm"
              variant="primary"
            >
              Autorellenar
            </Button>
            {selectedId && suggestion.identificationNumber && (
              <Button
                disabled={attachPending}
                onClick={() => {
                  onAttachRut(suggestion.identificationNumber);
                }}
                size="sm"
                variant="secondary"
              >
                {attachPending ? "Vinculando..." : "Vincular por RUT"}
              </Button>
            )}
            {!selectedId && (
              <Button
                onClick={() => {
                  onSuggestionCreate(suggestion);
                }}
                size="sm"
                variant="secondary"
              >
                Copiar datos
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AddAccountModal({
  accountForm,
  addPending,
  isOpen,
  onAccountIdentifierChange,
  onAddAccount,
  onClose,
  renderSuggestions,
  updateAccountForm,
}: {
  accountForm: AccountForm;
  addPending: boolean;
  isOpen: boolean;
  onAccountIdentifierChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAddAccount: () => void;
  onClose: () => void;
  renderSuggestions: React.ReactNode;
  updateAccountForm: <K extends keyof AccountForm>(
    key: K,
  ) => (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agregar cuenta">
      <div className="space-y-4 text-sm">
        <Input
          label="Número de cuenta"
          onChange={onAccountIdentifierChange}
          placeholder="Ej. 124282432930"
          type="text"
          value={accountForm.accountNumber}
        />

        {renderSuggestions}
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Banco"
            onChange={updateAccountForm("bankName")}
            placeholder="Banco"
            type="text"
            value={accountForm.bankName}
          />

          <Input
            label="Tipo de cuenta"
            onChange={updateAccountForm("accountType")}
            placeholder="Ej. Cuenta corriente"
            type="text"
            value={accountForm.accountType}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} variant="ghost">
            Cancelar
          </Button>
          <Button disabled={addPending} onClick={onAddAccount}>
            {addPending ? "Guardando..." : "Agregar cuenta"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
