/**
 * Clinical Series - List & Filter View
 * Premium UX: debounced search, server-side pagination, Drawer detail panel, sorting
 */

import {
  Button,
  Card,
  Chip,
  Drawer,
  Input,
  Label,
  ListBox,
  Pagination,
  Select,
  Separator,
  Skeleton,
  type SortDescriptor,
  Spinner,
  Surface,
  Table,
  TextField,
} from "@heroui/react";
import type { Key, Selection } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useClinicalSeries, useClinicalSeriesDetail, useRebuildClinicalSeries } from "./queries";
import type {
  ClinicalSeriesFilters,
  ClinicalSeriesKind,
  ClinicalSeriesSnapshot,
  ClinicalSeriesStatus,
} from "./types";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

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

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatEventDate(dateStr: string, showYear = false): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y!, mo! - 1, d).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    ...(showYear && { year: "numeric" }),
  });
}

// ─── Derived snapshot ─────────────────────────────────────────────────────────
// Pre-compute per-row event stats once so sort comparisons are O(1).

type DerivedSnapshot = ClinicalSeriesSnapshot & {
  firstEventDate: string;
  lastEventDate: string;
  nextEventDate: string;
  upcomingCount: number;
};

function deriveSnapshot(s: ClinicalSeriesSnapshot, today: string): DerivedSnapshot {
  const past = s.events.filter((e) => e.eventDate <= today);
  const future = s.events.filter((e) => e.eventDate > today);
  const all = s.events.map((e) => e.eventDate);
  const firstEventDate = all.length ? all.reduce((a, b) => (b < a ? b : a)) : "";
  const lastEventDate = past.length
    ? past.reduce((acc, e) => (e.eventDate > acc ? e.eventDate : acc), past[0]!.eventDate)
    : "";
  const nextEventDate = future.length
    ? future.reduce((acc, e) => (e.eventDate < acc ? e.eventDate : acc), future[0]!.eventDate)
    : "";
  return { ...s, firstEventDate, lastEventDate, nextEventDate, upcomingCount: future.length };
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

function sortItems(items: DerivedSnapshot[], descriptor: SortDescriptor): DerivedSnapshot[] {
  const { column, direction } = descriptor;
  return [...items].sort((a, b) => {
    let cmp = 0;
    switch (column) {
      case "patient":
        cmp = (a.patientName ?? "").localeCompare(b.patientName ?? "", "es");
        break;
      case "kind":
        cmp = KIND_LABELS[a.kind].localeCompare(KIND_LABELS[b.kind], "es");
        break;
      case "status":
        cmp = STATUS_LABELS[a.status].localeCompare(STATUS_LABELS[b.status], "es");
        break;
      case "firstEvent":
        cmp = a.firstEventDate.localeCompare(b.firstEventDate);
        break;
      case "lastEvent":
        cmp = a.lastEventDate.localeCompare(b.lastEventDate);
        break;
      case "nextEvent":
        cmp = a.nextEventDate.localeCompare(b.nextEventDate);
        break;
      case "totalEvents":
        cmp = a.events.length - b.events.length;
        break;
      case "upcomingEvents":
        cmp = a.upcomingCount - b.upcomingCount;
        break;
      case "financial":
        cmp = a.remainingExpected - b.remainingExpected;
        break;
    }
    return direction === "descending" ? -cmp : cmp;
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ClinicalSeriesView() {
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20);

  // Raw filter states (debounced for text fields)
  const [rutRaw, setRutRaw] = useState("");
  const [nameRaw, setNameRaw] = useState("");
  const [kind, setKind] = useState<ClinicalSeriesKind | undefined>(undefined);
  const [status, setStatus] = useState<ClinicalSeriesStatus | undefined>(undefined);

  const debouncedRut = useDebounce(rutRaw);
  const debouncedName = useDebounce(nameRaw);

  // Sorting
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "patient",
    direction: "ascending",
  });

  // Reset page when filters or page size change
  useEffect(() => {
    setPage(1);
  }, [debouncedRut, debouncedName, kind, status, pageSize]);

  // Detail drawer
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filters: ClinicalSeriesFilters = {
    page,
    pageSize: pageSize,
    ...(debouncedRut && { patientRut: debouncedRut }),
    ...(debouncedName && { patientName: debouncedName }),
    ...(kind && { kind }),
    ...(status && { status }),
  };

  const { data, isLoading, error } = useClinicalSeries(filters);
  const { data: detail, isLoading: isLoadingDetail } = useClinicalSeriesDetail(selectedId ?? 0);
  const rebuildMutation = useRebuildClinicalSeries();

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  const sortedItems = useMemo(() => {
    if (!data?.items) return [];
    const today = getTodayStr();
    return sortItems(
      data.items.map((s) => deriveSnapshot(s, today)),
      sortDescriptor
    );
  }, [data?.items, sortDescriptor]);

  const handleRowSelect = (keys: Selection) => {
    if (keys === "all") return;
    const [firstKey] = keys;
    if (firstKey !== undefined) {
      setSelectedId(Number(firstKey));
      setDrawerOpen(true);
    }
  };

  const handleDrawerOpenChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) setSelectedId(null);
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
        <div className="flex flex-wrap gap-3 items-end">
          {/* RUT */}
          <TextField className="flex-1 min-w-35" value={rutRaw} onChange={setRutRaw}>
            <Label>RUT</Label>
            <Input placeholder="12345678-9" />
          </TextField>

          {/* Nombre */}
          <TextField className="flex-1 min-w-35" value={nameRaw} onChange={setNameRaw}>
            <Label>Paciente</Label>
            <Input placeholder="Nombre..." />
          </TextField>

          {/* Tipo */}
          <div className="flex flex-col gap-1 min-w-40">
            <Select
              onChange={handleKindChange}
              value={(kind as Key) ?? null}
              placeholder="Todos los tipos"
              variant="secondary"
            >
              <Label>Tipo</Label>
              <Select.Trigger>
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
            <Select
              onChange={handleStatusChange}
              value={(status as Key) ?? null}
              placeholder="Todos los estados"
              variant="secondary"
            >
              <Label>Estado</Label>
              <Select.Trigger>
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
            <Button onPress={clearFilters} variant="ghost" size="sm" className="self-end">
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
                sortDescriptor={sortDescriptor}
                onSortChange={setSortDescriptor}
                className="min-w-5xl"
              >
                <Table.Header>
                  <Table.Column allowsSorting id="patient" isRowHeader className="w-[24%]">
                    Paciente
                  </Table.Column>
                  <Table.Column allowsSorting id="kind" className="w-[11%]">
                    Tipo
                  </Table.Column>
                  <Table.Column allowsSorting id="status" className="w-[10%]">
                    Estado
                  </Table.Column>
                  <Table.Column allowsSorting id="lastEvent" className="w-[10%]">
                    Últ. evento
                  </Table.Column>
                  <Table.Column allowsSorting id="nextEvent" className="w-[10%]">
                    Próx. visita
                  </Table.Column>
                  <Table.Column allowsSorting id="totalEvents" className="w-[7%] text-right">
                    Eventos
                  </Table.Column>
                  <Table.Column allowsSorting id="upcomingEvents" className="w-[8%] text-right">
                    Próximos
                  </Table.Column>
                  <Table.Column allowsSorting id="financial" className="w-[20%] text-right">
                    Financiero
                  </Table.Column>
                </Table.Header>
                <Table.Body>
                  {sortedItems.map((s) => (
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
                        <Chip size="sm" color={STATUS_COLORS[s.status]} variant="soft">
                          {STATUS_LABELS[s.status]}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-xs text-foreground-400">
                          {s.lastEventDate ? formatEventDate(s.lastEventDate, true) : "—"}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        {s.nextEventDate ? (
                          <span className="text-xs font-medium text-accent">
                            {formatEventDate(s.nextEventDate)}
                          </span>
                        ) : (
                          <span className="text-xs text-foreground-400">—</span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <span className="text-xs tabular-nums text-foreground-500">
                          {s.events.length}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {s.upcomingCount > 0 ? (
                          <Chip size="sm" color="accent" variant="soft">
                            {s.upcomingCount}
                          </Chip>
                        ) : (
                          <span className="text-xs text-foreground-400">—</span>
                        )}
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
      {data && (
        <div className="flex items-center justify-between text-sm text-foreground-400">
          <div className="flex items-center gap-3">
            <span>
              {data.total > 0
                ? `Mostrando ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, data.total)} de ${data.total}`
                : `${data.total} resultados`}
            </span>
            <Select
              value={String(pageSize)}
              onChange={(key) =>
                key && setPageSize(Number(key) as (typeof PAGE_SIZE_OPTIONS)[number])
              }
              variant="secondary"
              aria-label="Filas por página"
            >
              <Select.Trigger className="w-24">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <ListBox.Item key={n} id={String(n)} textValue={`${n} / pág.`}>
                      {n} / pág.
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          {totalPages > 1 && (
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
          )}
        </div>
      )}

      {/* ── Detail Drawer ────────────────────────────────────────────────── */}
      <Drawer>
        <Drawer.Backdrop isOpen={drawerOpen} onOpenChange={handleDrawerOpenChange} variant="blur">
          <Drawer.Content placement="right">
            <Drawer.Dialog>
              <Drawer.CloseTrigger />
              <Drawer.Header>
                <Drawer.Heading>
                  {isLoadingDetail ? (
                    <Skeleton className="h-5 w-32 rounded-lg" />
                  ) : (
                    (detail?.patientName ?? "Detalle")
                  )}
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
                      <Chip size="sm" color={STATUS_COLORS[detail.status]} variant="soft">
                        {STATUS_LABELS[detail.status]}
                      </Chip>
                    </div>

                    {/* Events grouped by year */}
                    {detail.events.length > 0 &&
                      (() => {
                        const today = getTodayStr();
                        const byYear = detail.events.reduce<Record<string, typeof detail.events>>(
                          (acc, ev) => {
                            const year = ev.eventDate.slice(0, 4);
                            (acc[year] ??= []).push(ev);
                            return acc;
                          },
                          {}
                        );
                        const years = Object.keys(byYear).sort();
                        return (
                          <div>
                            <h3 className="text-sm font-semibold mb-3">
                              Eventos ({detail.events.length})
                            </h3>
                            <div className="space-y-4">
                              {years.map((year) => (
                                <div key={year} className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <Separator className="flex-1" />
                                    <Chip size="sm" variant="soft" color="default">
                                      {year}
                                    </Chip>
                                    <Separator className="flex-1" />
                                  </div>
                                  {byYear[year]!.map((event) => {
                                    const isFuture = event.eventDate > today;
                                    return (
                                      <Surface
                                        key={event.eventId}
                                        className={`p-2.5 rounded-lg text-xs${isFuture ? " ring-1 ring-accent/30" : ""}`}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span
                                            className={`font-medium${isFuture ? " text-accent" : ""}`}
                                          >
                                            {formatEventDate(event.eventDate)}
                                          </span>
                                          <div className="flex items-center gap-1.5">
                                            {isFuture && (
                                              <span className="text-[10px] text-accent font-medium uppercase tracking-wide">
                                                próximo
                                              </span>
                                            )}
                                            {event.seriesStageLabel && (
                                              <span className="text-foreground-400">
                                                {event.seriesStageLabel}
                                              </span>
                                            )}
                                          </div>
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
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
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
