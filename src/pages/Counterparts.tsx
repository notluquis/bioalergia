import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  attachCounterpartRut,
  createCounterpart,
  fetchCounterpart,
  fetchCounterpartSummary,
  fetchCounterparts,
  updateCounterpart,
  type CounterpartUpsertPayload,
} from "../features/counterparts/api";
import type {
  Counterpart,
  CounterpartAccount,
  CounterpartSummary,
  CounterpartPersonType,
  CounterpartCategory,
} from "../features/counterparts/types";
import CounterpartList from "../features/counterparts/components/CounterpartList";
import CounterpartForm from "../features/counterparts/components/CounterpartForm";
import AssociatedAccounts from "../features/counterparts/components/AssociatedAccounts";
import Button from "../components/Button";
import { ServicesHero, ServicesSurface, ServicesGrid } from "../features/services/components/ServicesShell";
import { SUMMARY_RANGE_MONTHS } from "../features/counterparts/constants";
import { useToast } from "../context/ToastContext";
import { normalizeRut } from "../lib";
import Modal from "../components/Modal";

export default function CounterpartsPage() {
  const pendingDetailRequestRef = useRef(0);
  const currentDetailRef = useRef<Counterpart | null>(null);
  const selectedIdRef = useRef<number | null>(null);
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
  const [detailLoading, setDetailLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const [personTypeFilter, setPersonTypeFilter] = useState<CounterpartPersonType | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<CounterpartCategory | "ALL">("ALL");
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formCounterpart, setFormCounterpart] = useState<Counterpart | null>(null);

  useEffect(() => {
    currentDetailRef.current = detail?.counterpart ?? null;
  }, [detail]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const openFormModal = useCallback((target: Counterpart | null = null) => {
    setFormCounterpart(target);
    setIsFormModalOpen(true);
  }, []);

  const closeFormModal = useCallback(() => {
    setIsFormModalOpen(false);
    setFormCounterpart(null);
  }, []);

  // Define selectCounterpart first (before any useEffect that depends on it)
  const selectCounterpart = useCallback(
    async (id: number | null, options: { force?: boolean } = {}) => {
      setError(null);
      setSelectedId(id);
      if (!id) {
        pendingDetailRequestRef.current += 1;
        currentDetailRef.current = null;
        selectedIdRef.current = null;
        setDetail(null);
        setSummary(null);
        setDetailLoading(false);
        return;
      }

      const currentDetail = currentDetailRef.current;
      if (!options.force && currentDetail && currentDetail.id === id && selectedIdRef.current === id) {
        return;
      }

      const requestId = pendingDetailRequestRef.current + 1;
      pendingDetailRequestRef.current = requestId;
      setDetailLoading(true);
      try {
        const data = await fetchCounterpart(id);
        if (pendingDetailRequestRef.current === requestId) {
          setDetail(data);
        }
      } catch (err) {
        if (pendingDetailRequestRef.current === requestId) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          toastError(message || "No se pudo cargar la contraparte");
        }
      } finally {
        if (pendingDetailRequestRef.current === requestId) {
          setDetailLoading(false);
        }
      }
    },
    [toastError]
  );

  const loadSummary = useCallback(
    async (counterpartId: number, from: string, to: string) => {
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
          toastError("No se pudo calcular el resumen mensual");
        }
      } finally {
        if (!controller.signal.aborted) {
          setSummaryLoading(false);
        }
      }
    },
    [toastError]
  );

  // Load initial list of counterparts
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const list = await fetchCounterparts();
      if (cancelled) return;
      setCounterparts(list);
    }
    load().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : String(err));
    });
    return () => {
      cancelled = true;
      pendingDetailRequestRef.current += 1;
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
    const normalizedRut = normalizeRut(payload.rut ?? null);
    const previousRut = normalizeRut(detail?.counterpart?.rut ?? null);
    const previousSelectedId = selectedIdRef.current;
    let saved = false;
    try {
      if (!payload.name) {
        throw new Error("El nombre es obligatorio");
      }
      let id = selectedId;
      let created = false;
      if (id) {
        const data = await updateCounterpart(id, payload);
        setDetail(data);
        id = data.counterpart.id!;
        setCounterparts((prev) =>
          prev.map((item) => (item.id === id ? data.counterpart : item)).sort((a, b) => a.name.localeCompare(b.name))
        );
        toastSuccess("Contraparte actualizada correctamente");
      } else {
        const data = await createCounterpart(payload);
        setDetail(data);
        id = data.counterpart.id;
        created = true;
        setCounterparts((prev) => [...prev, data.counterpart].sort((a, b) => a.name.localeCompare(b.name)));
        toastSuccess("Contraparte creada correctamente");
      }
      saved = true;

      if (id) {
        const shouldAttachByRut = normalizedRut && (created || normalizedRut !== previousRut);
        if (shouldAttachByRut) {
          try {
            const attachedAccounts = await attachCounterpartRut(id, normalizedRut);
            setDetail((prev) => {
              if (!prev || prev.counterpart.id !== id) return prev;
              return { ...prev, accounts: attachedAccounts };
            });
            toastInfo("Cuentas detectadas vinculadas automáticamente");
          } catch (attachError) {
            const message =
              attachError instanceof Error ? attachError.message : "No se pudieron vincular las cuentas detectadas";
            toastError(message);
          }
        }
        await selectCounterpart(id, { force: true });
        if (previousSelectedId === id) {
          await loadSummary(id, summaryRange.from, summaryRange.to);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      toastError(err instanceof Error ? err.message : "No se pudo guardar la contraparte");
    } finally {
      setFormStatus("idle");
      if (saved) {
        closeFormModal();
      }
    }
  }

  const handleSelectCounterpart = useCallback(
    (id: number | null) => {
      void selectCounterpart(id);
    },
    [selectCounterpart]
  );

  const handleSummaryRangeChange = useCallback((update: Partial<{ from: string; to: string }>) => {
    setSummaryRange((prev) => ({ ...prev, ...update }));
  }, []);

  const PERSON_FILTERS: Array<{ label: string; value: CounterpartPersonType | "ALL" }> = [
    { label: "Todas las personas", value: "ALL" },
    { label: "Persona natural", value: "PERSON" },
    { label: "Empresa", value: "COMPANY" },
    { label: "Otros", value: "OTHER" },
  ];
  const CATEGORY_FILTERS: Array<{ label: string; value: CounterpartCategory | "ALL" }> = [
    { label: "Todos los tipos", value: "ALL" },
    { label: "Proveedores", value: "SUPPLIER" },
    { label: "Prestamistas", value: "LENDER" },
    { label: "Clientes", value: "CLIENT" },
    { label: "Empleados", value: "EMPLOYEE" },
    { label: "Ocasionales", value: "OCCASIONAL" },
  ];

  const deduplicatedCounterparts = useMemo(() => {
    const map = new Map<string, Counterpart>();
    for (const item of counterparts) {
      const rutKey = item.rut ? normalizeRut(item.rut) : null;
      const nameKey = item.name.trim().toLowerCase();
      const key = (rutKey ?? nameKey) || item.id.toString();
      if (!map.has(key)) {
        map.set(key, item);
      }
    }
    return Array.from(map.values());
  }, [counterparts]);

  const visibleCounterparts = useMemo(() => {
    return deduplicatedCounterparts.filter((item) => {
      const matchesPersonType = personTypeFilter === "ALL" || item.personType === personTypeFilter;
      const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
      return matchesPersonType && matchesCategory;
    });
  }, [deduplicatedCounterparts, personTypeFilter, categoryFilter]);

  return (
    <section className="space-y-8">
      <ServicesHero
        title="Contrapartes"
        description="Gestiona proveedores, prestamistas y clientes con sus cuentas asociadas y movimientos históricos."
        actions={<Button onClick={() => openFormModal(null)}>+ Nueva contraparte</Button>}
      />
      <ServicesSurface>
        <div className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-base-content/60">Filtros rápidos</p>
              <p className="text-sm text-base-content/70">Acota la lista por tipo de persona y clasificación.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPersonTypeFilter("ALL");
                setCategoryFilter("ALL");
              }}
            >
              Reset filtros
            </Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-base-content/60">Tipo de persona</p>
              <div className="flex flex-wrap gap-2">
                {PERSON_FILTERS.map((filter) => (
                  <Button
                    key={filter.value}
                    size="sm"
                    variant={personTypeFilter === filter.value ? "primary" : "ghost"}
                    onClick={() => setPersonTypeFilter(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-base-content/60">Clasificación</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_FILTERS.map((filter) => (
                  <Button
                    key={filter.value}
                    size="sm"
                    variant={categoryFilter === filter.value ? "primary" : "ghost"}
                    onClick={() => setCategoryFilter(filter.value)}
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
            counterparts={visibleCounterparts}
            selectedId={selectedId}
            onSelectCounterpart={handleSelectCounterpart}
            className="max-h-[calc(100vh-220px)]"
          />
        </ServicesSurface>

        <div className="space-y-6">
          <ServicesSurface className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">Contraparte activa</p>
                <h3 className="text-lg font-semibold text-base-content">
                  {detail?.counterpart.name ?? "Selecciona un registro"}
                </h3>
                {detail?.counterpart.rut && (
                  <p className="text-xs text-base-content/70">RUT {detail.counterpart.rut}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!detail}
                onClick={() => detail && openFormModal(detail.counterpart)}
              >
                {detail ? "Editar contraparte" : "Selecciona para editar"}
              </Button>
            </div>
            {detail ? (
              <div className="grid gap-3 text-xs text-base-content/70 sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-base-content/60">Clasificación</p>
                  <p className="text-sm text-base-content">{detail.counterpart.category ?? "—"}</p>
                </div>
                <div>
                  <p className="font-semibold text-base-content/60">Tipo de persona</p>
                  <p className="text-sm text-base-content">{detail.counterpart.personType}</p>
                </div>
                {detail.counterpart.email && (
                  <div className="sm:col-span-2">
                    <p className="font-semibold text-base-content/60">Correo electrónico</p>
                    <p className="text-sm text-base-content">{detail.counterpart.email}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-base-300 bg-base-200/70 p-6 text-xs text-base-content/70">
                Haz clic en una contraparte para ver sus cuentas activas, movimientos y opciones rápidas.
              </div>
            )}
          </ServicesSurface>

          {selectedId && detail && (
            <AssociatedAccounts
              selectedId={selectedId}
              detail={detail}
              summary={summary}
              summaryRange={summaryRange}
              summaryLoading={summaryLoading}
              onLoadSummary={loadSummary}
              onSummaryRangeChange={handleSummaryRangeChange}
            />
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
          onSave={handleSaveCounterpart}
          error={error}
          saving={formStatus === "saving"}
          loading={Boolean(formCounterpart && formCounterpart.id === selectedId && detailLoading)}
        />
      </Modal>
    </section>
  );
}
