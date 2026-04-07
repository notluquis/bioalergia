/**
 * Clinical Series - List & Filter View
 * Premium UX: debounced search, server-side pagination, Drawer detail panel, sorting
 */

import {
  Accordion,
  Alert,
  Button,
  Card,
  Checkbox,
  Chip,
  DateField,
  DateRangePicker,
  Dropdown,
  Drawer,
  Input,
  Label,
  Link,
  ListBox,
  Modal,
  Pagination,
  ProgressBar,
  RangeCalendar,
  Select,
  Separator,
  Skeleton,
  type SortDescriptor,
  Spinner,
  Surface,
  Table,
  Tabs,
  TextField,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Key, Selection } from "@heroui/react";
import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { buildPaginationItems } from "@/components/pagination/pagination-items";
import { EventDteLinkModal } from "@/features/calendar/components/EventDteLinkModal";
import type { CalendarEventDetail } from "@/features/calendar/types";
import {
  clinicalSeriesKeys,
  fetchClinicalSeriesDetail,
  fetchDetectDuplicates,
  useClinicalSeries,
  useClinicalSeriesDetail,
  useClinicalSeriesInsuranceStats,
  useClinicalSeriesRebuildProgress,
  useRebuildClinicalSeries,
  useMergeClinicalSeries,
} from "./queries";
import type {
  ClinicalSeriesDuplicate,
  ClinicalSeriesAbandonmentBucket,
  ClinicalSeriesEvent,
  ClinicalSeriesFilters,
  ClinicalSeriesKind,
  ClinicalSeriesSnapshot,
  ClinicalSeriesSortColumn,
  ClinicalSeriesStatus,
  ClinicalSeriesInsuranceStats,
  ClinicalSeriesViewMode,
  SubcutaneousAllergenType,
  SubcutaneousVaccineProduct,
  HealthInsuranceType,
} from "./types";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

const KIND_OPTIONS: { label: string; value: ClinicalSeriesKind }[] = [
  { label: "Prueba de Parche", value: "PATCH_TEST" },
  { label: "Test Alérgico", value: "SKIN_TEST" },
  { label: "Tratamiento Subcutáneo", value: "SUBCUTANEOUS_TREATMENT" },
];

