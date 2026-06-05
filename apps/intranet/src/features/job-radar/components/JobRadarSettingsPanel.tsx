import { Button, Card, Input, Label, Switch, TextField } from "@heroui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { JobRadarSettings } from "@finanzas/orpc-contracts/job-radar";
import { useJobRadarSettings, useUpdateJobRadarSettings } from "../hooks/useJobRadar";

const EMPTY: JobRadarSettings = {
  enabled: false,
  companies: "",
  bci: true,
  getonbrd: false,
  greenhouse: "",
  lever: "",
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
      <Card.Content className="grid grid-cols-1 gap-4 p-5 pt-3 md:grid-cols-2">
        <div className="flex items-center gap-6 md:col-span-2">
          <Switch isSelected={form.enabled} onChange={(v) => set("enabled", v)}>
            {t("jobRadar.settings.enabled")}
          </Switch>
          <Switch isSelected={form.bci} onChange={(v) => set("bci", v)}>
            {t("jobRadar.settings.bci")}
          </Switch>
          <Switch isSelected={form.getonbrd} onChange={(v) => set("getonbrd", v)}>
            {t("jobRadar.settings.getonbrd")}
          </Switch>
        </div>

        <TextField value={form.companies} onChange={(v) => set("companies", v)}>
          <Label>{t("jobRadar.settings.companies")}</Label>
          <Input placeholder="tenpo, tinet, mindwork, global66" />
        </TextField>

        <TextField value={form.cron} onChange={(v) => set("cron", v)}>
          <Label>{t("jobRadar.settings.cron")}</Label>
          <Input placeholder="*/30 * * * *" />
        </TextField>

        <TextField value={form.greenhouse} onChange={(v) => set("greenhouse", v)}>
          <Label>{t("jobRadar.settings.greenhouse")}</Label>
          <Input placeholder="chile" />
        </TextField>

        <TextField value={form.lever} onChange={(v) => set("lever", v)}>
          <Label>{t("jobRadar.settings.lever")}</Label>
          <Input placeholder="fintual, xepelin" />
        </TextField>

        <TextField value={form.keywords} onChange={(v) => set("keywords", v)}>
          <Label>{t("jobRadar.settings.keywords")}</Label>
          <Input placeholder="riesgo, data, product owner" />
        </TextField>

        <TextField value={form.departments} onChange={(v) => set("departments", v)}>
          <Label>{t("jobRadar.settings.departments")}</Label>
          <Input placeholder="riesgo, data & ia" />
        </TextField>

        <TextField value={form.telegramBotToken} onChange={(v) => set("telegramBotToken", v)}>
          <Label>{t("jobRadar.settings.telegramBotToken")}</Label>
          <Input placeholder="123456:ABC-..." />
        </TextField>

        <TextField value={form.telegramChatId} onChange={(v) => set("telegramChatId", v)}>
          <Label>{t("jobRadar.settings.telegramChatId")}</Label>
          <Input placeholder="123456789" />
        </TextField>

        <div className="flex items-center gap-3 md:col-span-2">
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
