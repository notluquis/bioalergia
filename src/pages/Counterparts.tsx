import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import dayjs from "dayjs";
import {
  createCounterpart,
  fetchCounterpart,
  fetchCounterpartSummary,
  fetchCounterparts,
  updateCounterpart,
  type CounterpartUpsertPayload,
} from "../features/counterparts/api";
import type { Counterpart, CounterpartAccount, CounterpartSummary } from "../features/counterparts/types";
import CounterpartList from "../features/counterparts/components/CounterpartList";
import CounterpartForm from "../features/counterparts/components/CounterpartForm";
import AssociatedAccounts from "../features/counterparts/components/AssociatedAccounts";
import MonthlySummaryChart from "../features/counterparts/components/MonthlySummaryChart";
import ConceptList from "../features/counterparts/components/ConceptList";
import Input from "../components/Input";
import Button from "../components/Button";
import { Card, PageHeader, Stack, Inline } from "../components/Layout";
import { SUMMARY_RANGE_MONTHS } from "../features/counterparts/constants";

export default function CounterpartsPage() {
  const [counterparts, setCounterparts] = useState<Counterpart[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ counterpart: Counterpart; accounts: CounterpartAccount[] } | null>(null);
  const [formStatus, setFormStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  const [summaryRange, setSummaryRange] = useState<{ from: string; to: string }>(() => ({
    from: dayjs().subtract(SUMMARY_RANGE_MONTHS, "month").startOf("month").format("YYYY-MM-DD"),
    to: dayjs().endOf("month").format("YYYY-MM-DD"),
  }));
  const [summary, setSummary] = useState<CounterpartSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Define selectCounterpart first (before any useEffect that depends on it)
  const selectCounterpart = useCallback(async (id: number | null) => {
    setError(null);
    setSummary(null);
    setDetail(null);
    setSelectedId(id);
    if (!id) {
      return;
    }
    try {
      const data = await fetchCounterpart(id);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const loadSummary = useCallback(async (counterpartId: number, from: string, to: string) => {
    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setSummaryLoading(true);
    try {
      const data = await fetchCounterpartSummary(counterpartId, { from, to });
      if (!controller.signal.aborted) {
        setSummary(data);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (!controller.signal.aborted) {
        setSummaryLoading(false);
      }
    }
  }, []);

  // Load initial list of counterparts
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const list = await fetchCounterparts();
      if (cancelled) return;
      setCounterparts(list);
      if (list.length) {
        const firstCounterpart = list[0];
        if (firstCounterpart?.id) selectCounterpart(firstCounterpart.id);
      }
    }
    load().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : String(err));
    });
    return () => {
      cancelled = true;
    };
  }, [selectCounterpart]);

  // Load summary when selectedId or range changes
  useEffect(() => {
    if (selectedId) {
      loadSummary(selectedId, summaryRange.from, summaryRange.to).catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    }
    return () => {
      // Cleanup: cancel any pending summary request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [selectedId, summaryRange.from, summaryRange.to, loadSummary]);

  async function handleSaveCounterpart(payload: CounterpartUpsertPayload) {
    setFormStatus("saving");
    setError(null);
    try {
      if (!payload.name) {
        throw new Error("El nombre es obligatorio");
      }
      let id = selectedId;
      if (id) {
        const data = await updateCounterpart(id, payload);
        setDetail(data);
        id = data.counterpart.id!;
        setCounterparts((prev) =>
          prev.map((item) => (item.id === id ? data.counterpart : item)).sort((a, b) => a.name.localeCompare(b.name))
        );
      } else {
        const data = await createCounterpart(payload);
        setDetail(data);
        id = data.counterpart.id;
        setCounterparts((prev) => [...prev, data.counterpart].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setSelectedId(id);
      if (id) {
        await loadSummary(id, summaryRange.from, summaryRange.to);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormStatus("idle");
    }
  }

  const summaryConcepts = useMemo(() => {
    const map = new Map<string, number>();
    summary?.byAccount.forEach((row) => {
      const key = row.concept ?? "Sin concepto";
      map.set(key, (map.get(key) ?? 0) + row.total);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [summary]);

  return (
    <Stack spacing="lg">
      <PageHeader
        title="Contrapartes"
        description="Gestión de proveedores, prestamistas y otras contrapartes con sus cuentas asociadas y movimientos históricos."
      />

      <Inline spacing="lg" align="start" className="flex-col xl:flex-row">
        <div className="xl:w-72 xl:shrink-0">
          <CounterpartList
            counterparts={counterparts}
            selectedId={selectedId}
            onSelectCounterpart={selectCounterpart}
          />
        </div>

        <Stack spacing="lg" className="flex-1">
          <CounterpartForm
            counterpart={detail?.counterpart}
            onSave={handleSaveCounterpart}
            error={error}
            saving={formStatus === "saving"}
          />

          {selectedId && detail && (
            <AssociatedAccounts
              selectedId={selectedId}
              detail={detail}
              summary={summary}
              summaryRange={summaryRange}
              onLoadSummary={loadSummary}
            />
          )}

          {selectedId && (
            <Card padding="default">
              <Stack spacing="md">
                <Inline justify="between" align="end" className="flex-col lg:flex-row">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-primary drop-shadow-sm">Resumen mensual</h2>
                    <p className="text-xs text-base-content/90">
                      Transferencias de egreso asociadas a esta contraparte.
                    </p>
                  </div>
                  <Inline spacing="sm" align="end" wrap className="text-xs">
                    <Input
                      label="Desde"
                      type="date"
                      value={summaryRange.from}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setSummaryRange((prev) => ({ ...prev, from: event.target.value }))
                      }
                      className="w-40"
                    />
                    <Input
                      label="Hasta"
                      type="date"
                      value={summaryRange.to}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setSummaryRange((prev) => ({ ...prev, to: event.target.value }))
                      }
                      className="w-40"
                    />
                    <Button
                      size="sm"
                      onClick={() => selectedId && loadSummary(selectedId, summaryRange.from, summaryRange.to)}
                      disabled={summaryLoading}
                    >
                      {summaryLoading ? "Calculando..." : "Actualizar"}
                    </Button>
                  </Inline>
                </Inline>

                {summaryLoading ? (
                  <p className="text-xs text-base-content">Calculando resumen...</p>
                ) : summary ? (
                  <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
                    <MonthlySummaryChart data={summary.monthly} />
                    <ConceptList concepts={summaryConcepts} />
                  </div>
                ) : (
                  <p className="text-xs text-base-content">No hay datos disponibles.</p>
                )}
              </Stack>
            </Card>
          )}
        </Stack>
      </Inline>
    </Stack>
  );
}
