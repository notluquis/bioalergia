import { Button, Chip, Input, Label, ListBox, Select, Switch, TextField } from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { JobSourceDTO, JobSourceKind } from "@finanzas/orpc-contracts/job-radar";
import { useToast } from "@/context/ToastContext";
import {
  useAddJobSource,
  useDeleteJobSource,
  useJobSources,
  useToggleJobSource,
} from "../hooks/useJobRadar";

const KINDS: JobSourceKind[] = [
  "TEAMTAILOR",
  "GREENHOUSE",
  "LEVER",
  "ASHBY",
  "SMARTRECRUITERS",
  "WORKDAY",
  "AIRAVIRTUAL",
];

const PLACEHOLDER: Record<JobSourceKind, string> = {
  TEAMTAILOR: "tenpo",
  GREENHOUSE: "chile",
  LEVER: "fintual",
  ASHBY: "toku",
  SMARTRECRUITERS: "Sodexo",
  WORKDAY: "tenant:wd:site",
  AIRAVIRTUAL: "walmart",
};

export function JobSourcesManager() {
  const { t } = useTranslation();
  const { error: toastError } = useToast();
  const { data: sources } = useJobSources();
  const add = useAddJobSource();
  const toggle = useToggleJobSource();
  const remove = useDeleteJobSource();

  const [kind, setKind] = useState<JobSourceKind>("TEAMTAILOR");
  const [identifier, setIdentifier] = useState("");

  const byKind = (k: JobSourceKind): JobSourceDTO[] => (sources ?? []).filter((s) => s.kind === k);

  function submit() {
    const id = identifier.trim();
    if (!id) return;
    add.mutate(
      { kind, identifier: id },
      {
        onSuccess: () => setIdentifier(""),
        onError: (e) => toastError(e),
      }
    );
  }

  return (
    <div className="space-y-4">
      {/* Alta */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr_auto] sm:items-end">
        <Select value={kind} onChange={(k) => k && setKind(k as JobSourceKind)}>
          <Label>{t("jobRadar.sources.kind")}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {KINDS.map((k) => (
                <ListBox.Item key={k} id={k}>
                  {k}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <TextField
          value={identifier}
          onChange={setIdentifier}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        >
          <Label>{t("jobRadar.sources.identifier")}</Label>
          <Input placeholder={PLACEHOLDER[kind]} />
        </TextField>
        <Button variant="primary" isPending={add.isPending} onPress={submit}>
          <Plus size={16} aria-hidden /> {t("jobRadar.sources.add")}
        </Button>
      </div>

      {/* Lista por fuente */}
      <div className="space-y-3">
        {KINDS.map((k) => {
          const rows = byKind(k);
          if (rows.length === 0) return null;
          return (
            <div key={k} className="space-y-1.5">
              <p className="text-xs font-semibold text-default-500">{k}</p>
              <div className="flex flex-wrap gap-2">
                {rows.map((s) => (
                  <span
                    key={s.id}
                    className="flex items-center gap-1.5 rounded-full border border-default-200 px-2 py-1"
                  >
                    <Switch
                      isSelected={s.enabled}
                      size="sm"
                      onChange={(enabled) => toggle.mutate({ id: s.id, enabled })}
                    >
                      <Chip size="sm" variant="soft" color={s.enabled ? "success" : "default"}>
                        {s.label ?? s.identifier}
                      </Chip>
                    </Switch>
                    <Button
                      aria-label={t("jobRadar.sources.remove")}
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      onPress={() => remove.mutate({ id: s.id })}
                    >
                      <Trash2 size={14} aria-hidden />
                    </Button>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
