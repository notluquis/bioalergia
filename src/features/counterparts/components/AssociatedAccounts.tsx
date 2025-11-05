import { Fragment, useState, useMemo, useEffect } from "react";
import type { ChangeEvent, FocusEvent } from "react";
import dayjs from "dayjs";
import { fmtCLP } from "../../../lib/format";
import { formatRut } from "../../../lib/rut";
import Button from "../../../components/Button";
import Input from "../../../components/Input";
import Alert from "../../../components/Alert";
import type { Counterpart, CounterpartAccount, CounterpartAccountSuggestion, CounterpartSummary } from "../types";
import type { DbMovement } from "../../transactions/types";
import { addCounterpartAccount, attachCounterpartRut, fetchAccountSuggestions, updateCounterpartAccount } from "../api";

interface AssociatedAccountsProps {
  selectedId: number | null;
  detail: { counterpart: Counterpart; accounts: CounterpartAccount[] } | null;
  summary: CounterpartSummary | null;
  summaryRange: { from: string; to: string };
  onLoadSummary: (counterpartId: number, from: string, to: string) => Promise<void>;
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

type AccountTransactionsState = {
  expanded: boolean;
  loading: boolean;
  error: string | null;
  rows: DbMovement[];
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

export default function AssociatedAccounts({
  selectedId,
  detail,
  summary,
  summaryRange,
  onLoadSummary,
}: AssociatedAccountsProps) {
  const [accountForm, setAccountForm] = useState<AccountForm>(ACCOUNT_FORM_DEFAULT);
  const [accountStatus, setAccountStatus] = useState<"idle" | "saving">("idle");
  const [accountSuggestions, setAccountSuggestions] = useState<CounterpartAccountSuggestion[]>([]);
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [attachLoading, setAttachLoading] = useState(false);
  const [accountDetails, setAccountDetails] = useState<Record<string, AccountTransactionsState>>({});
  const [error, setError] = useState<string | null>(null);

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
      return;
    }
    if (!accountForm.accountIdentifier.trim()) {
      setError("Ingresa un identificador de cuenta");
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
      await onLoadSummary(selectedId, summaryRange.from, summaryRange.to);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
      return;
    }
    if (!rut) {
      setError("La sugerencia no contiene un RUT válido");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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

  function resolveSourceId(account: CounterpartAccount) {
    return account.metadata?.withdrawId?.trim() || account.account_identifier;
  }

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

  async function fetchTransactionsBySourceId(sourceId: string) {
    const params = new URLSearchParams();
    params.set("sourceId", sourceId);
    params.set("direction", "OUT");
    params.set("includeAmounts", "true");
    params.set("page", "1");
    params.set("pageSize", "200");
    if (summaryRange.from) params.set("from", summaryRange.from);
    if (summaryRange.to) params.set("to", summaryRange.to);

    const res = await fetch(`/api/transactions?${params.toString()}`, { credentials: "include" });
    const payload = (await res.json()) as TransactionsApiResponse;
    if (!res.ok || payload.status !== "ok") {
      throw new Error(payload.message || "No se pudieron obtener los movimientos");
    }
    return payload.data;
  }

  async function fetchGroupTransactions(group: AccountGroup) {
    const uniqueSourceIds = Array.from(new Set(group.accounts.map((account) => resolveSourceId(account))));
    const results = await Promise.all(uniqueSourceIds.map((sourceId) => fetchTransactionsBySourceId(sourceId)));
    const merged = results.flat();
    const dedup = new Map<number, DbMovement>();
    merged.forEach((movement) => {
      if (!dedup.has(movement.id)) {
        dedup.set(movement.id, movement);
      }
    });
    return Array.from(dedup.values()).sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf());
  }

  async function toggleAccountDetails(group: AccountGroup) {
    const identifier = group.key;
    const current = accountDetails[identifier];
    const nextExpanded = !current?.expanded;
    setAccountDetails((prev) => ({
      ...prev,
      [identifier]: {
        expanded: nextExpanded,
        loading: nextExpanded && !current?.rows?.length,
        error: null,
        rows: current?.rows ?? [],
      },
    }));
    if (nextExpanded && (!current || current.rows.length === 0)) {
      try {
        const rows = await fetchGroupTransactions(group);
        setAccountDetails((prev) => ({
          ...prev,
          [identifier]: {
            expanded: true,
            loading: false,
            error: null,
            rows,
          },
        }));
      } catch (err) {
        setAccountDetails((prev) => ({
          ...prev,
          [identifier]: {
            expanded: true,
            loading: false,
            error: err instanceof Error ? err.message : String(err),
            rows: [],
          },
        }));
      }
    }
  }

  return (
    <section className="space-y-5 p-6 bg-base-100">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-primary drop-shadow-sm">Cuentas asociadas</h2>
          <p className="text-xs text-base-content/90">
            Identificadores detectados en los movimientos y asignados a esta contraparte.
          </p>
        </div>
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
                      {group.accounts.length > 1 && (
                        <div className="text-xs text-base-content/90">
                          {group.accounts.length} identificadores vinculados
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-base-content">{group.bankName ?? "-"}</td>
                    <td className="px-3 py-3 text-base-content">{group.holder ?? "-"}</td>
                    <td className="px-3 py-3">
                      <Input
                        type="text"
                        defaultValue={group.concept}
                        onBlur={(event: FocusEvent<HTMLInputElement>) =>
                          handleGroupConceptChange(group, event.target.value)
                        }
                        className="w-full"
                        placeholder="Concepto (ej. Compra de vacunas)"
                      />
                    </td>
                    <td className="px-3 py-3 text-base-content">
                      <div className="flex flex-col gap-2 text-xs">
                        <Button variant="secondary" onClick={() => toggleAccountDetails(group)} className="self-start">
                          {state?.expanded ? "Ocultar movimientos" : "Ver movimientos"}
                        </Button>
                        <div className="text-xs text-base-content/60">
                          {state?.loading
                            ? "Cargando movimientos..."
                            : summaryInfo
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
                  {state?.expanded && (
                    <tr className="bg-base-100/65">
                      <td colSpan={5} className="px-3 pb-4 pt-2">
                        {state.loading ? (
                          <p className="text-xs text-base-content/60">Cargando movimientos...</p>
                        ) : state.error ? (
                          <Alert variant="error" className="text-xs">
                            {state.error}
                          </Alert>
                        ) : state.rows.length ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs text-base-content">
                              <thead className="bg-base-100/60 text-primary">
                                <tr>
                                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide">
                                    Fecha
                                  </th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide">
                                    Descripción
                                  </th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide">
                                    Origen
                                  </th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide">
                                    Destino
                                  </th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide">
                                    Monto
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {state.rows.map((movement) => (
                                  <tr key={movement.id} className="border-t border-base-300">
                                    <td className="px-2 py-2 text-base-content">
                                      {dayjs(movement.timestamp).format("DD MMM YYYY HH:mm")}
                                    </td>
                                    <td className="px-2 py-2 text-base-content">
                                      {movement.description ?? "(sin descripción)"}
                                    </td>
                                    <td className="px-2 py-2 text-base-content">{movement.origin ?? "-"}</td>
                                    <td className="px-2 py-2 text-base-content">{movement.destination ?? "-"}</td>
                                    <td className="px-2 py-2 text-right font-medium text-base-content">
                                      {movement.amount != null ? fmtCLP(movement.amount) : "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-xs text-base-content/60">
                            No se encontraron movimientos para esta cuenta en el rango seleccionado.
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
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

      <div className="border border-base-300 bg-base-100 p-5">
        <h3 className="text-sm font-semibold text-primary drop-shadow-sm">Agregar cuenta</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
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
            <div className="max-h-60 overflow-y-auto border border-base-300 bg-base-100">
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
          <label className="flex flex-col gap-1 text-sm text-base-content">
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Tipo / Concepto</span>
            <div className="flex gap-2">
              <Input
                type="text"
                value={accountForm.accountType}
                onChange={updateAccountForm("accountType")}
                className="w-1/2"
                placeholder="Cuenta corriente"
              />
              <Input
                type="text"
                value={accountForm.concept}
                onChange={updateAccountForm("concept")}
                className="w-1/2"
                placeholder="Concepto"
              />
            </div>
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={handleAddAccount} disabled={accountStatus === "saving"} variant="secondary">
            {accountStatus === "saving" ? "Guardando..." : "Agregar"}
          </Button>
        </div>
      </div>
    </section>
  );
}
