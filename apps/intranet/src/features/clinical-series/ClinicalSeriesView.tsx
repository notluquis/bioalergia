/**
 * Clinical Series - List & Filter View
 * Premium UX: debounced search, server-side pagination, Drawer detail panel, sorting
 */

import {
  Alert,
  Button,
  Card,
  Chip,
  Drawer,
  Input,
  Label,
  ListBox,
  Pagination,
  ProgressBar,
  Select,
  Separator,
  Skeleton,
  type SortDescriptor,
  Spinner,
  Surface,
  Table,
  TextField,
} from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import type { Key, Selection } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EventDteLinkModal } from "@/features/calendar/components/EventDteLinkModal";
import type { CalendarEventDetail } from "@/features/calendar/types";
import {
  clinicalSeriesKeys,
  useClinicalSeries,
  useClinicalSeriesDetail,
  useClinicalSeriesRebuildProgress,
  useRebuildClinicalSeries,
} from "./queries";
import type {
  ClinicalSeriesEvent,
  ClinicalSeriesFilters,
  ClinicalSeriesKind,
  ClinicalSeriesSnapshot,
  ClinicalSeriesSortColumn,
  ClinicalSeriesStatus,
  SubcutaneousAllergenType,
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

const ALLERGEN_LABELS: Record<SubcutaneousAllergenType, string> = {
  ACAROS: "Ácaros",
  GRAMINEAS: "Gramíneas",
  ACAROS_GRAMINEAS: "Ácaros + Gramíneas",
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

// ─── Financial helpers ────────────────────────────────────────────────────────
// "unknown"  → parser found no amount (null)   → "Por definir"
// "free"     → amount is explicitly 0           → "Sin costo"
// "paid"     → amount > 0                       → show monetary value

type FinancialStatus = "free" | "paid" | "unknown";

function seriesFinancialStatus(
  events: ClinicalSeriesEvent[],
  today = getTodayStr()
): FinancialStatus {
  const dueEvents = events.filter((event) => event.eventDate <= today);
  if (dueEvents.some((e) => e.amountExpected != null && e.amountExpected > 0)) return "paid";
  if (dueEvents.some((e) => e.amountExpected === 0)) return "free";
  return "unknown";
}

function eventFinancialStatus(event: ClinicalSeriesEvent): FinancialStatus {
  if (event.amountExpected == null) return "unknown";
  if (event.amountExpected === 0) return "free";
  return "paid";
}

function compareSeriesEventsDesc(a: ClinicalSeriesEvent, b: ClinicalSeriesEvent) {
  const dateDiff = b.eventDate.localeCompare(a.eventDate);
  if (dateDiff !== 0) return dateDiff;
  return b.eventId - a.eventId;
}

function clinicalEventHeadline(event: ClinicalSeriesEvent): string {
  return event.seriesStageLabel ?? event.summary ?? "Evento";
}

function clinicalEventSupportText(event: ClinicalSeriesEvent): null | string {
  if (event.seriesStageLabel && event.summary) return event.summary;
  return null;
}

function toCalendarEventDetail(event: ClinicalSeriesEvent): CalendarEventDetail {
  return {
    amountExpected: event.amountExpected ?? null,
    amountPaid: event.amountPaid ?? null,
    attended: null,
    beneficiaryName: null,
    beneficiaryRut: null,
    calendarId: event.calendarGoogleId,
    category: null,
    clinicalSeriesId: null,
    colorId: null,
    controlIncluded: null,
    description: event.summary ?? null,
    dosageUnit: event.dosageUnit ?? null,
    dosageValue: event.dosageValue ?? null,
    seriesStageKind: event.seriesStageKind ?? null,
    seriesStageLabel: event.seriesStageLabel ?? null,
    seriesStageNumber: event.seriesStageNumber ?? null,
    endDate: event.eventDate,
    endDateTime: null,
    endTimeZone: null,
    eventCreatedAt: null,
    eventDate: event.eventDate,
    eventDateTime: null,
    eventId: event.externalEventId,
    eventType: null,
    eventUpdatedAt: null,
    hangoutLink: null,
    isDomicilio: null,
    location: null,
    patientName: event.patientName ?? null,
    patientRut: event.patientRut ?? null,
    rawEvent: null,
    startDate: event.eventDate,
    startDateTime: null,
    startTimeZone: null,
    status: null,
    summary: event.summary ?? event.seriesStageLabel ?? null,
    testMetadata: null,
    transparency: null,
    treatmentStage: null,
    visibility: null,
  };
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function ClinicalSeriesView() {
  const queryClient = useQueryClient();
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20);

  // Raw filter states (debounced for text fields)
  const [rutRaw, setRutRaw] = useState("");
  const [beneficiaryRutRaw, setBeneficiaryRutRaw] = useState("");
  const [nameRaw, setNameRaw] = useState("");
  const [kind, setKind] = useState<ClinicalSeriesKind | undefined>(undefined);
  const [status, setStatus] = useState<ClinicalSeriesStatus | undefined>(undefined);

  const debouncedRut = useDebounce(rutRaw);
  const debouncedBeneficiaryRut = useDebounce(beneficiaryRutRaw);
  const debouncedName = useDebounce(nameRaw);

  // Sorting
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "lastEvent",
    direction: "descending",
  });

  // Reset page when filters or page size change
  useEffect(() => {
    setPage(1);
  }, [debouncedBeneficiaryRut, debouncedRut, debouncedName, kind, status, pageSize]);

  // Detail drawer
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSeriesEvent, setSelectedSeriesEvent] = useState<CalendarEventDetail | null>(null);

  const filters: ClinicalSeriesFilters = {
    page,
    pageSize: pageSize,
    ...(debouncedBeneficiaryRut && { beneficiaryRut: debouncedBeneficiaryRut }),
    ...(debouncedRut && { patientRut: debouncedRut }),
    ...(debouncedName && { patientName: debouncedName }),
    ...(kind && { kind }),
    sortColumn: sortDescriptor.column as ClinicalSeriesSortColumn,
    sortDirection: sortDescriptor.direction,
    ...(status && { status }),
  };

  const { data, isLoading, error } = useClinicalSeries(filters);
  const { data: detail, isLoading: isLoadingDetail } = useClinicalSeriesDetail(selectedId ?? 0);
  const rebuildMutation = useRebuildClinicalSeries();
  const rebuildJob = useClinicalSeriesRebuildProgress();

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  const derivedItems = useMemo(() => {
    if (!data?.items) return [];
    const today = getTodayStr();
    return data.items.map((s) => deriveSnapshot(s, today));
  }, [data?.items]);

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

  const hasFilters =
    !!debouncedBeneficiaryRut || !!debouncedRut || !!debouncedName || !!kind || !!status;

  const clearFilters = () => {
    setRutRaw("");
    setBeneficiaryRutRaw("");
    setNameRaw("");
    setKind(undefined);
    setStatus(undefined);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-foreground-400">
            {data ? (
              <>
                <span className="font-medium text-foreground-600">{data.total}</span> series totales
              </>
            ) : (
              "Tratamientos y pruebas alérgicas agrupados"
            )}
          </p>
          <Button
            isDisabled={rebuildMutation.isPending || rebuildJob?.status === "running"}
            onPress={() => rebuildMutation.mutateAsync({})}
            variant="secondary"
            size="sm"
          >
            Reorganizar Series
          </Button>
        </div>

        {/* Rebuild progress / result — driven by SSE */}
        {rebuildJob?.status === "running" && (
          <ProgressBar
            aria-label={rebuildJob.currentStep}
            color="accent"
            isIndeterminate={rebuildJob.total === 0}
            maxValue={rebuildJob.total}
            size="sm"
            value={rebuildJob.processed}
          >
            <Label className="text-xs text-foreground-400">
              {rebuildJob.currentStep}
              {rebuildJob.total > 0 && (
                <span className="ml-1 tabular-nums text-foreground-300">
                  ({rebuildJob.processed}/{rebuildJob.total})
                </span>
              )}
            </Label>
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        )}
        {rebuildJob?.status === "completed" && (
          <Alert status="success">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>
                {rebuildJob.processed.toLocaleString("es-CL")} eventos procesados
                {rebuildJob.from && rebuildJob.to
                  ? ` (${formatEventDate(rebuildJob.from, true)} – ${formatEventDate(rebuildJob.to, true)})`
                  : ""}
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        {(rebuildJob?.status === "failed" || rebuildMutation.isError) && (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>
                {rebuildJob?.error ??
                  (rebuildMutation.error instanceof Error
                    ? rebuildMutation.error.message
                    : "Error al reorganizar las series")}
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <Surface className="rounded-xl p-3">
        <div className="flex flex-wrap gap-3 items-end">
          {/* RUT */}
          <TextField className="flex-1 min-w-35" value={rutRaw} onChange={setRutRaw}>
            <Label>RUT</Label>
            <Input placeholder="12345678-9" />
          </TextField>

          <TextField
            className="flex-1 min-w-35"
            value={beneficiaryRutRaw}
            onChange={setBeneficiaryRutRaw}
          >
            <Label>RUT beneficiario</Label>
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
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              {error instanceof Error ? error.message : "Error al cargar los datos"}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
          <Table className="flex-1 min-h-0 flex flex-col">
            <Table.ScrollContainer className="flex-1 min-h-0">
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
                  {derivedItems.map((s) => (
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
                          {s.beneficiaryRut && s.beneficiaryRut !== s.patientRut && (
                            <span className="text-[11px] text-foreground-300 font-mono">
                              Benef.: {s.beneficiaryRut}
                            </span>
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex flex-col gap-1">
                          <Chip size="sm" color={KIND_COLORS[s.kind]} variant="soft">
                            {KIND_LABELS[s.kind]}
                          </Chip>
                          {s.kind === "SUBCUTANEOUS_TREATMENT" && s.allergenType && (
                            <Chip size="sm" color="primary" variant="soft">
                              {ALLERGEN_LABELS[s.allergenType]}
                            </Chip>
                          )}
                        </div>
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
                          {(() => {
                            const fs = seriesFinancialStatus(s.events);
                            if (fs === "unknown")
                              return (
                                <span className="text-xs text-foreground-300 italic">
                                  Por definir
                                </span>
                              );
                            if (fs === "free")
                              return <span className="text-xs text-success italic">Sin costo</span>;
                            return (
                              <span className="text-xs text-foreground-400">
                                ${s.totalPaid.toLocaleString("es-CL")} /
                                <span className="text-foreground-500">
                                  {" "}
                                  ${s.totalExpected.toLocaleString("es-CL")}
                                </span>
                              </span>
                            );
                          })()}
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
            <Table.Footer>
              <Pagination size="sm">
                <Pagination.Summary>
                  <span className="text-sm text-foreground-400">
                    {data.total > 0
                      ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, data.total)} de ${data.total}`
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
                </Pagination.Summary>
                {totalPages > 1 && (
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
                )}
              </Pagination>
            </Table.Footer>
          </Table>
        )}
      </Card>

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
                  ) : detail?.patientName ? (
                    detail.patientName
                  ) : (
                    <span className="text-foreground-400 italic font-normal text-base">
                      Sin nombre
                    </span>
                  )}
                </Drawer.Heading>
                {detail?.patientRut && (
                  <p className="font-mono text-xs text-foreground-400 mt-0.5">
                    {detail.patientRut}
                  </p>
                )}
                {detail?.beneficiaryRut && detail.beneficiaryRut !== detail.patientRut && (
                  <p className="font-mono text-[11px] text-foreground-300 mt-0.5">
                    Beneficiario: {detail.beneficiaryRut}
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
                    {(() => {
                      const fs = seriesFinancialStatus(detail.events);
                      const unknownEl = (
                        <p className="text-sm text-foreground-300 italic">Por definir</p>
                      );
                      const freeEl = (
                        <p className="text-sm text-success italic font-medium">Sin costo</p>
                      );
                      return (
                        <div className="grid grid-cols-2 gap-2">
                          <Surface className="p-3 rounded-xl">
                            <p className="text-xs text-foreground-400 mb-1">Esperado</p>
                            {fs === "unknown" ? (
                              unknownEl
                            ) : fs === "free" ? (
                              freeEl
                            ) : (
                              <p className="font-semibold text-accent text-lg">
                                ${detail.totalExpected.toLocaleString("es-CL")}
                              </p>
                            )}
                          </Surface>
                          <Surface className="p-3 rounded-xl">
                            <p className="text-xs text-foreground-400 mb-1">Pagado</p>
                            {fs === "unknown" ? (
                              unknownEl
                            ) : fs === "free" ? (
                              freeEl
                            ) : (
                              <p className="font-semibold text-success text-lg">
                                ${detail.totalPaid.toLocaleString("es-CL")}
                              </p>
                            )}
                          </Surface>
                          <Surface className="p-3 rounded-xl">
                            <p className="text-xs text-foreground-400 mb-1">Pendiente</p>
                            {fs === "unknown" ? (
                              unknownEl
                            ) : fs === "free" ? (
                              freeEl
                            ) : (
                              <p
                                className={`font-semibold text-lg ${detail.remainingExpected > 0 ? "text-danger" : "text-foreground"}`}
                              >
                                ${detail.remainingExpected.toLocaleString("es-CL")}
                              </p>
                            )}
                          </Surface>
                          <Surface className="p-3 rounded-xl">
                            <p className="text-xs text-foreground-400 mb-1">Eventos</p>
                            <p className="font-semibold text-lg">{detail.events.length}</p>
                          </Surface>
                        </div>
                      );
                    })()}

                    {/* Tipo + Alérgeno + Estado */}
                    <div className="flex flex-wrap gap-2">
                      <Chip size="sm" color={KIND_COLORS[detail.kind]} variant="soft">
                        {KIND_LABELS[detail.kind]}
                      </Chip>
                      {detail.kind === "SUBCUTANEOUS_TREATMENT" && detail.allergenType && (
                        <Chip size="sm" color="primary" variant="soft">
                          {ALLERGEN_LABELS[detail.allergenType]}
                        </Chip>
                      )}
                      <Chip size="sm" color={STATUS_COLORS[detail.status]} variant="soft">
                        {STATUS_LABELS[detail.status]}
                      </Chip>
                    </div>

                    {/* Events grouped by year */}
                    {detail.events.length > 0 &&
                      (() => {
                        const today = getTodayStr();
                        const sortedEvents = [...detail.events].sort(compareSeriesEventsDesc);
                        const byYear = sortedEvents.reduce<Record<string, typeof detail.events>>(
                          (acc, ev) => {
                            const year = ev.eventDate.slice(0, 4);
                            (acc[year] ??= []).push(ev);
                            return acc;
                          },
                          {}
                        );
                        const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
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
                                      <Button
                                        className="h-auto min-h-0 w-full justify-start p-0 text-left"
                                        key={event.eventId}
                                        onPress={() =>
                                          setSelectedSeriesEvent(toCalendarEventDetail(event))
                                        }
                                        variant="ghost"
                                      >
                                        <Surface
                                          className={`w-full rounded-lg p-2.5 text-xs${isFuture ? " ring-1 ring-accent/30" : ""}`}
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
                                              {event.seriesStageLabel && event.summary && (
                                                <span className="text-foreground-400">
                                                  {event.seriesStageLabel}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <p className="mt-0.5 font-medium text-foreground">
                                            {clinicalEventHeadline(event)}
                                          </p>
                                          {clinicalEventSupportText(event) && (
                                            <p className="text-foreground-400 truncate mt-0.5">
                                              {clinicalEventSupportText(event)}
                                            </p>
                                          )}
                                          {(() => {
                                            const efs = eventFinancialStatus(event);
                                            if (efs === "unknown")
                                              return (
                                                <p className="mt-0.5 italic text-foreground-300">
                                                  Ver boletas y sugerencias
                                                </p>
                                              );
                                            if (efs === "free")
                                              return (
                                                <p className="mt-0.5 font-medium italic text-success">
                                                  Sin costo · Ver boletas
                                                </p>
                                              );
                                            return (
                                              <>
                                                <p className="mt-0.5 text-foreground-400">
                                                  ${(event.amountPaid ?? 0).toLocaleString("es-CL")}{" "}
                                                  / ${event.amountExpected!.toLocaleString("es-CL")}
                                                </p>
                                                <p className="text-[11px] font-medium text-accent">
                                                  Abrir boletas y sugerencias
                                                </p>
                                              </>
                                            );
                                          })()}
                                        </Surface>
                                      </Button>
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

      <EventDteLinkModal
        event={selectedSeriesEvent}
        isOpen={selectedSeriesEvent != null}
        onClose={() => setSelectedSeriesEvent(null)}
        onLinked={() => {
          void queryClient.invalidateQueries({ queryKey: clinicalSeriesKeys.all });
          if (selectedId != null) {
            void queryClient.invalidateQueries({ queryKey: clinicalSeriesKeys.detail(selectedId) });
          }
        }}
      />
    </div>
  );
}
