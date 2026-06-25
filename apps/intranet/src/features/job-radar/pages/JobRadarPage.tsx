import { formatChile } from "@/lib/dates";
import {
  Button,
  Chip,
  Dropdown,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
  Tooltip,
} from "@heroui/react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import type { ColumnDef, OnChangeFn, RowSelectionState, SortingFn } from "@tanstack/react-table";
import { Ban, ExternalLink, Eye, ListChecks, RefreshCw, Send, Sparkles, Star } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  JobApplicationStatus,
  JobPostingDTO,
  JobRadarSyncResult,
} from "@finanzas/orpc-contracts/job-radar";
import { JOB_APPLICATION_STATUSES, JOB_POSTING_STATUSES } from "@finanzas/orpc-contracts/job-radar";
import { DataTable } from "@/components/data-table/DataTable";
import { useToast } from "@/context/ToastContext";
import { toast } from "@/lib/toast-interceptor";
import { JobDetailDrawer } from "../components/JobDetailDrawer";
import { JobRadarSettingsPanel } from "../components/JobRadarSettingsPanel";
import { dedupePostings, type DedupedPosting } from "../dedupe";
import {
  useBulkUpdateJobApplications,
  useJobRadarFilterOptions,
  useJobPostings,
  useJobRadarSyncProgress,
  useSyncJobRadar,
  useUpdateJobApplication,
} from "../hooks/useJobRadar";
import { SyncProgressBar } from "../components/SyncProgressBar";
import { jobRadarKeys, type JobRadarListFilters } from "../queries";
import {
  buildLocationFilterOptions,
  type LocationFilterOption,
  matchesLocationFilter,
  normalizeJobLocation,
} from "../location-normalizer";

const APP_STATUSES: JobApplicationStatus[] = [...JOB_APPLICATION_STATUSES];

type ChipColor = "default" | "success" | "warning" | "danger" | "accent";

const STATUS_COLOR: Record<JobApplicationStatus, ChipColor> = {
  NEW: "accent",
  SEEN: "default",
  INTERESTED: "warning",
  APPLIED: "success",
  INTERVIEW: "warning",
  OFFER: "success",
  REJECTED: "danger",
  DISCARDED: "default",
};

function fmtDate(d: Date | null): string {
  return d ? formatChile(d, "DD/MM/YYYY") : "—";
}

function locationGroupLabel(group: LocationFilterOption["group"]): string {
  switch (group) {
    case "zone":
      return "Zona";
    case "region":
      return "Región";
    case "commune":
      return "Comuna";
    case "country":
      return "País";
    case "mode":
      return "Modo";
    case "remote":
      return "Remoto";
    case "review":
      return "Revisar";
  }
}

// Orden por fecha null-safe (los null al fondo); evita el crash de "datetime" de
// TanStack con valores nulos y el orden raro del sortingFn "basic".
const dateSort: SortingFn<DedupedPosting> = (a, b, id) => {
  const av = (a.getValue(id) as Date | null)?.getTime() ?? -Infinity;
  const bv = (b.getValue(id) as Date | null)?.getTime() ?? -Infinity;
  return av - bv;
};

