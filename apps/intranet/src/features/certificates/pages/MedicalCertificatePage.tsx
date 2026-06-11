import {
  Button,
  Chip,
  DateField,
  DateRangePicker,
  Disclosure,
  Label,
  RangeCalendar,
  SearchField,
  Surface,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, PlusCircle, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layouts/PageHeader";
import { PageState } from "@/components/ui/PageState";
import { useConfirmDialog } from "@/context/ConfirmDialogContext";
import { useToast } from "@/context/ToastContext";
import { useCan } from "@/hooks/use-can";
import { chileDay, endOfWeek, formatChile, getISOWeek, startOfWeek } from "@/lib/dates";
import { certificatesORPCClient } from "@/features/certificates/orpc";
import { certificatesKeys } from "@/features/certificates/queries";
import { CreateMedicalCertificateModal } from "@/features/certificates/components/CreateMedicalCertificateModal";
import type { MedicalCertificateListItem } from "@finanzas/orpc-contracts/certificates";
import { csrfFetch } from "@/lib/csrf-fetch";

interface Filters {
  search: string;
  from: string;
  to: string;
}

export function MedicalCertificatePage() {
  const toast = useToast();
  const qc = useQueryClient();
  const confirmDialog = useConfirmDialog();
  const { can } = useCan();
  const canCreate = can("create", "MedicalCertificate");
  const canDelete = can("delete", "MedicalCertificate");
  const canRead = can("read", "MedicalCertificate");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    search: "",
    from: "",
    to: "",
  });

  const listQ = useQuery(
    certificatesKeys.medicalList({
      limit: 200,
      search: filters.search.trim() || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    })
  );

  const items = listQ.data?.items ?? [];
  const grouped = useMemo(() => groupByYearMonthWeek(items), [items]);

  const downloadPdf = async (id: string, rut: string | null) => {
    try {
      setDownloadingId(id);
      const res = await csrfFetch(`/api/certificates/medical/${id}/pdf`);
      if (!res.ok) throw new Error("Error al descargar PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeRut = (rut ?? "sin_rut").replace(/\./g, "");
      a.download = `certificado_${safeRut}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => certificatesORPCClient.deleteMedical({ id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: certificatesKeys.medicalLists() });
      toast.success("Certificado eliminado");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const renderRow = (r: MedicalCertificateListItem) => {
    return (
      <li
        className="flex flex-col gap-2 border-default-100 border-t p-3 first:border-t-0 md:flex-row md:items-center md:justify-between"
        key={r.id}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="truncate">{r.patientName}</strong>
            <span className="font-mono text-default-600 text-xs">{r.patientRut ?? "Sin RUT"}</span>
            <Chip color="accent" size="sm" variant="primary">
              Certificado Médico
            </Chip>
          </div>
          <p className="mt-1 line-clamp-1 text-default-600 text-xs">{r.diagnosis}</p>
          <p className="text-default-600 text-xs">
            Emitido: {formatChile(r.issuedAt, "DD MMM YYYY · HH:mm")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canRead && (
            <Button
              aria-label="Descargar PDF"
              isIconOnly
              isPending={downloadingId === r.id}
              onPress={() => downloadPdf(r.id, r.patientRut)}
              size="sm"
              variant="outline"
            >
              <Download className="size-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              aria-label="Eliminar"
              isIconOnly
              onPress={() => {
                void (async () => {
                  const ok = await confirmDialog({
                    title: "Eliminar certificado",
                    description: "¿Eliminar este certificado? La acción es irreversible.",
                    confirmLabel: "Eliminar",
                    confirmVariant: "danger",
                    status: "danger",
                  });
                  if (ok) deleteMutation.mutate(r.id);
                })();
              }}
              size="sm"
              variant="danger"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Certificados Médicos"
        description={`${listQ.data?.total ?? 0} certificado(s) emitidos`}
        actions={
          canCreate ? (
            <Button className="gap-2" onPress={() => setCreateModalOpen(true)} size="sm">
              <PlusCircle size={16} />
              Nuevo Certificado
            </Button>
          ) : null
        }
      />

      {/* Filter bar */}
      <Surface className="rounded-2xl border border-default-100 p-3" variant="default">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <SearchField
            aria-label="Buscar"
            className="md:col-span-6"
            onChange={(v) => setFilters((f) => ({ ...f, search: v }))}
            value={filters.search}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Buscar por nombre, RUT o diagnóstico..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>

          <DateRangePicker
            aria-label="Rango de fechas"
            className="md:col-span-6"
            onChange={(value) => {
              if (!value) {
                setFilters((f) => ({ ...f, from: "", to: "" }));
                return;
              }
              setFilters((f) => ({
                ...f,
                from: value.start.toString(),
                to: value.end.toString(),
              }));
            }}
            value={
              filters.from && filters.to
                ? { end: parseDate(filters.to), start: parseDate(filters.from) }
                : undefined
            }
          >
            <Label className="sr-only">Rango de fechas</Label>
            <DateField.Group className="h-9 text-sm" fullWidth variant="secondary">
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
                aria-label="Seleccionar rango de fechas"
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
              </RangeCalendar>
            </DateRangePicker.Popover>
          </DateRangePicker>
        </div>
      </Surface>

      {/* Grouped list */}
      <Surface className="rounded-3xl border border-default-100 p-2" variant="default">
        <PageState
          query={listQ}
          isEmpty={() => items.length === 0}
          emptyTitle="Sin certificados para los filtros actuales."
          loadingLabel="Cargando…"
        >
          {() => (
            <div className="space-y-2 p-1">
              {grouped.map((yearGroup) => (
                <Disclosure defaultExpanded key={yearGroup.year}>
                  <Disclosure.Heading>
                    <Button
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 font-semibold text-base"
                      size="sm"
                      slot="trigger"
                      variant="outline"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="size-4 text-default-500" />
                        {yearGroup.year}
                      </span>
                      <span className="flex items-center gap-2 text-default-500 text-xs">
                        {yearGroup.count} certificado(s)
                      </span>
                    </Button>
                  </Disclosure.Heading>
                  <Disclosure.Content>
                    <Disclosure.Body className="space-y-2 p-2 pl-4">
                      {yearGroup.months.map((monthGroup) => (
                        <Disclosure defaultExpanded={false} key={monthGroup.key}>
                          <Disclosure.Heading>
                            <Button
                              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-sm capitalize"
                              size="sm"
                              slot="trigger"
                              variant="ghost"
                            >
                              <span>{monthGroup.label}</span>
                              <span className="text-default-500 text-xs">{monthGroup.count}</span>
                            </Button>
                          </Disclosure.Heading>
                          <Disclosure.Content>
                            <Disclosure.Body className="space-y-1 p-1 pl-3">
                              {monthGroup.weeks.map((weekGroup) => (
                                <Disclosure
                                  defaultExpanded={monthGroup.weeks.length === 1}
                                  key={weekGroup.key}
                                >
                                  <Disclosure.Heading>
                                    <Button
                                      className="flex w-full items-center justify-between gap-2 px-3 py-1 text-default-600 text-xs"
                                      size="sm"
                                      slot="trigger"
                                      variant="ghost"
                                    >
                                      <span>{weekGroup.label}</span>
                                      <span>{weekGroup.items.length}</span>
                                    </Button>
                                  </Disclosure.Heading>
                                  <Disclosure.Content>
                                    <Disclosure.Body className="p-0">
                                      <ul className="overflow-hidden rounded-xl border border-default-100">
                                        {weekGroup.items.map(renderRow)}
                                      </ul>
                                    </Disclosure.Body>
                                  </Disclosure.Content>
                                </Disclosure>
                              ))}
                            </Disclosure.Body>
                          </Disclosure.Content>
                        </Disclosure>
                      ))}
                    </Disclosure.Body>
                  </Disclosure.Content>
                </Disclosure>
              ))}
            </div>
          )}
        </PageState>
      </Surface>

      <CreateMedicalCertificateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}

// ── Grouping helpers ────────────────────────────────────────────────────

interface WeekGroup {
  key: string;
  label: string;
  items: MedicalCertificateListItem[];
}

interface MonthGroup {
  key: string;
  label: string;
  count: number;
  weeks: WeekGroup[];
}

interface YearGroup {
  year: number;
  count: number;
  months: MonthGroup[];
}

function groupByYearMonthWeek(items: MedicalCertificateListItem[]): YearGroup[] {
  const years = new Map<number, MonthGroup[]>();
  const monthIndex = new Map<string, MonthGroup>();
  const weekIndex = new Map<string, WeekGroup>();

  for (const r of items) {
    const iso = chileDay(r.issuedAt);
    const year = Number(iso.slice(0, 4));
    const month0 = Number(iso.slice(5, 7)) - 1;
    const isoWeek = getISOWeek(r.issuedAt);
    const monthKey = `${year}-${month0}`;
    const weekKey = `${year}-W${isoWeek}`;

    let monthGroup = monthIndex.get(monthKey);
    if (!monthGroup) {
      monthGroup = {
        key: monthKey,
        label: formatChile(r.issuedAt, "MMMM YYYY"),
        count: 0,
        weeks: [],
      };
      monthIndex.set(monthKey, monthGroup);
      const yearBucket = years.get(year) ?? [];
      yearBucket.push(monthGroup);
      years.set(year, yearBucket);
    }

    let weekGroup = weekIndex.get(weekKey);
    if (!weekGroup) {
      const weekStart = startOfWeek(r.issuedAt);
      const weekEnd = endOfWeek(r.issuedAt);
      weekGroup = {
        key: weekKey,
        label: `Semana ${isoWeek} · ${formatChile(weekStart, "DD MMM")} – ${formatChile(weekEnd, "DD MMM")}`,
        items: [],
      };
      weekIndex.set(weekKey, weekGroup);
      monthGroup.weeks.push(weekGroup);
    }

    weekGroup.items.push(r);
    monthGroup.count += 1;
  }

  return Array.from(years.entries())
    .map(([year, months]) => ({
      year,
      count: months.reduce((acc, m) => acc + m.count, 0),
      months,
    }))
    .sort((a, b) => b.year - a.year);
}
