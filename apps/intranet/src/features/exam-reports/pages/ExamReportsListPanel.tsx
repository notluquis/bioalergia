import { Button, Chip, Disclosure, ListBox, SearchField, Select, Surface } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Download, Edit3, FileText, PlusCircle, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { AppDateRangePicker } from "@/components/forms/AppDatePicker";
import { PageHeader } from "@/components/layouts/PageHeader";
import { PageState } from "@/components/ui/PageState";
import { useConfirmDialog } from "@/context/ConfirmDialogContext";
import { useToast } from "@/context/ToastContext";
import { CreateExamReportWizard } from "@/features/exam-reports/components/CreateExamReportWizard";
import { PatientSelectModal } from "@/features/exam-reports/components/PatientSelectModal";
import { EXAM_TYPE_LABEL, EXAM_TYPE_ORDER } from "@/features/exam-reports/lib/exam-types";
import { downloadExamReportPdf } from "@/features/exam-reports/lib/pdf";
import { examReportsORPCClient } from "@/features/exam-reports/orpc";
import { examReportsKeys } from "@/features/exam-reports/queries";
import type { fetchPatients } from "@/features/patients/api";
import { CreatePatientModal } from "@/features/patients/components/CreatePatientModal";
import { useCan } from "@/hooks/use-can";
import { ageYears, chileDay, endOfWeek, formatChile, getISOWeek, startOfWeek } from "@/lib/dates";
import type { ExamType } from "@finanzas/orpc-contracts/exam-reports";

type Patient = Awaited<ReturnType<typeof fetchPatients>>[number];
type ExamReportListItem = Awaited<ReturnType<typeof examReportsORPCClient.list>>["items"][number];

/**
 * Exam reports list panel — extracted from the index route so it can be
 * hosted as a `<Tabs.Panel>` inside the unified `/exam-reports` page
 * (Phase 3 IA consolidation). Same flow as Shipments — "Nuevo Informe" →
 * patient picker → wizard. List view supports:
 *   - filter bar: tipo de examen, búsqueda libre (nombre / RUT /
 *     conclusión), rango de fechas (DateRangePicker)
 *   - agrupado año > mes > semana via nested HeroUI Disclosure so the
 *     operator can collapse/expand decades-old archives without
 *     scrolling through them.
 *
 * Grouping is computed client-side after the filtered fetch. Server
 * caps at 500 items per request — more than that and the operator is
 * already filtering, so the cap is a non-issue in practice.
 */
interface Filters {
  examType: ExamType | "ALL";
  search: string;
  from: string;
  to: string;
}

