/**
 * Clinical Series - List & Filter View
 * Premium UX: debounced search, server-side pagination, Drawer detail panel
 */

import {
  Badge,
  Button,
  Card,
  Chip,
  Drawer,
  ListBox,
  Pagination,
  Select,
  Spinner,
  Surface,
  Table,
} from "@heroui/react";
import type { Key, Selection } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { useClinicalSeries, useClinicalSeriesDetail, useRebuildClinicalSeries } from "./queries";
import type {
  ClinicalSeriesFilters,
  ClinicalSeriesKind,
  ClinicalSeriesSnapshot,
  ClinicalSeriesStatus,
} from "./types";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const KIND_OPTIONS: { label: string; value: ClinicalSeriesKind }[] = [
  { label: "Prueba de Parche", value: "PATCH_TEST" },
  { label: "Test Alérgico", value: "SKIN_TEST" },
  { label: "Tratamiento Subcutáneo", value: "SUBCUTANEOUS_TREATMENT" },
];

const STATUS_OPTIONS: { label: string; value: ClinicalSeriesStatus }[] = [
  { label: "Activa", value: "ACTIVE" },
  { label: "Completada", value: "COMPLETED" },
  { label: "Cancelada", value: "CANCELLED" },
];

const KIND_LABELS: Record<ClinicalSeriesKind, string> = {
  PATCH_TEST: "Parche",
  SKIN_TEST: "Test",
  SUBCUTANEOUS_TREATMENT: "Subcutáneo",
};

const KIND_COLORS: Record<ClinicalSeriesKind, "accent" | "success" | "warning"> = {
  PATCH_TEST: "warning",
  SKIN_TEST: "accent",
  SUBCUTANEOUS_TREATMENT: "success",
};

const STATUS_COLORS: Record<ClinicalSeriesStatus, "success" | "default" | "danger"> = {
  ACTIVE: "success",
  COMPLETED: "default",
  CANCELLED: "danger",
};

const STATUS_LABELS: Record<ClinicalSeriesStatus, string> = {
  ACTIVE: "Activa",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
};