const STATUS_OPTIONS: { label: string; value: ClinicalSeriesStatus }[] = [
  { label: "Planificada", value: "PLANNED" },
  { label: "Activa", value: "ACTIVE" },
  { label: "Inactiva", value: "INACTIVE" },
  { label: "Finalizada", value: "COMPLETED" },
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

const STATUS_COLORS: Record<ClinicalSeriesStatus, "success" | "default" | "danger" | "warning"> = {
  PLANNED: "default",
  ACTIVE: "success",
  INACTIVE: "warning",
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

type ClinicalSeriesTab = ClinicalSeriesViewMode | "insurance";

function InsuranceStatsPanel({
  hasFilters,
  isLoading,
  stats,
}: {
  hasFilters: boolean;
  isLoading: boolean;
  stats: ClinicalSeriesInsuranceStats | undefined;
}) {
  if (isLoading) {
    return (
      <Card className="flex-1 min-h-0 overflow-hidden">
        <Card.Content className="space-y-4 p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
          <Skeleton className="h-72 rounded-2xl" />
        </Card.Content>
      </Card>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <Card className="flex-1 min-h-0 overflow-hidden">
        <Card.Content className="flex h-48 flex-col items-center justify-center gap-2 p-5 text-center">
          <p className="text-foreground-400 text-sm">
            {hasFilters
              ? "No hay series para calcular la estadística con los filtros actuales"
              : "No hay series para calcular la estadística de previsión"}
          </p>
        </Card.Content>
      </Card>
    );
  }

  const rows = [
    {
      key: "fonasa",
      label: "Fonasa",
      value: stats.fonasa,
    },
    {
      key: "isapre",
      label: "Isapre",
      value: stats.isapre,
    },
    {
      key: "particular",
      label: "Particular",
      value: stats.particular,
    },
    {
      key: "unidentified",
      label: "Sin identificar",
      value: stats.unidentified,
    },
  ] as const;

  const ratio = (value: number) => (stats.total > 0 ? (value / stats.total) * 100 : 0);
  const isapreRatio = (value: number) => (stats.isapre > 0 ? (value / stats.isapre) * 100 : 0);
  const maxCoverage = rows.reduce((best, row) => (row.value > best.value ? row : best), rows[0]);

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => (
          <Card key={row.key} className="border-default-200 shadow-sm">
            <Card.Content className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-foreground-400">
                    {row.label}
                  </p>
                  <p className="mt-2 font-semibold text-3xl text-foreground">
                    {row.value.toLocaleString("es-CL")}
                  </p>
                </div>
                <Chip
                  color={
                    row.key === "fonasa"
                      ? "success"
                      : row.key === "isapre"
                        ? "warning"
                        : row.key === "particular"
                          ? "default"
                          : "danger"
                  }
                  size="sm"
                  variant="soft"
                >
                  {ratio(row.value).toFixed(1)}%
                </Chip>
              </div>
            </Card.Content>
          </Card>
        ))}
      </div>

      <Card className="border-default-200 shadow-sm">
        <Card.Header className="pb-2">
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-foreground text-base">
              Distribución de previsión
            </span>
            <span className="text-foreground-400 text-sm">
              {stats.total.toLocaleString("es-CL")} series consideradas
            </span>
          </div>
        </Card.Header>
        <Card.Content className="space-y-4">
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Chip
                      className="min-w-0 px-0"
                      color={
                        row.key === "fonasa"
                          ? "success"
                          : row.key === "isapre"
                            ? "warning"
                            : row.key === "particular"
                              ? "default"
                              : "danger"
                      }
                      size="sm"
                      variant="soft"
                    />
                    <span className="text-sm font-medium text-foreground">{row.label}</span>
                  </div>
                  <span className="text-xs tabular-nums text-foreground-500">
                    {row.value.toLocaleString("es-CL")} · {ratio(row.value).toFixed(1)}%
                  </span>
                </div>
                <ProgressBar
                  aria-label={`Distribución ${row.label}`}
                  className="w-full"
                  color={
                    row.key === "fonasa"
                      ? "success"
                      : row.key === "isapre"
                        ? "warning"
                        : row.key === "particular"
                          ? "default"
                          : "danger"
                  }
                  value={ratio(row.value)}
                >
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
            <Card className="border-default-200 shadow-sm">
              <Card.Content className="p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_6.5rem_5.5rem] gap-y-2 text-sm">
                  <span className="font-medium text-foreground">Categoría</span>
                  <span className="text-right font-medium text-foreground">Series</span>
                  <span className="text-right font-medium text-foreground">%</span>
                  {rows.map((row) => (
                    <Fragment key={row.key}>
                      <span key={`${row.key}-label`} className="text-foreground-500">
                        {row.label}
                      </span>
                      <span
                        key={`${row.key}-count`}
                        className="text-right tabular-nums text-foreground"
                      >
                        {row.value.toLocaleString("es-CL")}
                      </span>
                      <span
                        key={`${row.key}-ratio`}
                        className="text-right tabular-nums text-foreground-500"
                      >
                        {ratio(row.value).toFixed(1)}%
                      </span>
                    </Fragment>
                  ))}
                </div>
              </Card.Content>
            </Card>

            <Card className="border-default-200 shadow-sm">
              <Card.Content className="p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-foreground-400">
                  Lectura rápida
                </p>
                <div className="mt-3 space-y-2 text-sm text-foreground-500">
                  <p>
                    La mayor cobertura actual es{" "}
                    <span className="font-medium text-foreground">{maxCoverage.label}</span>.
                  </p>
                  <p>
                    Hay{" "}
                    <span className="font-medium text-foreground">
                      {stats.unidentified.toLocaleString("es-CL")}
                    </span>{" "}
                    series sin previsión identificada.
                  </p>
                  <p>
                    Las series marcadas como{" "}
                    <span className="font-medium text-foreground">Particular</span> se muestran
                    aparte y no se suman a Isapre.
                  </p>
                </div>
              </Card.Content>
            </Card>
          </div>

          <Card className="border-default-200 shadow-sm">
            <Card.Header className="items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-foreground-400">
                  Detalle Isapre
                </p>
                <p className="mt-1 text-sm text-foreground-500">
                  Distribución interna de las series clasificadas como Isapre
                </p>
              </div>
              <Chip size="sm" color="warning" variant="soft">
                {stats.isapre.toLocaleString("es-CL")} Isapre
              </Chip>
            </Card.Header>
            <Card.Content className="space-y-3">
              {stats.isapre === 0 ? (
                <p className="text-sm text-foreground-400">
                  No hay series clasificadas como Isapre en los filtros actuales.
                </p>
              ) : (
                <>
                  {stats.isapreProviders.map((provider) => (
                    <div key={provider.providerName} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">
                          {provider.providerName}
                        </span>
                        <span className="text-xs tabular-nums text-foreground-500">
                          {provider.total.toLocaleString("es-CL")} ·{" "}
                          {isapreRatio(provider.total).toFixed(1)}%
                        </span>
                      </div>
                      <ProgressBar
                        aria-label={`Distribución ${provider.providerName}`}
                        className="w-full"
                        color="warning"
                        value={isapreRatio(provider.total)}
                      >
                        <ProgressBar.Track>
                          <ProgressBar.Fill />
                        </ProgressBar.Track>
                      </ProgressBar>
                    </div>
                  ))}
                  {stats.isapreUnidentified > 0 && (
                    <Card className="border-default-200 bg-default-50 shadow-none">
                      <Card.Content className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-foreground-500">Isapre sin nombre identificado</span>
                        <span className="tabular-nums text-foreground">
                          {stats.isapreUnidentified.toLocaleString("es-CL")}
                        </span>
                      </Card.Content>
                    </Card>
                  )}
                </>
              )}
            </Card.Content>
          </Card>
        </Card.Content>
      </Card>
    </div>
  );
}

function normalizeChileWhatsAppPhone(value: string): null | { display: string; waNumber: string } {
  const digits = value.replace(/\D+/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) {
    return normalizeChileWhatsAppPhone(digits.slice(2));
  }

  if (digits.startsWith("0")) {
    return normalizeChileWhatsAppPhone(digits.slice(1));
  }

  if (digits.startsWith("56") && digits.length === 11 && digits[2] === "9") {
    return { display: `+${digits}`, waNumber: digits };
  }

  if (digits.length === 9 && digits.startsWith("9")) {
    return { display: `+56${digits}`, waNumber: `56${digits}` };
  }

  if (digits.length === 8) {
    return { display: `+569${digits}`, waNumber: `569${digits}` };
  }

  return null;
}

