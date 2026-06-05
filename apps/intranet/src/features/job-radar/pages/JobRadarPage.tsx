import {
  Button,
  Card,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  TextField,
} from "@heroui/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import type { JobApplicationStatus, JobPostingDTO } from "@finanzas/orpc-contracts/job-radar";
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

export function JobRadarPage() {
  const { t } = useTranslation();
  const [appStatus, setAppStatus] = useState<"ALL" | JobApplicationStatus>("ALL");
  const [postingStatus, setPostingStatus] = useState<"OPEN" | "CLOSED" | "ALL">("OPEN");
  const [source, setSource] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const filters: JobRadarListFilters = useMemo(() => {
    const f: JobRadarListFilters = { postingStatus };
    if (appStatus !== "ALL") f.applicationStatus = appStatus;
    if (source !== "ALL") f.source = source;
    if (search.trim()) f.search = search.trim();
    return f;
  }, [appStatus, postingStatus, source, search]);

  const { data: postings, isPending } = useJobPostings(filters);
  const update = useUpdateJobApplication();
  const sync = useSyncJobRadar();

  const statusLabel = (s: JobApplicationStatus) => t(`jobRadar.status.${s}`);

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const p of postings ?? []) set.add(p.source);
    return [...set].sort();
  }, [postings]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t("jobRadar.title")}</h1>
          <p className="text-sm text-default-500">
            {t("jobRadar.count", { count: postings?.length ?? 0 })}
          </p>
        </div>
        <Button variant="primary" isPending={sync.isPending} onPress={() => sync.mutate()}>
          {t("jobRadar.sync")}
        </Button>
      </header>

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

      {isPending ? (
        <div
          className="flex justify-center py-16"
          aria-busy="true"
          aria-label={t("jobRadar.loading")}
        >
          <Spinner />
        </div>
      ) : (postings?.length ?? 0) === 0 ? (
        <Card variant="tertiary" className="rounded-3xl">
          <Card.Content className="py-12 text-center text-default-500">
            {t("jobRadar.empty")}
          </Card.Content>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(postings ?? []).map((job) => (
            <li key={job.id}>
              <JobCard
                job={job}
                statusLabel={statusLabel}
                onChangeStatus={(applicationStatus) =>
                  update.mutate({ id: job.id, applicationStatus })
                }
                t={t}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function JobCard({
  job,
  statusLabel,
  onChangeStatus,
  t,
}: {
  job: JobPostingDTO;
  statusLabel: (s: JobApplicationStatus) => string;
  onChangeStatus: (s: JobApplicationStatus) => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const meta = [job.company, job.department, job.location].filter(Boolean).join(" · ");
  const closed = job.status === "CLOSED";

  return (
    <Card variant="tertiary" className="h-full rounded-3xl shadow-sm">
      <Card.Header className="gap-2 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip color={STATUS_COLOR[job.applicationStatus]} size="sm" variant="soft">
            {statusLabel(job.applicationStatus)}
          </Chip>
          {job.matched && (
            <Chip color="success" size="sm" variant="soft">
              {t("jobRadar.matched")}
            </Chip>
          )}
          {closed && (
            <Chip color="default" size="sm" variant="soft">
              {t("jobRadar.posting.CLOSED")}
            </Chip>
          )}
        </div>
        <Card.Title className="text-lg leading-snug">
          <a href={job.url} target="_blank" rel="noreferrer" className="hover:underline">
            {job.title}
          </a>
        </Card.Title>
        <Card.Description>{meta}</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3 p-5 pt-0">
        <Select
          value={job.applicationStatus}
          onChange={(k) => k && onChangeStatus(k as JobApplicationStatus)}
        >
          <Label className="text-xs text-default-500">{t("jobRadar.changeStatus")}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {APP_STATUSES.map((s) => (
                <ListBox.Item key={s} id={s}>
                  {statusLabel(s)}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <div className="flex items-center justify-between text-xs text-default-400">
          <span>{job.publishedAt ? dayjs(job.publishedAt).format("DD/MM/YYYY") : ""}</span>
          <a href={job.url} target="_blank" rel="noreferrer">
            <Button variant="tertiary" size="sm">
              {t("jobRadar.viewOffer")}
            </Button>
          </a>
        </div>
      </Card.Content>
    </Card>
  );
}
