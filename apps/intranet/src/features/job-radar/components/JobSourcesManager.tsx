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
  "SUCCESSFACTORS",
  "TRABAJANDO",
  "SFCLASSIC",
  "GENOMAWORK",
  "HIRINGROOM",
  "BUK",
  "HIREFRONT",
  "CORNERSTONE",
];

const PLACEHOLDER: Record<JobSourceKind, string> = {
  TEAMTAILOR: "tenpo",
  GREENHOUSE: "chile",
  LEVER: "fintual",
  ASHBY: "toku",
  SMARTRECRUITERS: "Sodexo",
  WORKDAY: "tenant:wd:site",
  AIRAVIRTUAL: "walmart",
  SUCCESSFACTORS: "trabajos.achs.cl",
  TRABAJANDO: "cge",
  SFCLASSIC: "career8.successfactors.com:career:lan:es_CL",
  GENOMAWORK: "sky-airline",
  HIRINGROOM: "cinepolis",
  BUK: "hites",
  HIREFRONT: "junji",
  CORNERSTONE: "cencosud:5",
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

      {/* Lista por fuente — una tarjeta por ATS */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {KINDS.map((k) => {
          const rows = byKind(k);
          if (rows.length === 0) return null;
          const activos = rows.filter((s) => s.enabled).length;
          return (
            <div key={k} className="rounded-2xl border border-default-200 bg-default-50/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wide text-default-600">{k}</p>
                <Chip size="sm" variant="soft" color="default">
                  {activos}/{rows.length}
                </Chip>
              </div>
              <div className="flex flex-col gap-1">
                {rows.map((s) => (
                  <div
                    key={s.id}
                    className="group flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 hover:bg-default-100"
                  >
                    <Switch
                      isSelected={s.enabled}
                      size="sm"
                      className="min-w-0 flex-1"
                      onChange={(enabled) => toggle.mutate({ id: s.id, enabled })}
                    >
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <Switch.Content className="min-w-0">
                        <Label
                          className={`cursor-pointer truncate text-sm ${
                            s.enabled ? "text-foreground" : "text-default-400"
                          }`}
                        >
                          {s.label ?? s.identifier}
                        </Label>
                      </Switch.Content>
                    </Switch>
                    <Button
                      aria-label={t("jobRadar.sources.remove")}
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onPress={() => remove.mutate({ id: s.id })}
                    >
                      <Trash2 size={14} aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