export function JobRadarPage() {
  const { t } = useTranslation();
  const [appStatus, setAppStatus] = useState<"ALL" | JobApplicationStatus>("ALL");
  const [postingStatus, setPostingStatus] = useState<"OPEN" | "CLOSED" | "ALL">("OPEN");
  const [source, setSource] = useState<string>("ALL");
  const [company, setCompany] = useState<string>("ALL");
  const [locationFilter, setLocationFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [detailJob, setDetailJob] = useState<JobPostingDTO | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastSyncResult, setLastSyncResult] = useState<JobRadarSyncResult | null>(null);
  const [debouncedSearch] = useDebouncedValue(search, { wait: 300 });

  const filters: JobRadarListFilters = useMemo(() => {
    const f: JobRadarListFilters = { postingStatus };
    if (appStatus !== "ALL") f.applicationStatus = appStatus;
    if (source !== "ALL") f.source = source;
    if (company !== "ALL") f.company = company;
    if (debouncedSearch.trim()) f.search = debouncedSearch.trim();
    return f;
  }, [appStatus, postingStatus, source, company, debouncedSearch]);

  const { data: filterOptions } = useJobRadarFilterOptions();
  const { data: postings, isPending } = useJobPostings(filters);
  const update = useUpdateJobApplication();
  const bulkUpdate = useBulkUpdateJobApplications();
  const sync = useSyncJobRadar();
  // `syncing` mantiene el poll vivo aunque la mutación HTTP (que puede tardar
  // >90s y morir en el gateway) ya haya terminado: seguimos hasta que el SERVER
  // reporte running:false. Así la barra no se congela.
  const [syncing, setSyncing] = useState(false);
  const sawRunning = useRef(false);
  const syncProgress = useJobRadarSyncProgress(syncing || sync.isPending);
  const queryClient = useQueryClient();
  const { error: toastError } = useToast();

  // Cerramos el poll sólo DESPUÉS de haber visto running:true (evita la carrera
  // con el estado `done` de un sync anterior). La mutación pudo no resolver si el
  // gateway cortó la request larga → refrescamos la lista igual.
  useEffect(() => {
    const p = syncProgress.data;
    if (!syncing || !p) return;
    if (p.running) sawRunning.current = true;
    else if (sawRunning.current) {
      sawRunning.current = false;
      if (p.result) setLastSyncResult(p.result);
      setSyncing(false);
      void queryClient.invalidateQueries({ queryKey: jobRadarKeys.all });
    }
  }, [syncProgress.data, syncing, queryClient]);

  const statusLabel = (s: JobApplicationStatus) => t(`jobRadar.status.${s}`);

  // Aplica el estado a 1..N ids (todas las publicaciones mergeadas de la oferta).
  // 1 id → update (preserva notas); varios → bulkUpdate. Devuelve la promesa.
  const mutateStatus = (ids: string[], applicationStatus: JobApplicationStatus) => {
    const single = ids.length === 1 ? ids[0] : undefined;
    return single
      ? update.mutateAsync({ id: single, applicationStatus })
      : bulkUpdate.mutateAsync({ ids, applicationStatus });
  };

  // Cambia el estado y deja un toast con botón "Deshacer" que revierte al previo.
  const setStatus = (
    ids: string[],
    applicationStatus: JobApplicationStatus,
    prevStatus?: JobApplicationStatus
  ) =>
    mutateStatus(ids, applicationStatus).then(
      () =>
        toast.success(t("jobRadar.statusUpdated", { status: statusLabel(applicationStatus) }), {
          description: "Job Radar",
          actionProps:
            prevStatus && prevStatus !== applicationStatus
              ? {
                  children: t("jobRadar.undo"),
                  onPress: () =>
                    void mutateStatus(ids, prevStatus).then(
                      () => toast.success(t("jobRadar.undone")),
                      (e) => toastError(e)
                    ),
                }
              : undefined,
        }),
      (e) => toastError(e)
    );

  // Dedup cross-source en display (la DB conserva todas las filas).
  const rows = useMemo(() => dedupePostings(postings ?? []), [postings]);
  const filteredRows = useMemo(
    () => rows.filter((row) => matchesLocationFilter(row, locationFilter)),
    [rows, locationFilter]
  );

  // El DataTable usa el `id` de la fila como clave de selección (getStableRowId).
  const rowSelection = useMemo<RowSelectionState>(
    () => Object.fromEntries(Array.from(selected, (id) => [id, true])),
    [selected]
  );

  const handleRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
    const next = typeof updater === "function" ? updater(rowSelection) : updater;
    setSelected(
      new Set(
        Object.entries(next)
          .filter(([, v]) => v)
          .map(([id]) => id)
      )
    );
  };

  // Mapa id-primario → todas las publicaciones mergeadas, para expandir la
  // selección a TODAS las filas DB de cada oferta elegida (select-all merged).
  const mergedByRow = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of rows) m.set(r.id, r.mergedIds);
    return m;
  }, [rows]);

  // Aplica el estado a todas las filas seleccionadas de una sola vez,
  // expandiendo cada fila a sus publicaciones mergeadas.
  const handleBulkStatus = (applicationStatus: JobApplicationStatus) => {
    if (selected.size === 0) return;
    const ids = [...new Set(Array.from(selected).flatMap((id) => mergedByRow.get(id) ?? [id]))];
    bulkUpdate.mutate(
      { ids, applicationStatus },
      {
        onSuccess: (res) => {
          setSelected(new Set());
          toast.success(
            t("jobRadar.bulkUpdated", {
              count: res.count,
              status: statusLabel(applicationStatus),
            }),
            { description: "Job Radar" }
          );
        },
        onError: (e) => toastError(e),
      }
    );
  };

  const companies = useMemo(() => {
    const options = filterOptions?.companies ?? [];
    return options
      .filter((option) => source === "ALL" || option.source === source)
      .map((option) => option.value)
      .filter((value, index, arr) => arr.indexOf(value) === index)
      .sort((a, b) => a.localeCompare(b, "es"));
  }, [filterOptions?.companies, source]);

  const sources = filterOptions?.sources ?? [];
  const locations = useMemo(() => buildLocationFilterOptions(rows), [rows]);
  const appStatusFilterOptions = filterOptions?.applicationStatuses ?? APP_STATUSES;
  const postingStatusFilterOptions = filterOptions?.postingStatuses ?? [...JOB_POSTING_STATUSES];

  useEffect(() => {
    if (source !== "ALL" && sources.length > 0 && !sources.includes(source)) setSource("ALL");
  }, [source, sources]);

  useEffect(() => {
    if (company !== "ALL" && companies.length > 0 && !companies.includes(company)) {
      setCompany("ALL");
    }
  }, [company, companies]);

  useEffect(() => {
    if (
      locationFilter !== "ALL" &&
      locations.length > 0 &&
      !locations.some((option) => option.key === locationFilter)
    ) {
      setLocationFilter("ALL");
    }
  }, [locationFilter, locations]);

  // Conteo por estado (sobre las filas ya deduplicadas).
  const counts = useMemo(() => {
    const c = new Map<JobApplicationStatus, number>();
    for (const p of filteredRows) c.set(p.applicationStatus, (c.get(p.applicationStatus) ?? 0) + 1);
    return c;
  }, [filteredRows]);

  const columns = useMemo<ColumnDef<DedupedPosting>[]>(
    () => [
      {
        accessorKey: "applicationStatus",
        header: t("jobRadar.col.status"),
        cell: ({ row }) => (
          <Chip color={STATUS_COLOR[row.original.applicationStatus]} size="sm" variant="soft">
            {statusLabel(row.original.applicationStatus)}
          </Chip>
        ),
      },
      {
        accessorKey: "title",
        header: t("jobRadar.col.title"),
        cell: ({ row }) => (
          <button
            type="button"
            title={row.original.title}
            className="line-clamp-2 block max-w-[34ch] text-left font-medium hover:underline"
            onClick={() => setDetailJob(row.original)}
          >
            {row.original.title}
          </button>
        ),
      },
      {
        accessorKey: "company",
        header: t("jobRadar.col.company"),
        cell: ({ row }) => <span className="capitalize">{row.original.company}</span>,
      },
      {
        accessorKey: "source",
        header: t("jobRadar.col.source"),
        cell: ({ row }) => (
          <span className="flex items-center gap-1">
            {row.original.source}
            {row.original.alsoOn?.length ? (
              <Chip size="sm" variant="soft" color="default">
                +{row.original.alsoOn.join(", ")}
              </Chip>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: "department",
        header: t("jobRadar.col.department"),
        cell: ({ row }) => row.original.department ?? "—",
      },
      {
        accessorKey: "location",
        header: t("jobRadar.col.location"),
        cell: ({ row }) => {
          const { location, remote } = row.original;
          const normalized = normalizeJobLocation(location, remote);
          const text = [location, remote].filter(Boolean).join(" · ") || "—";
          return (
            <span className="flex max-w-[28ch] flex-wrap items-center gap-1">
              <span className="truncate" title={text}>
                {text}
              </span>
              {location && !normalized.normalized ? (
                <Chip size="sm" variant="soft" color="warning">
                  {t("jobRadar.location.unnormalized")}
                </Chip>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: "salary",
        header: t("jobRadar.col.salary"),
        cell: ({ row }) =>
          row.original.salary ? (
            <span className="whitespace-nowrap text-success">{row.original.salary}</span>
          ) : (
            "—"
          ),
      },
      {
        accessorKey: "publishedAt",
        header: t("jobRadar.col.published"),
        sortingFn: dateSort,
        cell: ({ row }) => fmtDate(row.original.publishedAt),
      },
      {
        accessorKey: "firstSeenAt",
        header: t("jobRadar.col.detected"),
        sortingFn: dateSort,
        cell: ({ row }) => fmtDate(row.original.firstSeenAt),
      },
      {
        id: "match",
        header: t("jobRadar.col.match"),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.matched ? (
            <Chip color="success" size="sm" variant="soft">
              <Sparkles size={12} aria-hidden /> {t("jobRadar.matched")}
            </Chip>
          ) : (
            "—"
          ),
      },
      {
        id: "actions",
        header: t("jobRadar.col.actions"),
        enableSorting: false,
        cell: ({ row }) => {
          const job = row.original;
          const action = (
            key: string,
            label: string,
            icon: ReactNode,
            onPress: () => void,
            variant: "outline" | "ghost" = "outline"
          ) => (
            <Tooltip key={key}>
              <Tooltip.Trigger>
                <Button aria-label={label} isIconOnly size="sm" variant={variant} onPress={onPress}>
                  {icon}
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>{label}</Tooltip.Content>
            </Tooltip>
          );
          return (
            <div className="flex items-center gap-1">
              <Tooltip>
                <Tooltip.Trigger>
                  <a
                    aria-label={t("jobRadar.actions.view")}
                    className="inline-flex items-center justify-center rounded-full border border-default-300 text-foreground transition-colors hover:bg-default-100 size-8"
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ExternalLink size={16} aria-hidden />
                  </a>
                </Tooltip.Trigger>
                <Tooltip.Content>{t("jobRadar.actions.view")}</Tooltip.Content>
              </Tooltip>
              {action("seen", t("jobRadar.actions.seen"), <Eye size={16} aria-hidden />, () =>
                setStatus(job.mergedIds, "SEEN", job.applicationStatus)
              )}
              {action(
                "interested",
                t("jobRadar.actions.interested"),
                <Star size={16} aria-hidden />,
                () => setStatus(job.mergedIds, "INTERESTED", job.applicationStatus)
              )}
              {action(
                "applied",
                t("jobRadar.actions.applied"),
                <Send size={16} aria-hidden />,
                () => setStatus(job.mergedIds, "APPLIED", job.applicationStatus)
              )}
              {action(
                "discarded",
                t("jobRadar.actions.discard"),
                <Ban size={16} aria-hidden />,
                () => setStatus(job.mergedIds, "DISCARDED", job.applicationStatus)
              )}
              <Dropdown>
                <Dropdown.Trigger>
                  <Button
                    aria-label={t("jobRadar.changeStatus")}
                    isIconOnly
                    size="sm"
                    variant="outline"
                  >
                    <ListChecks size={16} aria-hidden />
                  </Button>
                </Dropdown.Trigger>
                <Dropdown.Popover>
                  <Dropdown.Menu
                    onAction={(key) =>
                      setStatus(job.mergedIds, key as JobApplicationStatus, job.applicationStatus)
                    }
                  >
                    {APP_STATUSES.map((s) => (
                      <Dropdown.Item key={s} id={s} textValue={statusLabel(s)}>
                        <Label>{statusLabel(s)}</Label>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </div>
          );
        },
      },
    ],
    [t, postings] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{t("jobRadar.title")}</h2>
          <p className="text-sm text-default-500">
            {t("jobRadar.count", { count: filteredRows.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="tertiary" onPress={() => setShowSettings((v) => !v)}>
            {t("jobRadar.settings.toggle")}
          </Button>
          <Button
            aria-label={t("jobRadar.sync")}
            isIconOnly
            variant="primary"
            isPending={sync.isPending}
            onPress={() => {
              setLastSyncResult(null);
              setSyncing(true);
              sync.mutate();
            }}
          >
            <RefreshCw size={16} aria-hidden />
          </Button>
        </div>
      </header>

      <SyncProgressBar progress={syncProgress.data} active={syncing || sync.isPending} />

      {lastSyncResult && (
        <div className="flex flex-wrap gap-2 rounded-medium bg-default-100 p-3">
          <Chip size="sm" variant="soft">
            {t("jobRadar.syncResult.fetched", { count: lastSyncResult.fetched })}
          </Chip>
          <Chip color="success" size="sm" variant="soft">
            {t("jobRadar.syncResult.inserted", { count: lastSyncResult.inserted })}
          </Chip>
          <Chip color="warning" size="sm" variant="soft">
            {t("jobRadar.syncResult.updated", { count: lastSyncResult.updated })}
          </Chip>
          <Chip size="sm" variant="soft">
            {t("jobRadar.syncResult.unchanged", { count: lastSyncResult.unchanged })}
          </Chip>
          <Chip color="danger" size="sm" variant="soft">
            {t("jobRadar.syncResult.closed", { count: lastSyncResult.closed })}
          </Chip>
          <Chip color="accent" size="sm" variant="soft">
            {t("jobRadar.syncResult.notified", { count: lastSyncResult.notified })}
          </Chip>
        </div>
      )}

      {showSettings && <JobRadarSettingsPanel />}

      {/* Resumen por estado */}
      <div className="flex flex-wrap gap-2">
        {APP_STATUSES.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => (
          <Chip key={s} color={STATUS_COLOR[s]} size="sm" variant="soft">
            {statusLabel(s)}: {counts.get(s)}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Select
          value={appStatus}
          onChange={(k) => k && setAppStatus(k as "ALL" | JobApplicationStatus)}
        >
          <Label>{t("jobRadar.filters.applicationStatus")}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="ALL">{t("jobRadar.filters.all")}</ListBox.Item>
              {appStatusFilterOptions.map((s) => (
                <ListBox.Item key={s} id={s}>
                  {statusLabel(s)}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select
          value={postingStatus}
          onChange={(k) => k && setPostingStatus(k as "OPEN" | "CLOSED" | "ALL")}
        >
          <Label>{t("jobRadar.filters.postingStatus")}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {(["ALL", ...postingStatusFilterOptions] as const).map((s) => (
                <ListBox.Item key={s} id={s}>
                  {t(`jobRadar.posting.${s}`)}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select value={source} onChange={(k) => k && setSource(String(k))}>
          <Label>{t("jobRadar.filters.source")}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="ALL">{t("jobRadar.filters.all")}</ListBox.Item>
              {sources.map((s) => (
                <ListBox.Item key={s} id={s}>
                  {s}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select value={company} onChange={(k) => k && setCompany(String(k))}>
          <Label>{t("jobRadar.filters.company")}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="ALL">{t("jobRadar.filters.all")}</ListBox.Item>
              {companies.map((c) => (
                <ListBox.Item key={c} id={c}>
                  {c}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select value={locationFilter} onChange={(k) => k && setLocationFilter(String(k))}>
          <Label>{t("jobRadar.filters.location")}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="ALL">{t("jobRadar.filters.all")}</ListBox.Item>
              {locations.map((option) => (
                <ListBox.Item key={option.key} id={option.key}>
                  {locationGroupLabel(option.group)} · {option.label}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <TextField value={search} onChange={setSearch}>
          <Label>{t("jobRadar.filters.search")}</Label>
          <Input placeholder={t("jobRadar.filters.searchPlaceholder")} />
        </TextField>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-medium bg-default-100 p-3">
          <span className="text-sm font-medium">
            {t("jobRadar.bulk.selected", { count: selected.size })}
          </span>
          <Dropdown>
            <Dropdown.Trigger>
              <Button size="sm" variant="primary" isPending={bulkUpdate.isPending}>
                {t("jobRadar.bulk.changeStatus")}
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu onAction={(key) => handleBulkStatus(key as JobApplicationStatus)}>
                {APP_STATUSES.map((s) => (
                  <Dropdown.Item key={s} id={s} textValue={statusLabel(s)}>
                    <Label>{statusLabel(s)}</Label>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          <Button size="sm" variant="tertiary" onPress={() => setSelected(new Set())}>
            {t("jobRadar.bulk.clear")}
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filteredRows}
        isLoading={isPending}
        enableGlobalFilter={false}
        enableExport={false}
        enableVirtualization={false}
        noDataMessage={t("jobRadar.empty")}
        pageSizeOptions={[10, 25, 50, 100]}
        scrollMaxHeight="min(68dvh, 760px)"
        rowSelection={rowSelection}
        onRowSelectionChange={handleRowSelectionChange}
      />

      <JobDetailDrawer job={detailJob} onClose={() => setDetailJob(null)} />
    </div>
  );
}
