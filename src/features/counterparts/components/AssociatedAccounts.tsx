import { Fragment, useState, useMemo, useEffect, useCallback } from "react";
import type { ChangeEvent, FocusEvent } from "react";
import dayjs from "dayjs";
import { fmtCLP } from "../../../lib/format";
import { formatRut } from "../../../lib/rut";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Alert from "../../../components/ui/Alert";
import Modal from "../../../components/ui/Modal";
import { useToast } from "../../../context/ToastContext";
import type { Counterpart, CounterpartAccount, CounterpartAccountSuggestion, CounterpartSummary } from "../types";
import type { DbMovement } from "../../transactions/types";
import { addCounterpartAccount, attachCounterpartRut, fetchAccountSuggestions, updateCounterpartAccount } from "../api";

interface AssociatedAccountsProps {
  selectedId: number | null;
  detail: { counterpart: Counterpart; accounts: CounterpartAccount[] } | null;
  summary: CounterpartSummary | null;
  summaryRange: { from: string; to: string };
  summaryLoading: boolean;
  onLoadSummary: (counterpartId: number, from: string, to: string) => Promise<void>;
  onSummaryRangeChange: (update: Partial<DateRange>) => void;
}

type AccountForm = {
  accountIdentifier: string;
  bankName: string;
  accountType: string;
  holder: string;
  concept: string;
  bankAccountNumber: string;
};

const ACCOUNT_FORM_DEFAULT: AccountForm = {
  accountIdentifier: "",
  bankName: "",
  accountType: "",
  holder: "",
  concept: "",
  bankAccountNumber: "",
};

type DateRange = { from: string; to: string };

type AccountTransactionsState = {
  loading: boolean;
  error: string | null;
  rows: DbMovement[];
  range: DateRange;
};

type TransactionsApiResponse = {
  status: "ok" | "error";
  data: DbMovement[];
  message?: string;
};

type AccountGroup = {
  key: string;
  label: string;
  bankName: string | null;
  holder: string | null;
  concept: string;
  accounts: CounterpartAccount[];
};

type AccountTransactionFilter = {
  sourceId?: string;
  bankAccountNumber?: string;
};

function buildAccountTransactionFilter(account: CounterpartAccount): AccountTransactionFilter {
  const withdrawId = account.metadata?.withdrawId?.trim();
  const bankAccountNumber = account.metadata?.bankAccountNumber?.trim() || account.account_identifier.trim();
  const filter: AccountTransactionFilter = {};
  if (withdrawId) {
    filter.sourceId = withdrawId;
  }
  if (bankAccountNumber) {
    filter.bankAccountNumber = bankAccountNumber;
  }
  return filter;
}

function accountFilterKey(filter: AccountTransactionFilter) {
  return `${filter.sourceId ?? ""}|${filter.bankAccountNumber ?? ""}`;
}

