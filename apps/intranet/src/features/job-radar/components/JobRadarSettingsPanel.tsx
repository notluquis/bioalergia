import { Button, Card, Input, Label, Switch, TextField } from "@heroui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { JobRadarSettings } from "@finanzas/orpc-contracts/job-radar";
import { useJobRadarSettings, useUpdateJobRadarSettings } from "../hooks/useJobRadar";
import { JobSourcesManager } from "./JobSourcesManager";

const EMPTY: JobRadarSettings = {
  enabled: false,
  bci: true,
  getonbrd: false,
  empleospublicos: false,
  muevete: true,
  keywords: "",
  departments: "",
  cron: "",
  telegramBotToken: "",
  telegramChatId: "",
};

export function JobRadarSettingsPanel() {
  const { t } = useTranslation();
  const { data } = useJobRadarSettings();
  const save = useUpdateJobRadarSettings();
  const [form, setForm] = useState<JobRadarSettings>(EMPTY);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const set = <K extends keyof JobRadarSettings>(key: K, value: JobRadarSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Card variant="tertiary" className="rounded-3xl">
      <Card.Header className="p-5 pb-2">
        <Card.Title className="text-base">{t("jobRadar.settings.title")}</Card.Title>
        <Card.Description>{t("jobRadar.settings.description")}</Card.Description>
      </Card.Header>
      <Card.Content className="space-y-5 p-5 pt-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
          <ToggleRow
            label={t("jobRadar.settings.enabled")}
            isSelected={form.enabled}
            onChange={(v) => set("enabled", v)}
          />
          <ToggleRow
            label={t("jobRadar.settings.bci")}
            isSelected={form.bci}
            onChange={(v) => set("bci", v)}
          />
          <ToggleRow
            label={t("jobRadar.settings.getonbrd")}
            isSelected={form.getonbrd}
            onChange={(v) => set("getonbrd", v)}
          />
          <ToggleRow
            label={t("jobRadar.settings.empleospublicos")}
            isSelected={form.empleospublicos}
            onChange={(v) => set("empleospublicos", v)}
          />
          <ToggleRow
            label={t("jobRadar.settings.muevete")}
            isSelected={form.muevete}
            onChange={(v) => set("muevete", v)}
          />
        </div>

        {/* Fuentes como filas (no CSV) */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">{t("jobRadar.sources.title")}</Label>
          <JobSourcesManager />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField value={form.keywords} onChange={(v) => set("keywords", v)}>
            <Label>{t("jobRadar.settings.keywords")}</Label>
            <Input placeholder="riesgo, data, product owner" />
          </TextField>

          <TextField value={form.departments} onChange={(v) => set("departments", v)}>
            <Label>{t("jobRadar.settings.departments")}</Label>
            <Input placeholder="riesgo, data & ia" />
          </TextField>

          <TextField value={form.cron} onChange={(v) => set("cron", v)}>
            <Label>{t("jobRadar.settings.cron")}</Label>
            <Input placeholder="*/30 * * * *" />
          </TextField>

          <TextField value={form.telegramBotToken} onChange={(v) => set("telegramBotToken", v)}>
            <Label>{t("jobRadar.settings.telegramBotToken")}</Label>
            <Input placeholder="123456:ABC-..." />
          </TextField>

          <TextField value={form.telegramChatId} onChange={(v) => set("telegramChatId", v)}>
            <Label>{t("jobRadar.settings.telegramChatId")}</Label>
            <Input placeholder="123456789" />
          </TextField>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" isPending={save.isPending} onPress={() => save.mutate(form)}>
            {t("jobRadar.settings.save")}
          </Button>
          {save.isSuccess && (
            <span className="text-sm text-success">{t("jobRadar.settings.saved")}</span>
          )}
          <p className="text-xs text-default-400">{t("jobRadar.settings.cronNote")}</p>
        </div>
      </Card.Content>
    </Card>
  );
}

function ToggleRow({
  label,
  isSelected,
  onChange,
}: {
  label: string;
  isSelected: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Switch isSelected={isSelected} onChange={onChange}>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Content>
        <Label className="cursor-pointer text-sm">{label}</Label>
      </Switch.Content>
    </Switch>
  );
}
