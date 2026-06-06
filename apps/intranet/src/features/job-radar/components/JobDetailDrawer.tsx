import { Button, Chip, Drawer, Label, ListBox, Select, TextArea, TextField } from "@heroui/react";
import DOMPurify from "dompurify";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import type { JobApplicationStatus, JobPostingDTO } from "@finanzas/orpc-contracts/job-radar";
import { useToast } from "@/context/ToastContext";
import { useUpdateJobApplication } from "../hooks/useJobRadar";

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

export function JobDetailDrawer({
  job,
  onClose,
}: {
  job: JobPostingDTO | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { success: toastSuccess, error: toastError } = useToast();
  const update = useUpdateJobApplication();
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<JobApplicationStatus>("NEW");

  useEffect(() => {
    if (job) {
      setNotes(job.notes ?? "");
      setStatus(job.applicationStatus);
    }
  }, [job]);

  const statusLabel = (s: JobApplicationStatus) => t(`jobRadar.status.${s}`);

  function save() {
    if (!job) return;
    update.mutate(
      { id: job.id, applicationStatus: status, notes: notes.trim() === "" ? null : notes },
      {
        onSuccess: () => {
          toastSuccess(t("jobRadar.detail.saved"));
          onClose();
        },
        onError: (e) => toastError(e),
      }
    );
  }

  const meta = job ? [job.company, job.department, job.location, job.remote].filter(Boolean) : [];
  const safeHtml = job?.descriptionHtml ? DOMPurify.sanitize(job.descriptionHtml) : "";

  return (
    <Drawer>
      <Drawer.Backdrop
        isOpen={job !== null}
        onOpenChange={(open) => !open && onClose()}
        variant="blur"
      >
        <Drawer.Content
          className="w-[min(92vw,640px)] border-l bg-background shadow-2xl"
          placement="right"
        >
          <Drawer.Dialog className="flex h-full max-h-dvh flex-col">
            <Drawer.CloseTrigger />
            <Drawer.Header className="border-default-200/70 border-b">
              <div className="space-y-2">
                <Drawer.Heading className="text-lg leading-snug">{job?.title}</Drawer.Heading>
                <div className="flex flex-wrap items-center gap-2">
                  {job && (
                    <Chip size="sm" variant="soft">
                      {statusLabel(job.applicationStatus)}
                    </Chip>
                  )}
                  {meta.map((m) => (
                    <span key={m} className="text-sm text-default-500">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </Drawer.Header>

            <Drawer.Body className="space-y-5">
              {job && (
                <div className="flex flex-wrap gap-3 text-xs text-default-400">
                  <span>
                    {t("jobRadar.col.published")}:{" "}
                    {job.publishedAt ? dayjs(job.publishedAt).format("DD/MM/YYYY") : "—"}
                  </span>
                  <span>
                    {t("jobRadar.col.detected")}: {dayjs(job.firstSeenAt).format("DD/MM/YYYY")}
                  </span>
                  <span>
                    {t("jobRadar.col.source")}: {job.source}
                  </span>
                </div>
              )}

              <Select value={status} onChange={(k) => k && setStatus(k as JobApplicationStatus)}>
                <Label>{t("jobRadar.changeStatus")}</Label>
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

              <TextField value={notes} onChange={setNotes}>
                <Label>{t("jobRadar.detail.notes")}</Label>
                <TextArea rows={4} placeholder={t("jobRadar.detail.notesPlaceholder")} />
              </TextField>

              {safeHtml ? (
                <div className="space-y-2">
                  <Label>{t("jobRadar.detail.description")}</Label>
                  <div
                    className="prose prose-sm max-w-none text-sm leading-6 [&_a]:underline"
                    // descriptionHtml viene de ATS externos → sanitizado con DOMPurify
                    dangerouslySetInnerHTML={{ __html: safeHtml }}
                  />
                </div>
              ) : (
                <p className="text-sm text-default-400">{t("jobRadar.detail.noDescription")}</p>
              )}
            </Drawer.Body>

            <Drawer.Footer className="border-default-200/70 border-t">
              {job && (
                <a href={job.url} target="_blank" rel="noreferrer">
                  <Button variant="tertiary">
                    <ExternalLink size={16} aria-hidden /> {t("jobRadar.actions.view")}
                  </Button>
                </a>
              )}
              <Button variant="primary" isPending={update.isPending} onPress={save}>
                {t("jobRadar.detail.save")}
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