export default function AssociatedAccounts({
  selectedId,
  detail,
  summary,
  summaryRange,
  summaryLoading,
  onLoadSummary,
  onSummaryRangeChange,
}: AssociatedAccountsProps) {
  const [accountForm, setAccountForm] = useState<AccountForm>(ACCOUNT_FORM_DEFAULT);
  const [accountStatus, setAccountStatus] = useState<"idle" | "saving">("idle");
  const [accountSuggestions, setAccountSuggestions] = useState<CounterpartAccountSuggestion[]>([]);
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [attachLoading, setAttachLoading] = useState(false);
  const [accountDetails, setAccountDetails] = useState<Record<string, AccountTransactionsState>>({});
  const [quickViewGroup, setQuickViewGroup] = useState<AccountGroup | null>(null);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success: toastSuccess, error: toastError } = useToast();
  const fallbackRange = useMemo<DateRange>(
    () => ({
      from: dayjs().startOf("year").format("YYYY-MM-DD"),
      to: dayjs().format("YYYY-MM-DD"),
    }),
    []
  );

  useEffect(() => {
    if (!suggestionQuery.trim()) {
      setAccountSuggestions([]);
      return;
    }
    const controller = new AbortController();
    let timeoutId: number | null = null;

    timeoutId = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      setSuggestionsLoading(true);
      fetchAccountSuggestions(suggestionQuery)
        .then((suggestions) => {
          if (!controller.signal.aborted) {
            setAccountSuggestions(suggestions);
          }
        })
        .catch(() => {
          // Silently ignore errors on aborted requests
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setSuggestionsLoading(false);
          }
        });
    }, 200);

    return () => {
      controller.abort();
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [suggestionQuery]);

  useEffect(() => {
    setAccountDetails({});
  }, [selectedId, summaryRange.from, summaryRange.to]);

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
    setAccountStatus("saving");
    setError(null);
    try {
      await addCounterpartAccount(selectedId, {
        accountIdentifier: accountForm.accountIdentifier.trim(),
        bankName: accountForm.bankName.trim() || null,
        accountType: accountForm.accountType.trim() || null,
        holder: accountForm.holder.trim() || null,
        concept: accountForm.concept.trim() || null,
        metadata: {
          bankAccountNumber: accountForm.bankAccountNumber.trim() || null,
          withdrawId: accountForm.accountIdentifier.trim(),
        },
      });
      // setDetail((prev) => (prev ? { counterpart: prev.counterpart, accounts } : prev));
      setAccountForm(ACCOUNT_FORM_DEFAULT);
      setAccountSuggestions([]);
      setSuggestionQuery("");
      setIsAddAccountModalOpen(false);
      await onLoadSummary(selectedId, summaryRange.from, summaryRange.to);
      toastSuccess("Cuenta asociada agregada");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      toastError(err instanceof Error ? err.message : "No se pudo agregar la cuenta");
    } finally {
      setAccountStatus("idle");
    }
  }

  async function handleGroupConceptChange(group: AccountGroup, concept: string) {
    const trimmed = concept.trim();
    const nextConcept = trimmed || null;
    setError(null);
    try {
      await Promise.all(
        group.accounts.map((account) => updateCounterpartAccount(account.id, { concept: nextConcept }))
      );
      // const groupIds = new Set(group.accounts.map((account) => account.id));
      // setDetail((prev) =>
      //   prev
      //     ? {
      //         counterpart: prev.counterpart,
      //         accounts: prev.accounts.map((account) =>
      //           groupIds.has(account.id) ? { ...account, concept: nextConcept } : account
      //         ),
      //       }
      //     : prev
      // );
      if (selectedId) {
        await onLoadSummary(selectedId, summaryRange.from, summaryRange.to);
      }
      toastSuccess("Concepto actualizado");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      toastError(err instanceof Error ? err.message : "No se pudo actualizar el concepto");
    }
  }

  function handleSuggestionClick(suggestion: CounterpartAccountSuggestion) {
    setAccountForm({
      accountIdentifier: suggestion.accountIdentifier,
      bankName: suggestion.bankName ?? "",
      accountType: suggestion.accountType ?? "",
      holder: suggestion.holder ?? "",
      concept: suggestion.assignedCounterpartId ? "" : "",
      bankAccountNumber: suggestion.bankAccountNumber ?? "",
    });
    setSuggestionQuery(suggestion.accountIdentifier);
    if (!selectedId) {
      // setForm((prev) => ({
      //   ...prev,
      //   rut: suggestion.rut ?? prev.rut,
      //   name: suggestion.holder ?? prev.name,
      // }));
    }
  }

  function handleSuggestionCreate(suggestion: CounterpartAccountSuggestion) {
    // setForm((prev) => ({
    //   ...prev,
    //   rut: suggestion.rut ?? prev.rut,
    //   name: suggestion.holder ?? prev.name,
    //   category: prev.category,
    // }));
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
    setAttachLoading(true);
    setError(null);
    try {
      await attachCounterpartRut(selectedId, rut);
      // const updated = await fetchCounterpart(selectedId);
      // setDetail(updated);
      setAccountSuggestions([]);
      // setCounterparts((prev) =>
      //   prev
      //     .map((item) => (item.id === selectedId ? updated.counterpart : item))
      //     .sort((a, b) => a.name.localeCompare(b.name))
      // );
      // setForm({
      //   rut: updated.counterpart.rut ?? "",
      //   name: updated.counterpart.name,
      //   personType: updated.counterpart.personType,
      //   category: updated.counterpart.category,
      //   email: updated.counterpart.email ?? "",
      //   notes: updated.counterpart.notes ?? "",
      // });
      await onLoadSummary(selectedId, summaryRange.from, summaryRange.to);
      toastSuccess("RUT vinculado correctamente");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      toastError(err instanceof Error ? err.message : "No se pudo vincular el RUT");
    } finally {
      setAttachLoading(false);
    }
  }

  const accountGrouping = useMemo(() => {
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

    const accountGroups = Array.from(groups.values())
      .map((group) => ({
        ...group,
        concept: group.concept ?? "",
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

    return { accountGroups, identifierToKey };
  }, [detail?.accounts]);

  const accountGroups = accountGrouping.accountGroups;
  const identifierToGroupKey = accountGrouping.identifierToKey;

  const summaryByGroup = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    summary?.byAccount.forEach((row) => {
      const key = identifierToGroupKey.get(row.account_identifier) ?? row.account_identifier;
      const entry = map.get(key) ?? { total: 0, count: 0 };
      entry.total += row.total;
      entry.count += row.count;
      map.set(key, entry);
    });
    return map;
  }, [summary, identifierToGroupKey]);

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

  const fetchTransactionsByFilter = useCallback(async (filter: AccountTransactionFilter, range: DateRange) => {
    if (!filter.sourceId && !filter.bankAccountNumber) {
      return [];
    }
    const params = new URLSearchParams();
    if (filter.bankAccountNumber) {
      params.set("bankAccountNumber", filter.bankAccountNumber);
    }
    params.set("direction", "OUT");
    params.set("includeAmounts", "true");
    params.set("page", "1");
    params.set("pageSize", "200");
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);

    const res = await fetch(`/api/transactions?${params.toString()}`, { credentials: "include" });
    const payload = (await res.json()) as TransactionsApiResponse;
    if (!res.ok || payload.status !== "ok") {
      throw new Error(payload.message || "No se pudieron obtener los movimientos");
    }
    return payload.data;
  }, []);

  const fetchGroupTransactions = useCallback(
    async (group: AccountGroup, range: DateRange) => {
      const filters = group.accounts.map((account) => buildAccountTransactionFilter(account));
      const normalized: Record<string, AccountTransactionFilter> = {};
      filters.forEach((filter) => {
        if (filter.sourceId || filter.bankAccountNumber) {
          normalized[accountFilterKey(filter)] = filter;
        }
      });
      const uniqueFilters = Object.values(normalized);
      const results = await Promise.all(uniqueFilters.map((filter) => fetchTransactionsByFilter(filter, range)));
      const merged = results.flat();
      const dedup = new Map<number, DbMovement>();
      merged.forEach((movement) => {
        if (!dedup.has(movement.id)) {
          dedup.set(movement.id, movement);
        }
      });
      return Array.from(dedup.values()).sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf());
    },
    [fetchTransactionsByFilter]
  );

  const loadTransactionsForGroup = useCallback(
    async (group: AccountGroup, range?: DateRange) => {
      const appliedRange = range ?? summaryRange;
      const identifier = group.key;
      setAccountDetails((prev) => ({
        ...prev,
        [identifier]: {
          loading: true,
          error: null,
          rows: prev[identifier]?.rows ?? [],
          range: appliedRange,
        },
      }));

      try {
        const rows = await fetchGroupTransactions(group, appliedRange);
        setAccountDetails((prev) => ({
          ...prev,
          [identifier]: {
            loading: false,
            error: null,
            rows,
            range: appliedRange,
          },
        }));
        if (!rows.length && (appliedRange.from !== fallbackRange.from || appliedRange.to !== fallbackRange.to)) {
          const fallbackRows = await fetchGroupTransactions(group, fallbackRange);
          setAccountDetails((prev) => ({
            ...prev,
            [identifier]: {
              loading: false,
              error: null,
              rows: fallbackRows,
              range: fallbackRange,
            },
          }));
        }
      } catch (err) {
        setAccountDetails((prev) => ({
          ...prev,
          [identifier]: {
            loading: false,
            error: err instanceof Error ? err.message : String(err),
            rows: prev[identifier]?.rows ?? [],
            range: appliedRange,
          },
        }));
      }
    },
    [fetchGroupTransactions, fallbackRange, summaryRange]
  );

  const handleQuickView = (group: AccountGroup) => {
    setQuickViewGroup(group);
    if (!accountDetails[group.key]?.rows?.length) {
      void loadTransactionsForGroup(group);
    }
  };
  useEffect(() => {
    if (quickViewGroup) {
      void loadTransactionsForGroup(quickViewGroup);
    }
  }, [quickViewGroup, loadTransactionsForGroup, summaryRange]);
  const quickViewDetails = quickViewGroup ? accountDetails[quickViewGroup.key] : undefined;
  const quickStats = useMemo(() => {
    const rows = quickViewDetails?.rows ?? [];
    return {
      count: rows.length,
      total: rows.reduce((sum, row) => sum + (row.amount ?? 0), 0),
    };
  }, [quickViewDetails?.rows]);
  const activeRange = quickViewDetails?.range ?? summaryRange;

  return (
    <section className="surface-recessed relative space-y-5 p-6" aria-busy={summaryLoading}>
      {summaryLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-base-100/60 backdrop-blur-sm">
          <span className="loading loading-spinner loading-lg text-primary" aria-hidden="true" />
        </div>
      )}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-primary drop-shadow-sm">Cuentas asociadas</h2>
          <p className="text-xs text-base-content/90">
            Identificadores detectados en los movimientos y asignados a esta contraparte.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setIsAddAccountModalOpen(true)}>
          + Agregar cuenta
        </Button>
      </header>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-base-content">
          <thead className="bg-base-100/60 text-primary">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Cuenta</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Banco</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Titular</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Concepto</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Movimientos</th>
            </tr>
          </thead>
          <tbody>
            {accountGroups.map((group) => {
              const summaryInfo = summaryByGroup.get(group.key);
              const state = accountDetails[group.key];
              return (
                <Fragment key={group.key}>
                  <tr className="border-b border-base-300 bg-base-200 last:border-none even:bg-base-300">
                    <td className="px-3 py-3 text-base-content">
                      <div className="font-mono text-xs text-base-content">{group.label}</div>
                      {summaryInfo && summaryInfo.count > 0 && (
                        <span className="mt-1 inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                          Cuenta reconocida
                        </span>
                      )}
                      {group.accounts.length > 1 && (
                        <div className="text-xs text-base-content/90">
                          {group.accounts.length} identificadores vinculados
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-base-content">{group.bankName ?? "-"}</td>
                    <td className="px-3 py-3 text-base-content">{group.holder ?? "-"}</td>
                    <td className="px-3 py-3">
                      {summaryInfo && summaryInfo.count > 0 ? (
                        <Input
                          type="text"
                          defaultValue={group.concept}
                          onBlur={(event: FocusEvent<HTMLInputElement>) =>
                            handleGroupConceptChange(group, event.target.value)
                          }
                          className="w-full"
                          placeholder="Concepto (ej. Compra de vacunas)"
                        />
                      ) : (
                        <span className="text-xs italic text-base-content/60">Sin movimientos</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-base-content">
                      <div className="flex flex-col gap-2 text-xs">
                        <Button variant="secondary" onClick={() => handleQuickView(group)} className="self-start">
                          Ver movimientos
                        </Button>
                        <div className="text-xs text-base-content/60">
                          {summaryInfo
                            ? `${summaryInfo.count} mov. · ${fmtCLP(summaryInfo.total)}`
                            : "Sin movimientos en el rango"}
                        </div>
                        {state?.error && (
                          <Alert variant="error" className="text-xs">
                            {state.error}
                          </Alert>
                        )}
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            {!accountGroups.length && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-xs text-base-content/60">
                  Sin cuentas asociadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="space-y-4">
        {quickViewGroup ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">Resumen mensual</p>
                <h3 className="text-lg font-semibold text-base-content">Transferencias</h3>
                <p className="text-xs text-base-content/60">{quickViewGroup.label}</p>
                <p className="text-[11px] text-base-content/50">
                  {activeRange.from} – {activeRange.to}
                </p>
              </div>
              <div className="flex gap-4">
                <div className="rounded-2xl border border-base-300/60 bg-base-100/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/70">
                  Movimientos {quickStats.count}
                </div>
                <div className="rounded-2xl border border-base-300/60 bg-base-100/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/70">
                  Total {fmtCLP(quickStats.total)}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3 text-xs text-base-content/70">
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
                onClick={() => onSummaryRangeChange({ from: fallbackRange.from, to: fallbackRange.to })}
              >
                Año en curso
              </Button>
            </div>
            <div className="surface-recessed border border-base-300/70 p-4">
              {quickViewDetails?.loading ? (
                <div className="flex items-center gap-2 text-xs text-base-content/70">
                  <span className="loading loading-spinner loading-xs text-primary" />
                  Cargando movimientos…
                </div>
              ) : quickViewDetails?.error ? (
                <Alert variant="error" className="text-xs">
                  {quickViewDetails.error}
                </Alert>
              ) : quickViewDetails?.rows?.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-base-content">
                    <thead className="bg-base-100/60 text-primary">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Fecha</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">
                          Descripción
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Origen</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Destino</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quickViewDetails.rows.map((movement) => (
                        <tr key={movement.id} className="border-t border-base-200">
                          <td className="px-3 py-2 text-base-content">
                            {dayjs(movement.timestamp).format("DD MMM YYYY HH:mm")}
                          </td>
                          <td className="px-3 py-2 text-base-content">{movement.description ?? "-"}</td>
                          <td className="px-3 py-2 text-base-content">{movement.origin ?? "-"}</td>
                          <td className="px-3 py-2 text-base-content">{movement.destination ?? "-"}</td>
                          <td className="px-3 py-2 text-right text-base-content">
                            {movement.amount != null ? fmtCLP(movement.amount) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-base-content/60">Sin movimientos dentro del rango seleccionado.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-base-300/70 bg-base-100/40 p-8 text-center text-sm text-base-content/60">
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
          {suggestionsLoading ? (
            <span className="text-xs text-base-content/60">Buscando sugerencias...</span>
          ) : accountSuggestions.length ? (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-base-300 bg-base-100">
              {accountSuggestions.map((suggestion) => (
                <div
                  key={suggestion.accountIdentifier}
                  className="flex flex-col gap-1 border-b border-base-300 px-3 py-2 text-xs last:border-b-0"
                >
                  <span className="font-semibold text-base-content">{suggestion.accountIdentifier}</span>
                  <span className="text-base-content/90">{suggestion.holder ?? "(sin titular)"}</span>
                  {suggestion.bankAccountNumber && (
                    <span className="text-xs text-base-content/90">Cuenta {suggestion.bankAccountNumber}</span>
                  )}
                  {suggestion.rut && (
                    <span className="text-xs text-base-content/90">RUT {formatRut(suggestion.rut)}</span>
                  )}
                  <span className="text-xs text-base-content/90">
                    {suggestion.movements} mov. · {fmtCLP(suggestion.totalAmount)}
                  </span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="secondary" size="xs" onClick={() => handleSuggestionClick(suggestion)}>
                      Usar
                    </Button>
                    {selectedId && suggestion.rut && (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => handleAttachRut(suggestion.rut)}
                        disabled={attachLoading}
                      >
                        {attachLoading ? "Vinculando..." : "Vincular por RUT"}
                      </Button>
                    )}
                    {!selectedId && (
                      <Button size="xs" onClick={() => handleSuggestionCreate(suggestion)}>
                        Crear contraparte
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
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
            <Button onClick={() => void handleAddAccount()} disabled={accountStatus === "saving"}>
              {accountStatus === "saving" ? "Guardando..." : "Agregar cuenta"}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