function normalizeClinicalIdentityName(value: null | string | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeClinicalIdentityRut(value: null | string | undefined): string {
  return value?.replace(/[^0-9kK]+/g, "").toLowerCase() ?? "";
}

function tokenizeClinicalIdentityName(value: null | string | undefined): string[] {
  return normalizeClinicalIdentityName(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function areLikelySameClinicalPerson(params: {
  beneficiaryName: null | string;
  beneficiaryRut: null | string;
  patientName: null | string;
  patientRut: null | string;
}): boolean {
  const normalizedPatientRut = normalizeClinicalIdentityRut(params.patientRut);
  const normalizedBeneficiaryRut = normalizeClinicalIdentityRut(params.beneficiaryRut);

  if (normalizedPatientRut && normalizedBeneficiaryRut) {
    return normalizedPatientRut === normalizedBeneficiaryRut;
  }

  const patientTokens = tokenizeClinicalIdentityName(params.patientName);
  const beneficiaryTokens = tokenizeClinicalIdentityName(params.beneficiaryName);

  if (patientTokens.length < 2 || beneficiaryTokens.length < 2) {
    return false;
  }

  const [shorter, longer] =
    patientTokens.length <= beneficiaryTokens.length
      ? [patientTokens, beneficiaryTokens]
      : [beneficiaryTokens, patientTokens];

  return shorter.every((token) => longer.includes(token));
}

function isSamePatientAndBeneficiary(
  snapshot: Pick<
    ClinicalSeriesSnapshot,
    "beneficiaryName" | "beneficiaryRut" | "patientName" | "patientRut"
  >
): boolean {
  return areLikelySameClinicalPerson({
    beneficiaryName: snapshot.beneficiaryName,
    beneficiaryRut: snapshot.beneficiaryRut,
    patientName: snapshot.patientName,
    patientRut: snapshot.patientRut,
  });
}

type IdentityListEntry = {
  href?: string;
  roleLabel: string;
  value: string;
};

function buildRutEntries(snapshot: ClinicalSeriesSnapshot): IdentityListEntry[] {
  const entries: IdentityListEntry[] = [];
  const samePerson = isSamePatientAndBeneficiary(snapshot);
  if (snapshot.patientRut) {
    entries.push({ roleLabel: "Paciente", value: snapshot.patientRut });
  }
  if (snapshot.beneficiaryRut && !samePerson) {
    entries.push({ roleLabel: "Beneficiario", value: snapshot.beneficiaryRut });
  }
  return entries;
}

function buildPhoneEntries(snapshot: ClinicalSeriesSnapshot): IdentityListEntry[] {
  const entries: IdentityListEntry[] = [];
  const seen = new Set<string>();
  const samePerson = isSamePatientAndBeneficiary(snapshot);

  for (const phone of snapshot.patientPhones) {
    const normalized = normalizeChileWhatsAppPhone(phone);
    if (!normalized) continue;
    if (seen.has(normalized.waNumber)) continue;
    seen.add(normalized.waNumber);
    entries.push({
      href: `https://wa.me/${normalized.waNumber}`,
      roleLabel: "Paciente",
      value: normalized.display,
    });
  }

  for (const phone of snapshot.beneficiaryPhones) {
    const normalized = normalizeChileWhatsAppPhone(phone);
    if (!normalized) continue;
    if (seen.has(normalized.waNumber)) continue;
    seen.add(normalized.waNumber);
    entries.push({
      href: `https://wa.me/${normalized.waNumber}`,
      roleLabel: samePerson ? "Paciente" : "Beneficiario",
      value: normalized.display,
    });
  }

  return entries;
}

function IdentityDropdownCell({
  emptyLabel = "—",
  entries,
  title,
}: {
  emptyLabel?: string;
  entries: IdentityListEntry[];
  title: string;
}) {
  if (entries.length === 0) {
    return <span className="text-xs text-foreground-400">{emptyLabel}</span>;
  }

  return (
    <Dropdown>
      <Dropdown.Trigger>
        <Button
          className="h-8 w-full justify-between rounded-full px-3 text-xs"
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <span className="truncate">{title}</span>
          <Chip size="sm" variant="soft">
            {entries.length}
          </Chip>
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Popover className="w-80 p-0" placement="bottom start">
        <div className="flex flex-col gap-2 p-2">
          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-sm font-medium text-foreground">{title}</span>
            <Chip size="sm" variant="tertiary">
              {entries.length}
            </Chip>
          </div>
          <div className="flex flex-col gap-2">
            {entries.map((entry) => (
              <div
                className="rounded-large border border-border/60 bg-content2 px-3 py-2"
                key={`${title}-${entry.roleLabel}-${entry.value}`}
              >
                <div className="mb-1">
                  <Chip size="sm" variant="tertiary">
                    {entry.roleLabel}
                  </Chip>
                </div>
                {entry.href ? (
                  <Link
                    className="text-sm font-mono"
                    href={entry.href}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {entry.value}
                  </Link>
                ) : (
                  <span className="text-sm text-foreground font-mono">{entry.value}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </Dropdown.Popover>
    </Dropdown>
  );
}

const STATUS_LABELS: Record<ClinicalSeriesStatus, string> = {
  PLANNED: "Planificada",
  ACTIVE: "Activa",
  INACTIVE: "Inactiva",
  COMPLETED: "Finalizada",
  CANCELLED: "Cancelada",
};

const ABANDONMENT_BUCKET_OPTIONS: Array<{
  description: string;
  label: string;
  value: ClinicalSeriesAbandonmentBucket;
}> = [
  { description: "30 a 59 días", label: "1 mes", value: "month_1" },
  { description: "60 a 89 días", label: "2 meses", value: "month_2" },
  { description: "90 a 119 días", label: "3 meses", value: "month_3" },
  { description: "120 días o más", label: "4+ meses", value: "month_4_plus" },
];

const ABANDONMENT_BUCKET_LABELS: Record<ClinicalSeriesAbandonmentBucket, string> = {
  month_1: "1 mes",
  month_2: "2 meses",
  month_3: "3 meses",
  month_4_plus: "4+ meses",
};

const ABANDONMENT_BUCKET_COLORS: Record<ClinicalSeriesAbandonmentBucket, "warning" | "danger"> = {
  month_1: "warning",
  month_2: "warning",
  month_3: "danger",
  month_4_plus: "danger",
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
  return event.summary?.trim() ?? event.seriesStageLabel?.trim() ?? "Evento";
}

function clinicalEventStageLabel(event: ClinicalSeriesEvent): null | string {
  const stageLabel = event.seriesStageLabel?.trim();
  if (!stageLabel) return null;
  const headline = clinicalEventHeadline(event);
  return normalizeClinicalIdentityName(stageLabel) === normalizeClinicalIdentityName(headline)
    ? null
    : stageLabel;
}

function clinicalEventDescription(event: ClinicalSeriesEvent): null | string {
  const description = event.description?.trim();
  if (!description) return null;
  const headline = clinicalEventHeadline(event);
  return normalizeClinicalIdentityName(description) === normalizeClinicalIdentityName(headline)
    ? null
    : description;
}

function clinicalEventDateTimeLabel(event: ClinicalSeriesEvent): string {
  const dateLabel = formatEventDate(event.eventDate);
  return event.eventTime ? `${dateLabel} · ${event.eventTime} h` : dateLabel;
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function ClinicalSeriesView() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ClinicalSeriesTab>("series");
  const [abandonmentBucket, setAbandonmentBucket] = useState<
    ClinicalSeriesAbandonmentBucket | undefined
  >(undefined);
  const viewMode: ClinicalSeriesViewMode = activeTab === "abandonment" ? "abandonment" : "series";
  const isAbandonmentTab = activeTab === "abandonment";
  const isInsuranceTab = activeTab === "insurance";
  const isSeriesLikeTab = !isAbandonmentTab;
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20);

  // Raw filter states (debounced for text fields)
  const [queryRaw, setQueryRaw] = useState("");
  const [rutRaw, setRutRaw] = useState("");
  const [beneficiaryRutRaw, setBeneficiaryRutRaw] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [kind, setKind] = useState<ClinicalSeriesKind | undefined>(undefined);
  const [status, setStatus] = useState<ClinicalSeriesStatus | undefined>(undefined);
  const [nextVisitFrom, setNextVisitFrom] = useState<string | undefined>(undefined);
  const [nextVisitTo, setNextVisitTo] = useState<string | undefined>(undefined);

  const deferredQuery = useDeferredValue(queryRaw);
  const debouncedQuery = useDebounce(deferredQuery);
  const debouncedRut = useDebounce(rutRaw);
  const debouncedBeneficiaryRut = useDebounce(beneficiaryRutRaw);
  const debouncedPhone = useDebounce(phoneRaw);

  // Sorting
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "lastEvent",
    direction: "descending",
  });

  useEffect(() => {
    setPage(1);
    setSelectedId(null);
    setDrawerOpen(false);
    setSortDescriptor(
      isAbandonmentTab
        ? { column: "daysSinceLastEvent", direction: "descending" }
        : (current) =>
            current.column === "daysSinceLastEvent"
              ? { column: "lastEvent", direction: "descending" }
              : current
    );
  }, [isAbandonmentTab]);

  // Reset page when filters or page size change
  useEffect(() => {
    setPage(1);
  }, [
    abandonmentBucket,
    debouncedBeneficiaryRut,
    debouncedPhone,
    debouncedQuery,
    debouncedRut,
    kind,
    nextVisitFrom,
    nextVisitTo,
    pageSize,
    status,
  ]);

  // Detail drawer
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSeriesEvent, setSelectedSeriesEvent] = useState<CalendarEventDetail | null>(null);

  const filters: ClinicalSeriesFilters = {
    abandonmentBucket,
    page,
    pageSize: pageSize,
    ...(debouncedQuery && { query: debouncedQuery }),
    ...(debouncedBeneficiaryRut && { beneficiaryRut: debouncedBeneficiaryRut }),
    ...(debouncedPhone && { patientPhone: debouncedPhone }),
    ...(debouncedRut && { patientRut: debouncedRut }),
    ...(isSeriesLikeTab && kind && { kind }),
    ...(nextVisitFrom && { nextVisitFrom }),
    ...(nextVisitTo && { nextVisitTo }),
    sortColumn: sortDescriptor.column as ClinicalSeriesSortColumn,
    sortDirection: sortDescriptor.direction,
    ...(isSeriesLikeTab && status && { status }),
    view: viewMode,
  };

  const [rebuildModalOpen, setRebuildModalOpen] = useState(false);
  const [duplicatesModalOpen, setDuplicatesModalOpen] = useState(false);

  const { data, isLoading, error } = useClinicalSeries(filters);
  const insuranceStatsFilters: ClinicalSeriesFilters = {
    abandonmentBucket: undefined,
    ...(debouncedQuery && { query: debouncedQuery }),
    ...(debouncedBeneficiaryRut && { beneficiaryRut: debouncedBeneficiaryRut }),
    ...(debouncedPhone && { patientPhone: debouncedPhone }),
    ...(debouncedRut && { patientRut: debouncedRut }),
    ...(kind && { kind }),
    ...(nextVisitFrom && { nextVisitFrom }),
    ...(nextVisitTo && { nextVisitTo }),
    ...(status && { status }),
    view: "series",
  };
  const {
    data: insuranceStats,
    error: insuranceStatsError,
    isLoading: isLoadingInsuranceStats,
  } = useClinicalSeriesInsuranceStats(insuranceStatsFilters);
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
  const pageItems = buildPaginationItems({
    currentPage: page,
    totalPages,
  });

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
    (isAbandonmentTab && !!abandonmentBucket) ||
    !!debouncedBeneficiaryRut ||
    !!debouncedPhone ||
    !!debouncedQuery ||
    !!debouncedRut ||
    (isSeriesLikeTab && !!kind) ||
    !!nextVisitFrom ||
    !!nextVisitTo ||
    (isSeriesLikeTab && !!status);

  const clearFilters = () => {
    setQueryRaw("");
    setRutRaw("");
    setBeneficiaryRutRaw("");
    setPhoneRaw("");
    setKind(undefined);
    setNextVisitFrom(undefined);
    setNextVisitTo(undefined);
    setStatus(undefined);
    setAbandonmentBucket(undefined);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-foreground-400">
            {isInsuranceTab && insuranceStats ? (
              <>
                <span className="font-medium text-foreground-600">{insuranceStats.total}</span>{" "}
                series consideradas
              </>
            ) : (
              data && (
                <>
                  <span className="font-medium text-foreground-600">{data.total}</span> series
                  totales
                </>
              )
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

      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as ClinicalSeriesTab)}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Vistas de series clínicas" className="w-full justify-start">
            <Tabs.Tab id="series">
              Series
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="abandonment">
              Abandono
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="insurance">
              Previsión
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <Surface className="rounded-xl p-4">
        <div className="flex flex-col gap-4">
          <TextField className="w-full max-w-3xl" value={queryRaw} onChange={setQueryRaw}>
            <Label>Búsqueda</Label>
            <Input placeholder="Paciente, RUT paciente, RUT beneficiario o beneficiario..." />
          </TextField>
          <div
            className={
              isSeriesLikeTab
                ? "grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_12rem_12rem_minmax(18rem,1.25fr)_auto]"
                : "grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
            }
          >
            <TextField className="w-full" value={rutRaw} onChange={setRutRaw}>
              <Label>RUT paciente</Label>
              <Input placeholder="12345678-9" />
            </TextField>

            <TextField className="w-full" value={beneficiaryRutRaw} onChange={setBeneficiaryRutRaw}>
              <Label>RUT beneficiario</Label>
              <Input placeholder="12345678-9" />
            </TextField>

            <TextField className="w-full" value={phoneRaw} onChange={setPhoneRaw}>
              <Label>Teléfono</Label>
              <Input placeholder="+56912345678" />
            </TextField>

            {isSeriesLikeTab ? (
              <>
                <div className="flex flex-col gap-1">
                  <Select
                    onChange={handleKindChange}
                    value={(kind as Key) ?? null}
                    placeholder="Todos"
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

                <div className="flex flex-col gap-1">
                  <Select
                    onChange={handleStatusChange}
                    value={(status as Key) ?? null}
                    placeholder="Todos"
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

                <DateRangePicker
                  aria-label="Rango de próxima visita"
                  onChange={(value) => {
                    setNextVisitFrom(value?.start?.toString());
                    setNextVisitTo(value?.end?.toString());
                  }}
                  value={
                    nextVisitFrom && nextVisitTo
                      ? { end: parseDate(nextVisitTo), start: parseDate(nextVisitFrom) }
                      : undefined
                  }
                >
                  <Label>Próxima visita</Label>
                  <DateField.Group fullWidth variant="secondary">
                    <DateField.InputContainer>
                      <DateField.Input slot="start">
                        {(segment) => <DateField.Segment segment={segment} />}
                      </DateField.Input>
                      <DateRangePicker.RangeSeparator />
                      <DateField.Input slot="end">
                        {(segment) => <DateField.Segment segment={segment} />}
                      </DateField.Input>
                    </DateField.InputContainer>
                    <DateField.Suffix>
                      <DateRangePicker.Trigger>
                        <DateRangePicker.TriggerIndicator />
                      </DateRangePicker.Trigger>
                    </DateField.Suffix>
                  </DateField.Group>
                  <DateRangePicker.Popover>
                    <RangeCalendar
                      aria-label="Rango de próxima visita"
                      visibleDuration={{ months: 2 }}
                    >
                      <RangeCalendar.Header>
                        <RangeCalendar.YearPickerTrigger>
                          <RangeCalendar.YearPickerTriggerHeading />
                          <RangeCalendar.YearPickerTriggerIndicator />
                        </RangeCalendar.YearPickerTrigger>
                        <RangeCalendar.NavButton slot="previous" />
                        <RangeCalendar.NavButton slot="next" />
                      </RangeCalendar.Header>
                      <RangeCalendar.Grid>
                        <RangeCalendar.GridHeader>
                          {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                        </RangeCalendar.GridHeader>
                        <RangeCalendar.GridBody>
                          {(date) => <RangeCalendar.Cell date={date} />}
                        </RangeCalendar.GridBody>
                      </RangeCalendar.Grid>
                      <RangeCalendar.YearPickerGrid>
                        <RangeCalendar.YearPickerGridBody>
                          {({ year }) => <RangeCalendar.YearPickerCell year={year} />}
                        </RangeCalendar.YearPickerGridBody>
                      </RangeCalendar.YearPickerGrid>
                    </RangeCalendar>
                  </DateRangePicker.Popover>
                </DateRangePicker>
              </>
            ) : null}

            <div className="flex items-end justify-end">
              {hasFilters ? (
                <Button onPress={clearFilters} size="sm" variant="ghost">
                  Limpiar
                </Button>
              ) : (
                <div />
              )}
            </div>
          </div>
          {isAbandonmentTab ? (
            <>
              <Alert status="warning">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>
                    Se consideran abandono las series subcutáneas activas o inactivas sin próxima
                    visita futura y con 30 días o más desde la última sesión registrada.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={abandonmentBucket == null ? "primary" : "outline"}
                  onPress={() => setAbandonmentBucket(undefined)}
                >
                  Todos
                </Button>
                {ABANDONMENT_BUCKET_OPTIONS.map((bucket) => (
                  <Button
                    key={bucket.value}
                    size="sm"
                    variant={abandonmentBucket === bucket.value ? "primary" : "outline"}
                    onPress={() => setAbandonmentBucket(bucket.value)}
                  >
                    {bucket.label}
                  </Button>
                ))}
              </div>
            </>
          ) : null}
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
      {isInsuranceTab && insuranceStatsError && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              {insuranceStatsError instanceof Error
                ? insuranceStatsError.message
                : "Error al cargar la estadística de previsión"}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {isInsuranceTab ? (
        <InsuranceStatsPanel
          hasFilters={hasFilters}
          isLoading={isLoadingInsuranceStats}
          stats={insuranceStats}
        />
      ) : (
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
                  : isAbandonmentTab
                    ? "No hay pacientes en abandono con los criterios actuales"
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
                  className="min-w-384"
                >
                  <Table.Header>
                    {isAbandonmentTab ? (
                      <>
                        <Table.Column allowsSorting id="patient" isRowHeader className="w-[22%]">
                          Paciente
                        </Table.Column>
                        <Table.Column className="w-[16%]">RUTs</Table.Column>
                        <Table.Column className="w-[18%]">Teléfonos</Table.Column>
                        <Table.Column allowsSorting id="lastEvent" className="w-[12%]">
                          Últ. sesión
                        </Table.Column>
                        <Table.Column
                          allowsSorting
                          id="daysSinceLastEvent"
                          className="w-[10%] text-right"
                        >
                          Días
                        </Table.Column>
                        <Table.Column className="w-[11%]">Bucket</Table.Column>
                        <Table.Column allowsSorting id="status" className="w-[11%]">
                          Estado
                        </Table.Column>
                      </>
                    ) : (
                      <>
                        <Table.Column allowsSorting id="patient" isRowHeader className="w-[18%]">
                          Paciente
                        </Table.Column>
                        <Table.Column className="w-[16%]">RUTs</Table.Column>
                        <Table.Column className="w-[18%]">Teléfonos</Table.Column>
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
                        <Table.Column
                          allowsSorting
                          id="upcomingEvents"
                          className="w-[8%] text-right"
                        >
                          Próximos
                        </Table.Column>
                        <Table.Column allowsSorting id="financial" className="w-[20%] text-right">
                          Financiero
                        </Table.Column>
                      </>
                    )}
                  </Table.Header>
                  <Table.Body>
                    {data.items.map((s) => {
                      const samePerson = isSamePatientAndBeneficiary(s);
                      return (
                        <Table.Row key={s.id} id={s.id} className="cursor-pointer group">
                          <Table.Cell>
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-medium text-foreground transition-colors group-hover:text-accent">
                                {s.patientName ?? s.displayName ?? (
                                  <span className="text-foreground-400 italic">Sin nombre</span>
                                )}
                              </span>
                              {s.beneficiaryName && !samePerson && (
                                <span className="text-xs text-foreground-400">
                                  Beneficiario: {s.beneficiaryName}
                                </span>
                              )}
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <IdentityDropdownCell entries={buildRutEntries(s)} title="RUTs" />
                          </Table.Cell>
                          <Table.Cell>
                            <IdentityDropdownCell
                              entries={buildPhoneEntries(s)}
                              title="Teléfonos"
                            />
                          </Table.Cell>
                          {isAbandonmentTab ? (
                            <>
                              <Table.Cell>
                                <span className="text-xs text-foreground-400">
                                  {s.lastEventDate ? formatEventDate(s.lastEventDate, true) : "—"}
                                </span>
                              </Table.Cell>
                              <Table.Cell className="text-right">
                                {s.daysSinceLastEvent != null ? (
                                  <span className="text-xs font-medium tabular-nums text-foreground-600">
                                    {s.daysSinceLastEvent}
                                  </span>
                                ) : (
                                  <span className="text-xs text-foreground-400">—</span>
                                )}
                              </Table.Cell>
                              <Table.Cell>
                                {s.abandonmentBucket ? (
                                  <Chip
                                    size="sm"
                                    color={ABANDONMENT_BUCKET_COLORS[s.abandonmentBucket]}
                                    variant="soft"
                                  >
                                    {ABANDONMENT_BUCKET_LABELS[s.abandonmentBucket]}
                                  </Chip>
                                ) : (
                                  <span className="text-xs text-foreground-400">—</span>
                                )}
                              </Table.Cell>
                              <Table.Cell>
                                <Chip size="sm" color={STATUS_COLORS[s.status]} variant="soft">
                                  {STATUS_LABELS[s.status]}
                                </Chip>
                              </Table.Cell>
                            </>
                          ) : (
                            <>
                              <Table.Cell>
                                <div className="flex flex-col items-start gap-1">
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
                                      {s.healthInsurance === "ISAPRE" && s.isapreName
                                        ? `${INSURANCE_LABELS[s.healthInsurance]} · ${s.isapreName}`
                                        : INSURANCE_LABELS[s.healthInsurance]}
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
                                      return (
                                        <span className="text-xs text-success italic">
                                          Sin costo
                                        </span>
                                      );
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
                                    <span className="text-xs font-medium text-danger">
                                      −${s.remainingExpected.toLocaleString("es-CL")} pend.
                                    </span>
                                  )}
                                </div>
                              </Table.Cell>
                            </>
                          )}
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
              <Table.Footer className="border-t border-separator/60">
                <div className="flex flex-col items-start justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="flex flex-wrap items-center gap-3 text-default-500 text-sm">
                    <span>
                      {data.total > 0
                        ? `${((page - 1) * pageSize + 1).toLocaleString("es-CL")}–${Math.min(
                            page * pageSize,
                            data.total
                          ).toLocaleString("es-CL")} de ${data.total.toLocaleString("es-CL")}`
                        : `${data.total.toLocaleString("es-CL")} resultados`}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs uppercase tracking-wide">Filas</span>
                      <Select
                        aria-label="Filas por página"
                        className="w-24"
                        value={String(pageSize)}
                        onChange={(key) =>
                          key && setPageSize(Number(key) as (typeof PAGE_SIZE_OPTIONS)[number])
                        }
                        variant="secondary"
                      >
                        <Label className="sr-only">Filas por página</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {PAGE_SIZE_OPTIONS.map((n) => (
                              <ListBox.Item key={n} id={String(n)} textValue={`${n}`}>
                                {n}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>
                  </div>

                  {totalPages > 1 ? (
                    <Pagination className="w-full sm:w-auto" size="sm">
                      <Pagination.Summary className="text-default-500 text-sm">
                        Página {page.toLocaleString("es-CL")} de{" "}
                        {totalPages.toLocaleString("es-CL")}
                      </Pagination.Summary>
                      <Pagination.Content>
                        <Pagination.Item>
                          <Pagination.Previous
                            isDisabled={page === 1}
                            onPress={() => setPage((p) => Math.max(1, p - 1))}
                          >
                            <Pagination.PreviousIcon />
                            <span>Anterior</span>
                          </Pagination.Previous>
                        </Pagination.Item>
                        {pageItems.map((item) =>
                          item.type === "ellipsis" ? (
                            <Pagination.Item key={item.key}>
                              <Pagination.Ellipsis />
                            </Pagination.Item>
                          ) : (
                            <Pagination.Item key={item.key}>
                              <Pagination.Link
                                isActive={item.value === page}
                                onPress={() => setPage(item.value ?? 1)}
                              >
                                {item.value}
                              </Pagination.Link>
                            </Pagination.Item>
                          )
                        )}
                        <Pagination.Item>
                          <Pagination.Next
                            isDisabled={page === totalPages}
                            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                          >
                            <span>Siguiente</span>
                            <Pagination.NextIcon />
                          </Pagination.Next>
                        </Pagination.Item>
                      </Pagination.Content>
                    </Pagination>
                  ) : null}
                </div>
              </Table.Footer>
            </Table>
          )}
        </Card>
      )}

      {/* ── Detail Drawer ────────────────────────────────────────────────── */}
      <Drawer>
        <Drawer.Backdrop isOpen={drawerOpen} onOpenChange={handleDrawerOpenChange} variant="blur">
          <Drawer.Content placement="right" className="p-0 sm:p-3">
            <Drawer.Dialog className="flex h-full max-h-dvh flex-col overflow-hidden rounded-l-3xl border border-border/60 bg-overlay shadow-2xl sm:rounded-3xl">
              <Drawer.CloseTrigger />
              <Drawer.Header className="border-b border-border/60 pb-4">
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
                {detail && detail.beneficiaryRut && !isSamePatientAndBeneficiary(detail) && (
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
                        onPress={() => setDuplicatesModalOpen(true)}
                      >
                        Fusionar duplicado →
                      </Button>
                    ) : null;
                  })()}
              </Drawer.Header>

              <Drawer.Body className="pt-4">
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
                          {detail.healthInsurance === "ISAPRE" && detail.isapreName
                            ? `${INSURANCE_LABELS[detail.healthInsurance]} · ${detail.isapreName}`
                            : INSURANCE_LABELS[detail.healthInsurance]}
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
                                  <Accordion
                                    className="p-0 gap-1.5"
                                    hideSeparator
                                    variant="default"
                                  >
                                    {byYear[year]!.map((event) => {
                                      const isFuture = event.eventDate > today;
                                      const description = clinicalEventDescription(event);
                                      const stageLabel = clinicalEventStageLabel(event);
                                      return (
                                        <Accordion.Item
                                          key={event.eventId}
                                          aria-label={clinicalEventHeadline(event)}
                                          className="p-0"
                                        >
                                          <Accordion.Heading>
                                            <Accordion.Trigger
                                              className={`w-full rounded-2xl px-3 py-3 text-left hover:bg-default-100/60 data-[hover=true]:bg-default-100/60${isFuture ? " ring-1 ring-accent/30" : ""}`}
                                            >
                                              <div className="flex min-w-0 flex-1 flex-col gap-2">
                                                <div className="flex flex-wrap items-start justify-between gap-2">
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    <span
                                                      className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${isFuture ? "text-accent" : "text-foreground-500"}`}
                                                    >
                                                      {clinicalEventDateTimeLabel(event)}
                                                    </span>
                                                    {isFuture && (
                                                      <Chip size="sm" color="accent" variant="soft">
                                                        Próximo
                                                      </Chip>
                                                    )}
                                                  </div>
                                                  {stageLabel && (
                                                    <Chip size="sm" variant="tertiary">
                                                      {stageLabel}
                                                    </Chip>
                                                  )}
                                                </div>
                                                <p className="text-sm font-semibold leading-snug text-foreground">
                                                  {clinicalEventHeadline(event)}
                                                </p>
                                                {description && (
                                                  <p className="text-xs leading-relaxed text-foreground-500 whitespace-pre-line wrap-break-word">
                                                    {description}
                                                  </p>
                                                )}
                                              </div>
                                              <Accordion.Indicator className="text-foreground-400" />
                                            </Accordion.Trigger>
                                          </Accordion.Heading>
                                          <Accordion.Panel className="pb-0">
                                            <Accordion.Body className="px-3 pb-3 pt-0 text-xs">
                                              <div className="space-y-2 border-border/50 border-t pt-3">
                                                {description && (
                                                  <div className="space-y-1">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-400">
                                                      Descripción
                                                    </p>
                                                    <p className="text-foreground-500 whitespace-pre-line">
                                                      {description}
                                                    </p>
                                                  </div>
                                                )}
                                                {(() => {
                                                  const efs = eventFinancialStatus(event);
                                                  if (efs === "unknown") return null;
                                                  if (efs === "free")
                                                    return (
                                                      <p className="font-medium italic text-success">
                                                        Sin costo
                                                      </p>
                                                    );
                                                  return (
                                                    <p className="text-foreground-400">
                                                      $
                                                      {(event.amountPaid ?? 0).toLocaleString(
                                                        "es-CL"
                                                      )}{" "}
                                                      / $
                                                      {event.amountExpected!.toLocaleString(
                                                        "es-CL"
                                                      )}
                                                    </p>
                                                  );
                                                })()}
                                                {event.linkedFolios.length > 0 && (
                                                  <div className="mt-1 flex flex-wrap gap-1">
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
                                                )}
                                                {!isFuture && event.linkedFolios.length === 0 && (
                                                  <p className="text-[10px] italic text-foreground-300">
                                                    Sin boleta vinculada
                                                  </p>
                                                )}
                                                <Button
                                                  className="mt-2"
                                                  size="sm"
                                                  variant="ghost"
                                                  onPress={() =>
                                                    setSelectedSeriesEvent(
                                                      toCalendarEventDetail(event)
                                                    )
                                                  }
                                                >
                                                  Ver boletas y sugerencias
                                                </Button>
                                              </div>
                                            </Accordion.Body>
                                          </Accordion.Panel>
                                        </Accordion.Item>
                                      );
                                    })}
                                  </Accordion>
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

interface DuplicateGroup {
  dups: ClinicalSeriesDuplicate[];
  kind: ClinicalSeriesKind;
  patientName: null | string;
  targetEventCount: number;
  targetId: number;
}

const DUPES_PAGE_SIZE = 8;

function SourceEventsList({ sourceId }: { sourceId: number }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: clinicalSeriesKeys.detail(sourceId),
    queryFn: () => fetchClinicalSeriesDetail(sourceId),
    enabled: open,
  });

  return (
    <div className="mt-1">
      <button
        className="text-[11px] text-foreground-400 hover:text-foreground-600 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {open ? "▲ Ocultar eventos" : "▾ Ver eventos"}
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {isLoading ? (
            <Spinner size="sm" />
          ) : (
            (data?.events ?? []).map((ev) => (
              <div
                key={ev.eventId}
                className="flex items-baseline gap-1.5 text-[11px] text-foreground-400"
              >
                <span className="font-mono shrink-0">{ev.eventDate.slice(0, 10)}</span>
                <span className="truncate">{ev.seriesStageLabel ?? ev.patientName ?? "—"}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DuplicatesModal({
  duplicates,
  isOpen,
  onClose,
}: {
  duplicates: ClinicalSeriesDuplicate[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const [expandedTarget, setExpandedTarget] = useState<number | null>(null);
  const [mergingTarget, setMergingTarget] = useState<number | null>(null);
  // Selected source IDs per target — all pre-selected on first expand.
  const [selectedByTarget, setSelectedByTarget] = useState<Map<number, Set<number>>>(new Map());
  const merge = useMergeClinicalSeries();
  const queryClient = useQueryClient();

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

  const getSelected = (targetId: number, dups: ClinicalSeriesDuplicate[]) =>
    selectedByTarget.get(targetId) ?? new Set(dups.map((d) => d.sourceId));

  const setSelected = (targetId: number, next: Set<number>) => {
    setSelectedByTarget((prev) => {
      const m = new Map(prev);
      m.set(targetId, new Set(next));
      return m;
    });
  };

  const handleMergeSelected = async (group: DuplicateGroup) => {
    const selected = getSelected(group.targetId, group.dups);
    const toMerge = group.dups.filter((d) => selected.has(d.sourceId));
    if (toMerge.length === 0) return;
    setMergingTarget(group.targetId);
    try {
      for (const dup of toMerge) {
        await merge.mutateAsync({
          mergeReason: dup.reason,
          sourceId: dup.sourceId,
          targetId: dup.targetId,
        });
      }
      void queryClient.invalidateQueries({ queryKey: clinicalSeriesKeys.duplicates() });
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
                const selected = getSelected(group.targetId, group.dups);
                const allSelected = selected.size === group.dups.length;

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
                        {group.dups.map((dup) => {
                          const isSelected = selected.has(dup.sourceId);
                          const sourceHasMore = dup.sourceEventCount > group.targetEventCount;
                          return (
                            <Checkbox
                              key={dup.sourceId}
                              id={`dup-${dup.sourceId}`}
                              isSelected={isSelected}
                              isDisabled={isMerging}
                              onChange={(checked) => {
                                const next = new Set(selected);
                                if (checked) next.add(dup.sourceId);
                                else next.delete(dup.sourceId);
                                setSelected(group.targetId, next);
                              }}
                              className="flex items-start gap-3 px-3 py-2.5 border-b border-surface-200 last:border-b-0 hover:bg-surface-100 transition-colors w-full"
                            >
                              <Checkbox.Control className="mt-0.5 shrink-0">
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                              <Checkbox.Content className="flex-1 min-w-0">
                                <Label
                                  htmlFor={`dup-${dup.sourceId}`}
                                  className="flex flex-col gap-0.5 cursor-pointer w-full"
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium">
                                      {dup.sourcePatientName ?? (
                                        <span className="text-foreground-400 italic">
                                          Sin nombre
                                        </span>
                                      )}
                                    </span>
                                    {sourceHasMore && (
                                      <span className="text-[10px] text-warning font-medium">
                                        ↑ más eventos
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {dup.sourcePatientRut && (
                                      <span className="text-xs font-mono text-foreground-400">
                                        {dup.sourcePatientRut}
                                      </span>
                                    )}
                                    <span className="text-xs text-foreground-400">
                                      #{dup.sourceId} · {dup.sourceEventCount} ev.
                                    </span>
                                  </div>
                                  <p className="text-xs text-foreground-300 italic truncate">
                                    {dup.reason}
                                  </p>
                                </Label>
                                <SourceEventsList sourceId={dup.sourceId} />
                              </Checkbox.Content>
                            </Checkbox>
                          );
                        })}

                        {/* Footer */}
                        <div className="px-3 py-2 flex items-center justify-between gap-2">
                          {group.dups.length > 1 ? (
                            <button
                              className="text-xs text-foreground-400 hover:text-foreground-600 transition-colors"
                              onClick={() => {
                                setSelected(
                                  group.targetId,
                                  allSelected
                                    ? new Set()
                                    : new Set(group.dups.map((d) => d.sourceId))
                                );
                              }}
                            >
                              {allSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                            </button>
                          ) : (
                            <span />
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            isDisabled={isMerging || selected.size === 0}
                            onPress={() => void handleMergeSelected(group)}
                          >
                            {isMerging ? (
                              <Spinner size="sm" />
                            ) : allSelected && group.dups.length > 1 ? (
                              `Fusionar todos (${group.dups.length})`
                            ) : selected.size > 1 ? (
                              `Fusionar seleccionados (${selected.size})`
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
              <Checkbox id="auto-merge" isSelected={autoMerge} onChange={setAutoMerge}>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Content>
                  <Label htmlFor="auto-merge" className="text-sm cursor-pointer">
                    Fusionar series duplicadas
                  </Label>
                </Checkbox.Content>
              </Checkbox>
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