export function ExamReportsListPanel() {
  const toast = useToast();
  const qc = useQueryClient();
  const confirmDialog = useConfirmDialog();
  const { can } = useCan();
  const canCreate = can("create", "ExamReport");
  const canUpdate = can("update", "ExamReport");
  const canDelete = can("delete", "ExamReport");
  const navigate = useNavigate();

  const [selectPatientOpen, setSelectPatientOpen] = useState(false);
  const [createPatientOpen, setCreatePatientOpen] = useState(false);
  const [wizardPatient, setWizardPatient] = useState<Patient | null>(null);

  const [filters, setFilters] = useState<Filters>({
    examType: "ALL",
    search: "",
    from: "",
    to: "",
  });

  const listQ = useQuery(
    examReportsKeys.list({
      limit: 500,
      examType: filters.examType === "ALL" ? undefined : filters.examType,
      search: filters.search.trim() || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    })
  );
  const settingsQ = useQuery(examReportsKeys.clinicSettings());

  const items = listQ.data?.items ?? [];
  const grouped = useMemo(() => groupByYearMonthWeek(items), [items]);

  const downloadMutation = useMutation({
    mutationFn: async (id: number) => {
      const detail = await examReportsORPCClient.get({ id });
      const settings = settingsQ.data;
      if (!settings) throw new Error("ClinicSettings no cargada");
      await downloadExamReportPdf(
        {
          examType: detail.examType,
          conclusionText: detail.conclusionText,
          reagents: detail.reagents,
          technique: detail.technique,
          notes: detail.notes,
          doctorName: detail.doctorName,
          doctorSpecialty: detail.doctorSpecialty,
          doctorRut: detail.doctorRut,
          patient: {
            fullName: [
              detail.patient.person.names,
              detail.patient.person.fatherName,
              detail.patient.person.motherName,
            ]
              .filter(Boolean)
              .join(" "),
            age: detail.patient.birthDate ? `${ageYears(detail.patient.birthDate)} años` : null,
            rut: detail.patient.person.rut,
          },
          sections: detail.sections.map((s) => ({
            sectionKey: s.sectionKey,
            label: s.label,
            reactions: s.reactions.map((r) => ({
              reaction: r.reaction,
              allergen: r.allergen,
            })),
          })),
        },
        settings,
        `informe-${EXAM_TYPE_LABEL[detail.examType].replace(/\s+/g, "-")}-${detail.id}.pdf`
      );
      await examReportsORPCClient.markGenerated({ id: detail.id });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: examReportsKeys.lists() });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => examReportsORPCClient.delete({ id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: examReportsKeys.lists() });
      toast.success("Informe eliminado");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const renderRow = (r: ExamReportListItem) => {
    const fullName = [
      r.patient.person.names,
      r.patient.person.fatherName,
      r.patient.person.motherName,
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <li
        className="flex flex-col gap-2 border-default-100 border-t p-3 first:border-t-0 md:flex-row md:items-center md:justify-between"
        key={r.id}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="truncate">{fullName}</strong>
            <span className="font-mono text-default-600 text-xs">
              {r.patient.person.rut ?? "Sin RUT"}
            </span>
            <Chip color="accent" size="sm" variant="primary">
              {EXAM_TYPE_LABEL[r.examType]}
            </Chip>
          </div>
          <p className="mt-1 line-clamp-1 text-default-600 text-xs">{r.conclusionText}</p>
          <p className="text-default-600 text-xs">
            {formatChile(r.createdAt, "DD MMM YYYY · HH:mm")}
            {r.generatedAt ? " · PDF descargado" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canUpdate && (
            <Button
              aria-label="Editar informe"
              data-testid={`exam-report-edit-${r.id}`}
              isIconOnly
              onPress={() =>
                void navigate({ to: "/exam-reports/$id", params: { id: String(r.id) } })
              }
              size="sm"
              variant="outline"
            >
              <Edit3 className="size-4" />
            </Button>
          )}
          <Button
            aria-label="Descargar PDF"
            isIconOnly
            isPending={downloadMutation.isPending && downloadMutation.variables === r.id}
            onPress={() => downloadMutation.mutate(r.id)}
            size="sm"
            variant="outline"
          >
            <Download className="size-4" />
          </Button>
          {canDelete && (
            <Button
              aria-label="Eliminar"
              isIconOnly
              onPress={() => {
                void (async () => {
                  const ok = await confirmDialog({
                    title: "Eliminar informe",
                    description: "¿Eliminar este informe? La acción es irreversible.",
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
        title="Informes de exámenes"
        description={`${listQ.data?.total ?? 0} informe(s) generados`}
        actions={
          canCreate ? (
            <Button className="gap-2" onPress={() => setSelectPatientOpen(true)} size="sm">
              <PlusCircle size={16} />
              Nuevo Informe
            </Button>
          ) : null
        }
      />

      {/* Filter bar */}
      <Surface className="rounded-2xl border border-default-100 p-3" variant="default">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <Select
            aria-label="Tipo de examen"
            className="md:col-span-3"
            onSelectionChange={(k) =>
              setFilters((f) => ({ ...f, examType: (k as ExamType | "ALL") ?? "ALL" }))
            }
            selectedKey={filters.examType}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="ALL">Todos los tipos</ListBox.Item>
                {EXAM_TYPE_ORDER.map((t) => (
                  <ListBox.Item id={t} key={t}>
                    {EXAM_TYPE_LABEL[t]}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <SearchField
            aria-label="Buscar"
            className="md:col-span-4"
            onChange={(v) => setFilters((f) => ({ ...f, search: v }))}
            value={filters.search}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Nombre, RUT o texto…" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>

          <AppDateRangePicker
            aria-label="Rango de fechas"
            className="md:col-span-5"
            visibleMonths={2}
            startValue={filters.from}
            endValue={filters.to}
            onChange={(start, end) => {
              setFilters((f) => ({ ...f, from: start, to: end }));
            }}
          />
        </div>
      </Surface>

      {/* Grouped list */}
      <Surface className="rounded-3xl border border-default-100 p-2" variant="default">
        <PageState
          query={listQ}
          isEmpty={() => items.length === 0}
          emptyTitle="Sin informes para los filtros actuales."
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
                        {yearGroup.count} informe(s)
                        <ChevronDown className="size-4 transition group-data-[expanded]:rotate-180" />
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

      <PatientSelectModal
        isOpen={selectPatientOpen}
        onClose={() => setSelectPatientOpen(false)}
        onCreateNew={() => {
          setSelectPatientOpen(false);
          setCreatePatientOpen(true);
        }}
        onSelect={(patient) => {
          setWizardPatient(patient);
          setSelectPatientOpen(false);
        }}
      />

      <CreatePatientModal
        isOpen={createPatientOpen}
        onClose={() => {
          setCreatePatientOpen(false);
          setSelectPatientOpen(true);
        }}
      />

      {wizardPatient && (
        <CreateExamReportWizard
          isOpen
          onClose={() => setWizardPatient(null)}
          patient={wizardPatient}
        />
      )}
    </div>
  );
}

// ── Grouping helpers ────────────────────────────────────────────────────

interface WeekGroup {
  key: string;
  label: string;
  items: ExamReportListItem[];
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

function groupByYearMonthWeek(items: ExamReportListItem[]): YearGroup[] {
  // Items arrive sorted desc by createdAt from the server. Walk once,
  // bucketing into Year > Month > IsoWeek so the UI can render nested
  // Disclosures. Labels render in es-CL via formatChile.
  const years = new Map<number, MonthGroup[]>();
  const monthIndex = new Map<string, MonthGroup>();
  const weekIndex = new Map<string, WeekGroup>();

  for (const r of items) {
    const iso = chileDay(r.createdAt);
    const year = Number(iso.slice(0, 4));
    const month0 = Number(iso.slice(5, 7)) - 1;
    const isoWeek = getISOWeek(r.createdAt);
    const monthKey = `${year}-${month0}`;
    const weekKey = `${year}-W${isoWeek}`;

    let monthGroup = monthIndex.get(monthKey);
    if (!monthGroup) {
      monthGroup = {
        key: monthKey,
        label: formatChile(r.createdAt, "MMMM YYYY"),
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
      const weekStart = startOfWeek(r.createdAt);
      const weekEnd = endOfWeek(r.createdAt);
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
