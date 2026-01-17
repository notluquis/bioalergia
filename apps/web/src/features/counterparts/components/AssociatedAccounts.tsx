import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/context/ToastContext";
import { fetchTransactions } from "@/features/finance/api";
import type { Transaction } from "@/features/finance/types";
import { today } from "@/lib/dates";
import { fmtCLP } from "@/lib/format";
import { formatRut } from "@/lib/rut";

import { addCounterpartAccount, attachCounterpartRut, fetchAccountSuggestions, updateCounterpartAccount } from "../api";
import type { Counterpart, CounterpartAccount, CounterpartAccountSuggestion, CounterpartSummary } from "../types";
import {
  ACCOUNT_FORM_DEFAULT,
  accountFilterKey,
  AccountForm,
  AccountGroup,
  AccountTransactionFilter,
  buildAccountTransactionFilter,
  DateRange,
} from "./AssociatedAccounts.helpers";
import { getAccountGroupColumns, getQuickViewColumns } from "./AssociatedAccountsColumns";

interface AssociatedAccountsProps {
  selectedId: number | null;
  detail: { counterpart: Counterpart; accounts: CounterpartAccount[] } | null;
  summary: CounterpartSummary | null;
  summaryRange: { from: string; to: string };
  onSummaryRangeChange: (update: Partial<DateRange>) => void;
}

