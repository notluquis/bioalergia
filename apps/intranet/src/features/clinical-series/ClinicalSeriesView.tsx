/**
 * Clinical Series - List & Filter View
 * Premium UX: debounced search, server-side pagination, Drawer detail panel, sorting
 */

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Chip,
  Drawer,
  Input,
  Label,
  ListBox,
  Modal,
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Key, Selection } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EventDteLinkModal } from "@/features/calendar/components/EventDteLinkModal";
import type { CalendarEventDetail } from "@/features/calendar/types";
import {
  clinicalSeriesKeys,
  fetchClinicalSeriesDetail,
  fetchDetectDuplicates,
  useClinicalSeries,
  useClinicalSeriesDetail,
  useClinicalSeriesRebuildProgress,
  useRebuildClinicalSeries,
  useMergeClinicalSeries,
} from "./queries";
import type {
  ClinicalSeriesDuplicate,
  ClinicalSeriesEvent,
  ClinicalSeriesFilters,
  ClinicalSeriesKind,
  ClinicalSeriesSnapshot,
  ClinicalSeriesSortColumn,
  ClinicalSeriesStatus,
  SubcutaneousAllergenType,
  SubcutaneousVaccineProduct,
  HealthInsuranceType,
} from "./types";
import { ClinicalSeriesMergeModal } from "./components/ClinicalSeriesMergeModal";

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

const VACCINE_LABELS: Record<SubcutaneousVaccineProduct, string> = {
  CLUSTOID: "Clustoid",
  CLUSTOID_FORTE: "Clustoid Forte",
  CLUSTOID_B120: "Clustoid B120",
  ALXOID: "Alxoid",
  ORAL_TEC: "Oral-Tec",
};

const INSURANCE_LABELS: Record<HealthInsuranceType, string> = {
  FONASA: "Fonasa",
  ISAPRE: "Isapre",
  PARTICULAR: "Particular",
};