// ─── Debounce Hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(value), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, delay]);

  return debounced;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ClinicalSeriesView() {
  // Pagination state
  const [page, setPage] = useState(1);

  // Raw filter states (debounced for text fields)
  const [rutRaw, setRutRaw] = useState("");
  const [nameRaw, setNameRaw] = useState("");
  const [kind, setKind] = useState<ClinicalSeriesKind | undefined>(undefined);
  const [status, setStatus] = useState<ClinicalSeriesStatus | undefined>(undefined);

  const debouncedRut = useDebounce(rutRaw);
  const debouncedName = useDebounce(nameRaw);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedRut, debouncedName, kind, status]);

  // Detail drawer
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filters: ClinicalSeriesFilters = {
    page,
    pageSize: PAGE_SIZE,
    ...(debouncedRut && { patientRut: debouncedRut }),
    ...(debouncedName && { patientName: debouncedName }),
    ...(kind && { kind }),
    ...(status && { status }),
  };

  const { data, isLoading, error } = useClinicalSeries(filters);
  const { data: detail, isLoading: isLoadingDetail } = useClinicalSeriesDetail(selectedId ?? 0);
  const rebuildMutation = useRebuildClinicalSeries();

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const handleRowSelect = (keys: Selection) => {
    if (keys === "all") return;
    const [firstKey] = keys;
    if (firstKey !== undefined) {
      setSelectedId(Number(firstKey));
      setDrawerOpen(true);
    }
  };

  const handleKindChange = (value: Key | null) => {
    setKind(value ? (value as ClinicalSeriesKind) : undefined);
  };

  const handleStatusChange = (value: Key | null) => {
    setStatus(value ? (value as ClinicalSeriesStatus) : undefined);
  };

  const hasFilters = !!debouncedRut || !!debouncedName || !!kind || !!status;

  const clearFilters = () => {
    setRutRaw("");
    setNameRaw("");
    setKind(undefined);
    setStatus(undefined);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Series Clínicas</h1>
          <p className="text-sm text-foreground-400 mt-0.5">
            {data ? (
              <>
                <span className="font-medium text-foreground-600">{data.total}</span> series totales
              </>
            ) : (
              "Tratamientos y pruebas alérgicas agrupados"
            )}
          </p>
        </div>
        <Button
          isDisabled={rebuildMutation.isPending}
          isPending={rebuildMutation.isPending}
          onPress={() => rebuildMutation.mutateAsync({})}
          variant="secondary"
          size="sm"
        >
          Reorganizar Series
        </Button>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <Surface className="rounded-xl p-3">
        <div className="flex flex-wrap gap-2 items-end">
          {/* RUT */}
          <div className="flex flex-col gap-1 flex-1 min-w-35">
            <label className="text-xs font-medium text-foreground-400 uppercase tracking-wide">
              RUT
            </label>
            <input
              className="h-9 rounded-lg border border-default-200 bg-default-100 px-3 text-sm text-foreground placeholder:text-foreground-400 outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              onChange={(e) => setRutRaw(e.target.value)}
              placeholder="12345678-9"
              type="text"
              value={rutRaw}
            />
          </div>

          {/* Nombre */}
          <div className="flex flex-col gap-1 flex-1 min-w-35">
            <label className="text-xs font-medium text-foreground-400 uppercase tracking-wide">
              Paciente
            </label>
            <input
              className="h-9 rounded-lg border border-default-200 bg-default-100 px-3 text-sm text-foreground placeholder:text-foreground-400 outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              onChange={(e) => setNameRaw(e.target.value)}
              placeholder="Nombre..."
              type="text"
              value={nameRaw}
            />
          </div>

          {/* Tipo */}
          <div className="flex flex-col gap-1 min-w-40">
            <label className="text-xs font-medium text-foreground-400 uppercase tracking-wide">
              Tipo
            </label>
            <Select
              onChange={handleKindChange}
              value={(kind as Key) ?? null}
              placeholder="Todos"
              className="h-9"
              variant="secondary"
            >
              <Select.Trigger className="h-9">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {KIND_OPTIONS.map((item) => (
                    <ListBox.Item id={item.value} key={item.value} textValue={item.label}>
                      {item.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {/* Estado */}
          <div className="flex flex-col gap-1 min-w-35">
            <label className="text-xs font-medium text-foreground-400 uppercase tracking-wide">
              Estado
            </label>
            <Select
              onChange={handleStatusChange}
              value={(status as Key) ?? null}
              placeholder="Todos"
              variant="secondary"
            >
              <Select.Trigger className="h-9">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {STATUS_OPTIONS.map((item) => (
                    <ListBox.Item id={item.value} key={item.value} textValue={item.label}>
                      {item.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <Button onPress={clearFilters} variant="ghost" size="sm" className="self-end h-9">
              Limpiar
            </Button>
          )}
        </div>
      </Surface>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <Card className="p-4 bg-danger-50 border border-danger-200">
          <p className="text-sm text-danger">
            {error instanceof Error ? error.message : "Error al cargar los datos"}
          </p>
        </Card>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <Card className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <Spinner size="lg" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-foreground-400 text-sm">
              {hasFilters
                ? "No hay resultados para los filtros aplicados"
                : "No hay series clínicas"}
            </p>
            {hasFilters && (
              <Button onPress={clearFilters} variant="ghost" size="sm">
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Series Clínicas"
                selectionMode="single"
                selectedKeys={selectedId !== null ? new Set([selectedId]) : new Set()}
                onSelectionChange={handleRowSelect}
                className="min-w-125"
              >
                <Table.Header>
                  <Table.Column isRowHeader className="w-[40%]">
                    Paciente
                  </Table.Column>
                  <Table.Column className="w-[20%]">Tipo</Table.Column>
                  <Table.Column className="w-[15%]">Estado</Table.Column>
                  <Table.Column className="w-[25%] text-right">Financiero</Table.Column>
                </Table.Header>
                <Table.Body>
                  {data.items.map((s: ClinicalSeriesSnapshot) => (
                    <Table.Row key={s.id} id={s.id} className="cursor-pointer group">
                      <Table.Cell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                            {s.patientName || (
                              <span className="text-foreground-400 italic">Sin nombre</span>
                            )}
                          </span>
                          <span className="text-xs text-foreground-400 font-mono">
                            {s.patientRut ?? "—"}
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" color={KIND_COLORS[s.kind]} variant="soft">
                          {KIND_LABELS[s.kind]}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={STATUS_COLORS[s.status]} size="sm">
                          {STATUS_LABELS[s.status]}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xs text-foreground-400">
                            ${s.totalPaid.toLocaleString("es-CL")} /
                            <span className="text-foreground-500">
                              {" "}
                              ${s.totalExpected.toLocaleString("es-CL")}
                            </span>
                          </span>
                          {s.remainingExpected > 0 && (
                            <span className="text-xs text-danger font-medium">
                              −${s.remainingExpected.toLocaleString("es-CL")} pend.
                            </span>
                          )}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}
      </Card>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-foreground-400">
          <span>
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} de{" "}
            {data.total}
          </span>
          <Pagination size="sm">
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={page === 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Pagination.PreviousIcon />
                  Anterior
                </Pagination.Previous>
              </Pagination.Item>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p =
                  totalPages <= 7
                    ? i + 1
                    : page <= 4
                      ? i + 1
                      : page >= totalPages - 3
                        ? totalPages - 6 + i
                        : page - 3 + i;
                return (
                  <Pagination.Item key={p}>
                    <Pagination.Link isActive={p === page} onPress={() => setPage(p)}>
                      {p}
                    </Pagination.Link>
                  </Pagination.Item>
                );
              })}
              <Pagination.Item>
                <Pagination.Next
                  isDisabled={page === totalPages}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Siguiente
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
        </div>
      )}

      {/* ── Detail Drawer ────────────────────────────────────────────────── */}
      <Drawer>
        <Drawer.Backdrop isOpen={drawerOpen} onOpenChange={setDrawerOpen} variant="blur">
          <Drawer.Content placement="right">
            <Drawer.Dialog>
              <Drawer.CloseTrigger />
              <Drawer.Header>
                <Drawer.Heading>
                  {detail?.patientName ?? (isLoadingDetail ? "Cargando..." : "Detalle")}
                </Drawer.Heading>
                {detail?.patientRut && (
                  <p className="font-mono text-xs text-foreground-400 mt-0.5">
                    {detail.patientRut}
                  </p>
                )}
              </Drawer.Header>

              <Drawer.Body>
                {isLoadingDetail ? (
                  <div className="flex justify-center pt-8">
                    <Spinner />
                  </div>
                ) : detail ? (
                  <div className="space-y-4">
                    {/* Financial summary */}
                    <div className="grid grid-cols-2 gap-2">
                      <Surface className="p-3 rounded-xl">
                        <p className="text-xs text-foreground-400 mb-1">Esperado</p>
                        <p className="font-semibold text-accent text-lg">
                          ${detail.totalExpected.toLocaleString("es-CL")}
                        </p>
                      </Surface>
                      <Surface className="p-3 rounded-xl">
                        <p className="text-xs text-foreground-400 mb-1">Pagado</p>
                        <p className="font-semibold text-success text-lg">
                          ${detail.totalPaid.toLocaleString("es-CL")}
                        </p>
                      </Surface>
                      <Surface className="p-3 rounded-xl">
                        <p className="text-xs text-foreground-400 mb-1">Pendiente</p>
                        <p
                          className={`font-semibold text-lg ${detail.remainingExpected > 0 ? "text-danger" : "text-foreground"}`}
                        >
                          ${detail.remainingExpected.toLocaleString("es-CL")}
                        </p>
                      </Surface>
                      <Surface className="p-3 rounded-xl">
                        <p className="text-xs text-foreground-400 mb-1">Eventos</p>
                        <p className="font-semibold text-lg">{detail.events.length}</p>
                      </Surface>
                    </div>

                    {/* Tipo + Estado */}
                    <div className="flex gap-2">
                      <Chip size="sm" color={KIND_COLORS[detail.kind]} variant="soft">
                        {KIND_LABELS[detail.kind]}
                      </Chip>
                      <Badge color={STATUS_COLORS[detail.status]} size="sm">
                        {STATUS_LABELS[detail.status]}
                      </Badge>
                    </div>

                    {/* Events */}
                    {detail.events.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">
                          Eventos ({detail.events.length})
                        </h3>
                        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                          {detail.events.map((event) => (
                            <Surface key={event.eventId} className="p-2.5 rounded-lg text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{event.eventDate}</span>
                                {event.seriesStageLabel && (
                                  <span className="text-foreground-400">
                                    {event.seriesStageLabel}
                                  </span>
                                )}
                              </div>
                              {event.summary && (
                                <p className="text-foreground-400 truncate mt-0.5">
                                  {event.summary}
                                </p>
                              )}
                              {event.dosageValue != null && (
                                <p className="text-accent mt-0.5 font-medium">
                                  {event.dosageValue} {event.dosageUnit}
                                </p>
                              )}
                              {event.amountExpected != null && (
                                <p className="text-foreground-400 mt-0.5">
                                  ${(event.amountPaid ?? 0).toLocaleString("es-CL")} / $
                                  {event.amountExpected.toLocaleString("es-CL")}
                                </p>
                              )}
                            </Surface>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </div>
  );
}