export default function AssociatedAccounts({
  selectedId,
  detail,
  summary,
  summaryRange,
  onSummaryRangeChange,
}: AssociatedAccountsProps) {
  const [accountForm, setAccountForm] = useState<AccountForm>(ACCOUNT_FORM_DEFAULT);
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [quickViewGroup, setQuickViewGroup] = useState<AccountGroup | null>(null);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success: toastSuccess, error: toastError } = useToast();
  const fallbackRange: DateRange = {
    from: dayjs().startOf("year").format("YYYY-MM-DD"),
    to: today(),
  };

  // Suggestions Query
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(suggestionQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [suggestionQuery]);

  const { data: suggestions = [] } = useQuery({
    queryKey: ["account-suggestions", debouncedQuery],
    queryFn: () => fetchAccountSuggestions(debouncedQuery),
    enabled: !!debouncedQuery.trim(),
    staleTime: 1000 * 60,
  });

  const accountSuggestions = suggestions as CounterpartAccountSuggestion[];
  // Suspense handles loading, no need for manual loading state

  const queryClient = useQueryClient();

  const addAccountMutation = useMutation({
    mutationFn: (payload: { id: number; data: Parameters<typeof addCounterpartAccount>[1] }) =>
      addCounterpartAccount(payload.id, payload.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["counterpart-detail", variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["counterpart-summary", variables.id],
      });
      setAccountForm(ACCOUNT_FORM_DEFAULT);
      setSuggestionQuery("");
      setIsAddAccountModalOpen(false);
      toastSuccess("Cuenta asociada agregada");
    },
    onError: (err: Error) => {
      setError(err.message);
      toastError(err.message);
    },
  });

  async function handleAddAccount() {
    if (!selectedId) {
      setError("Guarda la contraparte antes de agregar cuentas");
      toastError("Guarda la contraparte antes de agregar cuentas");
      return;
    }
    if (!accountForm.accountIdentifier.trim()) {
      setError("Ingresa un identificador de cuenta");
      toastError("Ingresa un identificador de cuenta");
      return;
    }
    setError(null);

    addAccountMutation.mutate({
      id: selectedId,
      data: {
        accountIdentifier: accountForm.accountIdentifier.trim(),
        bankName: accountForm.bankName.trim() || null,
        accountType: accountForm.accountType.trim() || null,
        holder: accountForm.holder.trim() || null,
        concept: accountForm.concept.trim() || null,
        metadata: {
          bankAccountNumber: accountForm.bankAccountNumber.trim() || null,
          withdrawId: accountForm.accountIdentifier.trim(),
        },
      },
    });
  }

  const updateAccountMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof updateCounterpartAccount>[1] }) =>
      updateCounterpartAccount(id, payload),
    onSuccess: () => {
      if (selectedId) {
        queryClient.invalidateQueries({
          queryKey: ["counterpart-detail", selectedId],
        });
        queryClient.invalidateQueries({
          queryKey: ["counterpart-summary", selectedId],
        });
      }
      toastSuccess("Concepto actualizado");
    },
    onError: (err: Error) => {
      setError(err.message);
      toastError(err.message);
    },
  });

  const { mutateAsync: updateAccount } = updateAccountMutation;

  const handleGroupConceptChange = async (group: AccountGroup, concept: string) => {
    const trimmed = concept.trim();
    const nextConcept = trimmed || null;
    setError(null);

    try {
      await Promise.all(
        group.accounts.map((account) =>
          updateAccount({
            id: account.id,
            payload: { concept: nextConcept },
          })
        )
      );
    } catch {
      // Error handled by mutation onError
    }
  };

  function handleSuggestionClick(suggestion: CounterpartAccountSuggestion) {
    setAccountForm({
      accountIdentifier: suggestion.accountIdentifier,
      bankName: suggestion.bankName ?? "",
      accountType: suggestion.accountType ?? "",
      holder: suggestion.holder ?? "",
      concept: suggestion.assignedCounterpartId ? "" : (suggestion.holder ?? ""),
      bankAccountNumber: suggestion.bankAccountNumber ?? "",
    });
    setSuggestionQuery(suggestion.accountIdentifier);
  }

  function handleSuggestionCreate(suggestion: CounterpartAccountSuggestion) {
    setAccountForm({
      accountIdentifier: suggestion.accountIdentifier,
      bankName: suggestion.bankName ?? "",
      accountType: suggestion.accountType ?? "",
      holder: suggestion.holder ?? "",
      concept: "",
      bankAccountNumber: suggestion.bankAccountNumber ?? "",
    });
    setSuggestionQuery(suggestion.accountIdentifier);
  }

  const attachRutMutation = useMutation({
    mutationFn: ({ id, rut }: { id: number; rut: string }) => attachCounterpartRut(id, rut),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["counterpart-detail", variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["counterpart-summary", variables.id],
      });
      setSuggestionQuery("");
      toastSuccess("RUT vinculado correctamente");
    },
    onError: (error: Error) => {
      setError(error.message);
      toastError(error.message);
    },
  });

  async function handleAttachRut(rut: string | null | undefined) {
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
  }

  const accountGrouping = (() => {
    const groups = new Map<string, AccountGroup>();
    const identifierToKey = new Map<string, string>();

    (detail?.accounts ?? []).forEach((account) => {
      const label = account.metadata?.bankAccountNumber?.trim() || account.account_identifier;
      identifierToKey.set(account.account_identifier, label);
      const existing = groups.get(label);
      if (existing) {
        existing.accounts.push(account);
        if (!existing.bankName && account.bank_name) existing.bankName = account.bank_name;
        if (!existing.holder && account.holder) existing.holder = account.holder;
        if (!existing.concept && account.concept) existing.concept = account.concept;
      } else {
        groups.set(label, {
          key: label,
          label,
          bankName: account.bank_name ?? null,
          holder: account.holder ?? null,
          concept: account.concept ?? "",
          accounts: [account],
        });
      }
    });

    const accountGroups = [...groups.values()]
      .map((group) => ({
        ...group,
        concept: group.concept ?? "",
      }))
      .toSorted((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

    return { accountGroups, identifierToKey };
  })();

  const accountGroups = accountGrouping.accountGroups;
  const identifierToGroupKey = accountGrouping.identifierToKey;

  const summaryByGroup = (() => {
    const map = new Map<string, { total: number; count: number }>();
    summary?.byAccount.forEach((row) => {
      const key = identifierToGroupKey.get(row.account_identifier) ?? row.account_identifier;
      const entry = map.get(key) ?? { total: 0, count: 0 };
      entry.total += row.total;
      entry.count += row.count;
      map.set(key, entry);
    });
    return map;
  })();

  const updateAccountForm =
    <K extends keyof AccountForm>(key: K) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setAccountForm((prev) => ({ ...prev, [key]: value }));
    };

  const handleAccountIdentifierChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setAccountForm((prev) => ({ ...prev, accountIdentifier: value }));
    setSuggestionQuery(value);
  };

  // --- Data Fetching with React Query ---

  const fetchTransactionsForFilter = async (filter: AccountTransactionFilter, range: DateRange) => {
    if (!filter.sourceId && !filter.bankAccountNumber) return [];

    const payload = await fetchTransactions({
      filters: {
        bankAccountNumber: filter.bankAccountNumber || "",
        direction: "OUT",
        includeAmounts: true,
        from: range.from || "",
        to: range.to || "",
        description: "",
        origin: "",
        destination: "",
        sourceId: filter.sourceId || "",
        externalReference: "",
        transactionType: "",
        status: "",
      },
      page: 1,
      pageSize: 200,
    });
    return payload.data;
  };

  const activeRange = summaryRange;

  const { data: quickViewRows = [] } = useQuery({
    queryKey: ["associated-accounts-transactions", quickViewGroup, activeRange.from, activeRange.to],
    queryFn: async () => {
      // safe to assert quickViewGroup is present due to enabled
      const accounts = quickViewGroup!.accounts;
      const filters = accounts.map((account) => buildAccountTransactionFilter(account));
      const normalized: Record<string, AccountTransactionFilter> = {};
      filters.forEach((filter) => {
        if (filter.sourceId || filter.bankAccountNumber) {
          normalized[accountFilterKey(filter)] = filter;
        }
      });
      const uniqueFilters = Object.values(normalized);

      const results = await Promise.all(uniqueFilters.map((filter) => fetchTransactionsForFilter(filter, activeRange)));
      const merged = results.flat();

      const dedup = new Map<number, Transaction>();
      merged.forEach((movement) => {
        if (!dedup.has(movement.id)) {
          dedup.set(movement.id, movement);
        }
      });

      const sorted = [...dedup.values()].toSorted(
        (a, b) => dayjs(b.transactionDate).valueOf() - dayjs(a.transactionDate).valueOf()
      );

      return sorted;
    },
    enabled: !!quickViewGroup,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleQuickView = (group: AccountGroup) => {
    setQuickViewGroup(group);
  };

  const rows = (quickViewRows as Transaction[]) ?? [];
  const quickStats = {
    count: rows.length,
    total: rows.reduce((sum: number, row: Transaction) => sum + (row.transactionAmount ?? 0), 0),
  };

  const accountGroupColumns = getAccountGroupColumns(summaryByGroup, handleGroupConceptChange, handleQuickView);

  const quickViewColumns = getQuickViewColumns();

  const renderQuickViewContent = () => {
    return (
      <div className="border-base-200 overflow-hidden rounded-lg border">
        <DataTable
          data={rows}
          columns={quickViewColumns}
          enableToolbar={false}
          enableVirtualization={false}
          pagination={{ pageIndex: 0, pageSize: 50 }}
          noDataMessage="Sin movimientos dentro del rango seleccionado."
        />
      </div>
    );
  };

  const renderSuggestions = () => {
    if (accountSuggestions.length === 0) {
      return <span className="text-base-content/60 text-xs">No hay sugerencias para este identificador.</span>;
    }
    return (
      <div className="border-base-300 bg-base-100 max-h-48 overflow-y-auto rounded-xl border">
        {accountSuggestions.map((suggestion) => (
          <div
            key={suggestion.accountIdentifier}
            className="border-base-300 flex flex-col gap-1 border-b px-3 py-2 text-xs last:border-b-0"
          >
            <span className="text-base-content font-semibold">{suggestion.accountIdentifier}</span>
            <span className="text-base-content/90">{suggestion.holder ?? "(sin titular)"}</span>
            {suggestion.bankAccountNumber && (
              <span className="text-base-content/90 text-xs">Cuenta {suggestion.bankAccountNumber}</span>
            )}
            {suggestion.rut && <span className="text-base-content/90 text-xs">RUT {formatRut(suggestion.rut)}</span>}
            <span className="text-base-content/90 text-xs">
              {suggestion.movements} mov. · {fmtCLP(suggestion.totalAmount)}
            </span>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="xs" variant="primary" onClick={() => handleSuggestionClick(suggestion)}>
                Autrellenar
              </Button>
              {selectedId && suggestion.rut && (
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => handleAttachRut(suggestion.rut)}
                  disabled={attachRutMutation.isPending}
                >
                  {attachRutMutation.isPending ? "Vinculando..." : "Vincular por RUT"}
                </Button>
              )}
              {!selectedId && (
                <Button size="xs" variant="secondary" onClick={() => handleSuggestionCreate(suggestion)}>
                  Copiar datos
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="surface-recessed relative space-y-5 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-primary text-lg font-semibold drop-shadow-sm">Cuentas asociadas</h2>
          <p className="text-base-content/90 text-xs">
            Identificadores detectados en los movimientos y asignados a esta contraparte.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setIsAddAccountModalOpen(true)}>
          + Agregar cuenta
        </Button>
      </header>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="border-base-200 bg-base-100 overflow-hidden rounded-lg border">
        <DataTable
          data={accountGroups}
          columns={accountGroupColumns}
          enableToolbar={false}
          enableVirtualization={false}
          pagination={{ pageIndex: 0, pageSize: 50 }}
          noDataMessage="Sin cuentas asociadas."
        />
      </div>

      <div className="space-y-4">
        {quickViewGroup ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base-content/60 text-xs tracking-[0.3em] uppercase">Resumen mensual</p>
                <h3 className="text-base-content text-lg font-semibold">Transferencias</h3>
                <p className="text-base-content/60 text-xs">{quickViewGroup.label}</p>
                <p className="text-base-content/50 text-xs">
                  {activeRange.from} – {activeRange.to}
                </p>
              </div>
              <div className="flex gap-4">
                <div className="border-base-300/60 bg-base-100/60 text-base-content/70 rounded-2xl border px-4 py-2 text-xs font-semibold tracking-[0.2em] uppercase">
                  Movimientos {quickStats.count}
                </div>
                <div className="border-base-300/60 bg-base-100/60 text-base-content/70 rounded-2xl border px-4 py-2 text-xs font-semibold tracking-[0.2em] uppercase">
                  Total {fmtCLP(quickStats.total)}
                </div>
              </div>
            </div>
            <div className="text-base-content/70 flex flex-wrap items-end gap-3 text-xs">
              <Input
                label="Desde"
                type="date"
                value={summaryRange.from}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onSummaryRangeChange({ from: event.target.value })}
                className="w-36"
              />
              <Input
                label="Hasta"
                type="date"
                value={summaryRange.to}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onSummaryRangeChange({ to: event.target.value })}
                className="w-36"
              />
              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  onSummaryRangeChange({
                    from: fallbackRange.from,
                    to: fallbackRange.to,
                  })
                }
              >
                Año en curso
              </Button>
            </div>
            <div className="surface-recessed border-base-300/70 border p-4">{renderQuickViewContent()}</div>
          </div>
        ) : (
          <div className="border-base-300/70 bg-base-100/40 text-base-content/60 rounded-[28px] border border-dashed p-8 text-center text-sm">
            Selecciona una cuenta en la tabla superior para ver su resumen y movimientos históricos.
          </div>
        )}
      </div>

      <Modal isOpen={isAddAccountModalOpen} onClose={() => setIsAddAccountModalOpen(false)} title="Agregar cuenta">
        <div className="space-y-4 text-sm">
          <Input
            label="Identificador / Cuenta"
            type="text"
            value={accountForm.accountIdentifier}
            onChange={handleAccountIdentifierChange}
            placeholder="Ej. 124282432930"
          />
          {renderSuggestions()}
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Banco"
              type="text"
              value={accountForm.bankName}
              onChange={updateAccountForm("bankName")}
              placeholder="Banco"
            />
            <Input
              label="Número de cuenta"
              type="text"
              value={accountForm.bankAccountNumber}
              onChange={updateAccountForm("bankAccountNumber")}
              placeholder="Ej. 00123456789"
            />
            <Input
              label="Titular"
              type="text"
              value={accountForm.holder}
              onChange={updateAccountForm("holder")}
              placeholder="Titular de la cuenta"
            />
            <Input
              label="Concepto"
              type="text"
              value={accountForm.concept}
              onChange={updateAccountForm("concept")}
              placeholder="Ej. Pago proveedor"
            />
            <Input
              label="Tipo de cuenta"
              type="text"
              value={accountForm.accountType}
              onChange={updateAccountForm("accountType")}
              placeholder="Cuenta corriente"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAddAccountModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleAddAccount()} disabled={addAccountMutation.isPending}>
              {addAccountMutation.isPending ? "Guardando..." : "Agregar cuenta"}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