const INSURANCE_COLORS: Record<HealthInsuranceType, "success" | "warning" | "default"> = {
  FONASA: "success",
  ISAPRE: "warning",
  PARTICULAR: "default",
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

  // Merge modal state
  const [mergeModalDuplicate, setMergeModalDuplicate] = useState<ClinicalSeriesDuplicate | null>(
    null
  );
  const [rebuildModalOpen, setRebuildModalOpen] = useState(false);
  const [duplicatesModalOpen, setDuplicatesModalOpen] = useState(false);

  const { data, isLoading, error } = useClinicalSeries(filters);
  const { data: detail, isLoading: isLoadingDetail } = useClinicalSeriesDetail(selectedId ?? 0);
  const rebuildMutation = useRebuildClinicalSeries();
  const rebuildJob = useClinicalSeriesRebuildProgress();
  // Manual: only runs when the user explicitly presses "Verificar duplicados"
  const {
    data: duplicates,
    isFetching: isCheckingDuplicates,
    refetch: checkDuplicates,
  } = useQuery({
    enabled: false,
    queryFn: fetchDetectDuplicates,
    queryKey: clinicalSeriesKeys.duplicates(),
    staleTime: 5 * 60 * 1000,
  });

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
            {data && (
              <>
                <span className="font-medium text-foreground-600">{data.total}</span> series totales
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              isPending={isCheckingDuplicates}
              onPress={() => void checkDuplicates()}
              variant="ghost"
              size="sm"
            >
              {({ isPending }: { isPending: boolean }) => (
                <>
                  {isPending && <Spinner color="current" size="sm" />}
                  {isPending ? "Verificando..." : "Verificar duplicados"}
                </>
              )}
            </Button>
            <Button
              isDisabled={rebuildMutation.isPending || rebuildJob?.status === "running"}
              onPress={() => setRebuildModalOpen(true)}
              variant="secondary"
              size="sm"
            >
              Reorganizar Series
            </Button>
          </div>
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
        {duplicates && duplicates.length === 0 && (
          <p className="text-xs text-foreground-400">Sin duplicados detectados.</p>
        )}
        {duplicates && duplicates.length > 0 && (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>
                {duplicates.length} par{duplicates.length !== 1 ? "es" : ""} duplicado
                {duplicates.length !== 1 ? "s" : ""} detectado
                {duplicates.length !== 1 ? "s" : ""}
              </Alert.Description>
              <Button
                size="sm"
                variant="ghost"
                className="text-warning text-xs h-auto py-1 mt-1"
                onPress={() => setDuplicatesModalOpen(true)}
              >
                Revisar →
              </Button>
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
                        <div className="flex flex-col gap-1 items-start">
                          <Chip size="sm" color={KIND_COLORS[s.kind]} variant="tertiary">
                            {KIND_LABELS[s.kind]}
                          </Chip>
                          {s.allergenType && (
                            <Chip size="sm" color="accent" variant="tertiary">
                              {ALLERGEN_LABELS[s.allergenType]}
                            </Chip>
                          )}
                          {s.vaccineProduct && (
                            <Chip size="sm" color="default" variant="tertiary">
                              {VACCINE_LABELS[s.vaccineProduct]}
                            </Chip>
                          )}
                          {s.healthInsurance && (
                            <Chip
                              size="sm"
                              color={INSURANCE_COLORS[s.healthInsurance]}
                              variant="tertiary"
                            >
                              {INSURANCE_LABELS[s.healthInsurance]}
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
                {detail &&
                  duplicates &&
                  (() => {
                    const dup = duplicates.find(
                      (d) => d.sourceId === detail.id || d.targetId === detail.id
                    );
                    return dup ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2 text-xs"
                        onPress={() => setMergeModalDuplicate(dup)}
                      >
                        Fusionar duplicado →
                      </Button>
                    ) : null;
                  })()}
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

                    {/* Tipo + clasificaciones + estado */}
                    <div className="flex flex-wrap gap-2">
                      <Chip size="sm" color={KIND_COLORS[detail.kind]} variant="soft">
                        {KIND_LABELS[detail.kind]}
                      </Chip>
                      {detail.allergenType && (
                        <Chip size="sm" color="accent" variant="soft">
                          {ALLERGEN_LABELS[detail.allergenType]}
                        </Chip>
                      )}
                      {detail.vaccineProduct && (
                        <Chip size="sm" color="default" variant="soft">
                          {VACCINE_LABELS[detail.vaccineProduct]}
                        </Chip>
                      )}
                      {detail.healthInsurance && (
                        <Chip
                          size="sm"
                          color={INSURANCE_COLORS[detail.healthInsurance]}
                          variant="soft"
                        >
                          {INSURANCE_LABELS[detail.healthInsurance]}
                        </Chip>
                      )}
                      {detail.deliveryModality === "DOMICILIO" && (
                        <Chip size="sm" color="warning" variant="soft">
                          Domicilio
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
                                          {event.linkedFolios.length > 0 ? (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {event.linkedFolios.map((folio) => (
                                                <Chip
                                                  key={folio}
                                                  size="sm"
                                                  color="success"
                                                  variant="soft"
                                                >
                                                  Boleta N°{folio}
                                                </Chip>
                                              ))}
                                            </div>
                                          ) : !isFuture ? (
                                            <p className="mt-1 text-[10px] text-foreground-300 italic">
                                              Sin boleta vinculada
                                            </p>
                                          ) : null}
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

      {duplicates && (
        <DuplicatesModal
          duplicates={duplicates}
          isOpen={duplicatesModalOpen}
          onClose={() => setDuplicatesModalOpen(false)}
          onMerge={(dup) => {
            setDuplicatesModalOpen(false);
            setMergeModalDuplicate(dup);
          }}
        />
      )}

      {mergeModalDuplicate && (
        <MergeModalWithSnapshots
          duplicate={mergeModalDuplicate}
          onClose={() => setMergeModalDuplicate(null)}
        />
      )}

      <RebuildModal
        isOpen={rebuildModalOpen}
        onClose={() => setRebuildModalOpen(false)}
        onConfirm={(autoMerge) => {
          setRebuildModalOpen(false);
          rebuildMutation.mutate({ autoMerge });
        }}
      />
    </div>
  );
}

// ─── Duplicates Management Modal ──────────────────────────────────────────────

// ── DuplicatesModal ──────────────────────────────────────────────────────────
// Groups duplicate pairs by target series so all sources for the same patient
// appear together in an expandable card.

interface DuplicateGroup {
  dups: ClinicalSeriesDuplicate[];
  kind: ClinicalSeriesKind;
  patientName: null | string;
  targetEventCount: number;
  targetId: number;
}

const DUPES_PAGE_SIZE = 8;

function DuplicatesModal({
  duplicates,
  isOpen,
  onClose,
  onMerge,
}: {
  duplicates: ClinicalSeriesDuplicate[];
  isOpen: boolean;
  onClose: () => void;
  onMerge: (dup: ClinicalSeriesDuplicate) => void;
}) {
  const [page, setPage] = useState(1);
  const [expandedTarget, setExpandedTarget] = useState<number | null>(null);
  const [mergingTarget, setMergingTarget] = useState<number | null>(null);
  const merge = useMergeClinicalSeries();

  const groups = useMemo<DuplicateGroup[]>(() => {
    const map = new Map<number, ClinicalSeriesDuplicate[]>();
    for (const dup of duplicates) {
      const list = map.get(dup.targetId) ?? [];
      list.push(dup);
      map.set(dup.targetId, list);
    }
    return [...map.entries()].map(([targetId, dups]) => ({
      dups,
      kind: dups[0]!.kind,
      patientName: dups[0]!.patientName,
      targetEventCount: dups[0]!.targetEventCount,
      targetId,
    }));
  }, [duplicates]);

  const totalPages = Math.ceil(groups.length / DUPES_PAGE_SIZE);
  const pageGroups = groups.slice((page - 1) * DUPES_PAGE_SIZE, page * DUPES_PAGE_SIZE);

  const handleMergeAll = async (group: DuplicateGroup) => {
    setMergingTarget(group.targetId);
    try {
      for (const dup of group.dups) {
        await merge.mutateAsync({
          mergeReason: dup.reason,
          sourceId: dup.sourceId,
          targetId: dup.targetId,
        });
      }
    } finally {
      setMergingTarget(null);
    }
  };

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-xl rounded-[24px] bg-background p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh]">
            <Modal.Header>
              <Modal.Heading className="font-bold text-lg">
                Series duplicadas
                <span className="ml-2 text-sm font-normal text-foreground-400">
                  {groups.length} grupo{groups.length !== 1 ? "s" : ""} · {duplicates.length} serie
                  {duplicates.length !== 1 ? "s" : ""}
                </span>
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="overflow-y-auto space-y-2 -mx-1 px-1">
              {pageGroups.map((group) => {
                const isExpanded = expandedTarget === group.targetId;
                const isMerging = mergingTarget === group.targetId;
                return (
                  <Surface key={group.targetId} className="rounded-xl overflow-hidden">
                    {/* ── Card header ─── */}
                    <button
                      className="w-full p-3 flex items-start gap-3 text-left hover:bg-surface-200 transition-colors"
                      onClick={() => setExpandedTarget(isExpanded ? null : group.targetId)}
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-medium truncate">
                          {group.patientName ?? (
                            <span className="text-foreground-400 italic">Sin nombre</span>
                          )}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Chip size="sm" color={KIND_COLORS[group.kind]} variant="tertiary">
                            {KIND_LABELS[group.kind]}
                          </Chip>
                          <span className="text-xs text-foreground-400 font-mono">
                            Destino #{group.targetId} · {group.targetEventCount} ev.
                          </span>
                          <span className="text-xs text-foreground-400">
                            {group.dups.length} duplicado{group.dups.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <span className="text-foreground-300 text-xs mt-0.5 shrink-0">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </button>

                    {/* ── Expanded sources ─── */}
                    {isExpanded && (
                      <div className="border-t border-surface-200">
                        {group.dups.map((dup) => (
                          <div
                            key={dup.sourceId}
                            className="flex items-center gap-3 px-3 py-2 border-b border-surface-200 last:border-b-0"
                          >
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <p className="text-xs font-mono text-foreground-400">
                                Fuente #{dup.sourceId} · {dup.sourceEventCount} ev.
                              </p>
                              <p className="text-xs text-foreground-300 italic truncate">
                                {dup.reason}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="shrink-0 text-xs"
                              isDisabled={isMerging}
                              onPress={() => onMerge(dup)}
                            >
                              Revisar →
                            </Button>
                          </div>
                        ))}

                        {/* Merge-all footer */}
                        <div className="px-3 py-2 flex justify-end">
                          <Button
                            size="sm"
                            variant="secondary"
                            isDisabled={isMerging}
                            onPress={() => void handleMergeAll(group)}
                          >
                            {isMerging ? (
                              <Spinner size="sm" />
                            ) : group.dups.length > 1 ? (
                              `Fusionar todo (${group.dups.length})`
                            ) : (
                              "Fusionar"
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </Surface>
                );
              })}
            </Modal.Body>

            <div className="flex items-center justify-between pt-2">
              {totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={page === 1}
                    onPress={() => setPage((p) => p - 1)}
                  >
                    ←
                  </Button>
                  <span className="text-xs text-foreground-400">
                    {page} / {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={page === totalPages}
                    onPress={() => setPage((p) => p + 1)}
                  >
                    →
                  </Button>
                </div>
              ) : (
                <span />
              )}
              <Button variant="ghost" onPress={onClose}>
                Cerrar
              </Button>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

// Loads both snapshots for the merge modal.
// staleTime: Infinity — fetched once on open, never refetches while the modal is alive.
// retry: false       — a 404 means the series was already merged; show an error instead of retrying.
function MergeModalWithSnapshots({
  duplicate,
  onClose,
}: {
  duplicate: ClinicalSeriesDuplicate;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const {
    data: snap1,
    isLoading: loading1,
    isError: error1,
  } = useQuery({
    enabled: !!duplicate.sourceId,
    queryFn: () => fetchClinicalSeriesDetail(duplicate.sourceId),
    queryKey: clinicalSeriesKeys.detail(duplicate.sourceId),
    retry: false,
    staleTime: Infinity,
  });
  const {
    data: snap2,
    isLoading: loading2,
    isError: error2,
  } = useQuery({
    enabled: !!duplicate.targetId,
    queryFn: () => fetchClinicalSeriesDetail(duplicate.targetId),
    queryKey: clinicalSeriesKeys.detail(duplicate.targetId),
    retry: false,
    staleTime: Infinity,
  });

  const isLoading = loading1 || loading2;
  const hasError = error1 || error2;

  // One of the series no longer exists — the duplicate entry is stale. Close and refresh.
  if (hasError) {
    return (
      <Modal>
        <Modal.Backdrop
          className="bg-black/40 backdrop-blur-[2px]"
          isOpen
          onOpenChange={(open) => {
            if (!open) onClose();
          }}
        >
          <Modal.Container placement="center">
            <Modal.Dialog className="relative w-full max-w-sm rounded-[24px] bg-background p-6 shadow-2xl space-y-4">
              <Modal.Header>
                <Modal.Heading className="font-bold text-lg">Serie no encontrada</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-foreground-400">
                  Una de las series ya no existe, probablemente fue fusionada anteriormente.
                </p>
              </Modal.Body>
              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  onPress={() => {
                    void queryClient.invalidateQueries({
                      queryKey: clinicalSeriesKeys.duplicates(),
                    });
                    onClose();
                  }}
                >
                  Entendido
                </Button>
              </div>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  }

  if (isLoading) {
    return (
      <Modal>
        <Modal.Backdrop
          className="bg-black/40 backdrop-blur-[2px]"
          isOpen
          onOpenChange={(open) => {
            if (!open) onClose();
          }}
        >
          <Modal.Container placement="center">
            <Modal.Dialog className="relative w-full max-w-lg rounded-[24px] bg-background p-6 shadow-2xl space-y-4">
              <Modal.Header>
                <Modal.Heading className="font-bold text-lg">
                  Fusionar series duplicadas
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-4 w-36 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                    <Skeleton className="h-3 w-28 rounded" />
                  </div>
                  <div className="w-6" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-4 w-36 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                    <Skeleton className="h-3 w-28 rounded" />
                  </div>
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  }

  const snapshots: Record<number, ClinicalSeriesSnapshot> = {};
  if (snap1) snapshots[duplicate.sourceId] = snap1;
  if (snap2) snapshots[duplicate.targetId] = snap2;

  return (
    <ClinicalSeriesMergeModal
      duplicate={duplicate}
      isOpen
      onClose={onClose}
      snapshots={snapshots}
    />
  );
}

function RebuildModal({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (autoMerge: boolean) => void;
}) {
  const [autoMerge, setAutoMerge] = useState(false);

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-sm rounded-[24px] bg-background p-6 shadow-2xl space-y-4">
            <Modal.Header>
              <Modal.Heading className="font-bold text-lg">Reorganizar Series</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-3">
              <p className="text-sm text-foreground-400">
                Se reasignarán todos los eventos clínicos a sus series correspondientes.
              </p>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox
                  aria-label="Deduplicar series duplicadas"
                  isSelected={autoMerge}
                  onChange={setAutoMerge}
                >
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox>
                <span className="text-sm">Fusionar series duplicadas</span>
              </label>
              {autoMerge && (
                <p className="text-xs text-foreground-300 pl-6">
                  Se detectarán y fusionarán automáticamente series del mismo tipo con el mismo
                  paciente.
                </p>
              )}
            </Modal.Body>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onPress={onClose}>
                Cancelar
              </Button>
              <Button variant="primary" onPress={() => onConfirm(autoMerge)}>
                Reorganizar
              </Button>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
