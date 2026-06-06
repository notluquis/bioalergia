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
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Ban, ExternalLink, Eye, ListChecks, RefreshCw, Send, Sparkles, Star } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { JobApplicationStatus, JobPostingDTO } from "@finanzas/orpc-contracts/job-radar";
import { DataTable } from "@/components/data-table/DataTable";
import { JobDetailDrawer } from "../components/JobDetailDrawer";
import { JobRadarSettingsPanel } from "../components/JobRadarSettingsPanel";
import { useJobPostings, useSyncJobRadar, useUpdateJobApplication } from "../hooks/useJobRadar";
import type { JobRadarListFilters } from "../queries";

const APP_STATUSES: JobApplicationStatus[] = [
  "NEW",
  "SEEN",
  "INTERESTED",
  "APPLIED",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "DISCARDED",
];

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

const POSTING_STATUS_OPTIONS = ["OPEN", "CLOSED", "ALL"] as const;

function fmtDate(d: Date | null): string {
  return d ? dayjs(d).format("DD/MM/YYYY") : "—";
}

export function JobRadarPage() {
  const { t } = useTranslation();
  const [appStatus, setAppStatus] = useState<"ALL" | JobApplicationStatus>("ALL");
  const [postingStatus, setPostingStatus] = useState<"OPEN" | "CLOSED" | "ALL">("OPEN");
  const [source, setSource] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [detailJob, setDetailJob] = useState<JobPostingDTO | null>(null);
  const [debouncedSearch] = useDebouncedValue(search, { wait: 300 });

  const filters: JobRadarListFilters = useMemo(() => {
    const f: JobRadarListFilters = { postingStatus };
    if (appStatus !== "ALL") f.applicationStatus = appStatus;
    if (source !== "ALL") f.source = source;
    if (debouncedSearch.trim()) f.search = debouncedSearch.trim();
    return f;
  }, [appStatus, postingStatus, source, debouncedSearch]);

  const { data: postings, isPending } = useJobPostings(filters);
  const update = useUpdateJobApplication();
  const sync = useSyncJobRadar();

  const statusLabel = (s: JobApplicationStatus) => t(`jobRadar.status.${s}`);
  const setStatus = (id: string, applicationStatus: JobApplicationStatus) =>
    update.mutate({ id, applicationStatus });

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const p of postings ?? []) set.add(p.source);
    return [...set].sort();
  }, [postings]);

  // Conteo por estado de la tanda cargada — "más cosas" en pantalla.
  const counts = useMemo(() => {
    const c = new Map<JobApplicationStatus, number>();
    for (const p of postings ?? [])
      c.set(p.applicationStatus, (c.get(p.applicationStatus) ?? 0) + 1);
    return c;
  }, [postings]);

  const columns = useMemo<ColumnDef<JobPostingDTO>[]>(
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
            className="text-left font-medium hover:underline"
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
      { accessorKey: "source", header: t("jobRadar.col.source") },
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
          return [location, remote].filter(Boolean).join(" · ") || "—";
        },
      },
      {
        accessorKey: "publishedAt",
        header: t("jobRadar.col.published"),
        cell: ({ row }) => fmtDate(row.original.publishedAt),
      },
      {
        accessorKey: "firstSeenAt",
        header: t("jobRadar.col.detected"),
        cell: ({ row }) => fmtDate(row.original.firstSeenAt),
      },
      {
        id: "match",
        header: t("jobRadar.col.match"),
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
              {action(
                "open",
                t("jobRadar.actions.view"),
                <ExternalLink size={16} aria-hidden />,
                () => window.open(job.url, "_blank", "noopener,noreferrer")
              )}
              {action("seen", t("jobRadar.actions.seen"), <Eye size={16} aria-hidden />, () =>
                setStatus(job.id, "SEEN")
              )}
              {action(
                "interested",
                t("jobRadar.actions.interested"),
                <Star size={16} aria-hidden />,
                () => setStatus(job.id, "INTERESTED")
              )}
              {action(
                "applied",
                t("jobRadar.actions.applied"),
                <Send size={16} aria-hidden />,
                () => setStatus(job.id, "APPLIED")
              )}
              {action(
                "discarded",
                t("jobRadar.actions.discard"),
                <Ban size={16} aria-hidden />,
                () => setStatus(job.id, "DISCARDED")
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
                  <Dropdown.Menu onAction={(key) => setStatus(job.id, key as JobApplicationStatus)}>
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
            {t("jobRadar.count", { count: postings?.length ?? 0 })}
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
            onPress={() => sync.mutate()}
          >
            <RefreshCw size={16} aria-hidden />
          </Button>
        </div>
      </header>

      {showSettings && <JobRadarSettingsPanel />}

      {/* Resumen por estado */}
      <div className="flex flex-wrap gap-2">
        {APP_STATUSES.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => (
          <Chip key={s} color={STATUS_COLOR[s]} size="sm" variant="soft">
            {statusLabel(s)}: {counts.get(s)}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              {APP_STATUSES.map((s) => (
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
              {POSTING_STATUS_OPTIONS.map((s) => (
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

        <TextField value={search} onChange={setSearch}>
          <Label>{t("jobRadar.filters.search")}</Label>
          <Input placeholder={t("jobRadar.filters.searchPlaceholder")} />
        </TextField>
      </div>

      <DataTable
        columns={columns}
        data={postings ?? []}
        isLoading={isPending}
        enableGlobalFilter={false}
        enableExport={false}
        noDataMessage={t("jobRadar.empty")}
        pageSizeOptions={[10, 25, 50, 100]}
        scrollMaxHeight="min(68dvh, 760px)"
      />

      <JobDetailDrawer job={detailJob} onClose={() => setDetailJob(null)} />
    </div>
  );
}
