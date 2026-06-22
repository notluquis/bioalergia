import { Button, Card, Chip, Label, ListBox, Select } from "@heroui/react";
import type { ReminderChannelDto, ReminderDto } from "@finanzas/orpc-contracts/adherence";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { BellRing, CalendarClock, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { AppDateTimePicker } from "@/components/forms/AppDatePicker";
import { DataTable } from "@/components/data-table/DataTable";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  adherenceKeys,
  cancelReminder,
  listReminders,
  scheduleVisitReminders,
} from "@/features/adherence-reminders/api";
import { consentORPCClient, toConsentApiError } from "@/features/consent/orpc";
import { formatChile } from "@/lib/dates";
import { toast } from "@/lib/toast-interceptor";

const CHANNEL_LABEL: Record<ReminderChannelDto, string> = {
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
};

const CHANNEL_ORDER: ReminderChannelDto[] = ["EMAIL", "WHATSAPP"];

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  SENT: "Enviado",
  CANCELLED: "Cancelado",
  FAILED: "Fallido",
};

const STATUS_COLOR: Record<string, "success" | "warning" | "danger" | "default"> = {
  PENDING: "warning",
  SENT: "success",
  CANCELLED: "default",
  FAILED: "danger",
};

const CONSENT_KEY = (personId: number) => ["adherence", "consent", personId] as const;

interface Props {
  patientId: number;
  personId: number;
}

export function AdherencePanel({ patientId, personId }: Props) {
  const queryClient = useQueryClient();
  const [visitAt, setVisitAt] = useState<string>("");
  const [channel, setChannel] = useState<ReminderChannelDto>("EMAIL");

  // ── Consent gate ────────────────────────────────────────────────────
  const consentQuery = useQuery({
    queryKey: CONSENT_KEY(personId),
    queryFn: async () => {
      try {
        const res = await consentORPCClient.list({
          personId,
          purpose: "ADHERENCE_REMINDER",
          status: "GRANTED",
        });
        return res.records;
      } catch (error) {
        throw toConsentApiError(error);
      }
    },
  });
  const hasConsent = (consentQuery.data?.length ?? 0) > 0;

  const recordConsent = useMutation({
    mutationFn: async () => {
      try {
        return await consentORPCClient.record({
          personId,
          purpose: "ADHERENCE_REMINDER",
          channel: "PRESENCIAL",
          policyVersion: "1.0",
        });
      } catch (error) {
        throw toConsentApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Consentimiento registrado");
      void queryClient.invalidateQueries({ queryKey: CONSENT_KEY(personId) });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar"),
  });

  // ── Reminders ───────────────────────────────────────────────────────
  const remindersQuery = useQuery({
    queryKey: adherenceKeys.list(patientId),
    queryFn: () => listReminders(patientId),
  });

  const invalidateReminders = () =>
    queryClient.invalidateQueries({ queryKey: adherenceKeys.list(patientId) });

  const schedule = useMutation({
    mutationFn: async () => {
      if (!visitAt) throw new Error("Selecciona la fecha y hora de la próxima visita");
      const date = new Date(visitAt);
      if (Number.isNaN(date.getTime())) throw new Error("Fecha inválida");
      return scheduleVisitReminders({ patientId, visitAt: date, channel });
    },
    onSuccess: (reminders) => {
      toast.success(`Recordatorios programados (${reminders.length})`);
      setVisitAt("");
      void invalidateReminders();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "No se pudieron programar los recordatorios"),
  });

  const cancel = useMutation({
    mutationFn: (id: number) => cancelReminder(id),
    onSuccess: () => {
      toast.success("Recordatorio cancelado");
      void invalidateReminders();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo cancelar"),
  });

  const onCancel = async (r: ReminderDto) => {
    const ok = await confirmAction({
      title: "Cancelar recordatorio",
      description: `¿Cancelar el recordatorio "${r.title}" programado para ${formatChile(r.runAt, "DD/MM/YYYY HH:mm")}?`,
      confirmLabel: "Cancelar recordatorio",
      variant: "danger",
    });
    if (ok) cancel.mutate(r.id);
  };

  const columns: ColumnDef<ReminderDto>[] = [
    {
      header: "Recordatorio",
      accessorKey: "title",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{row.original.title}</span>
          <span className="text-default-500 text-xs">{row.original.subjectType}</span>
        </div>
      ),
    },
    {
      header: "Canal",
      accessorKey: "channel",
      cell: ({ row }) => (
        <Chip size="sm" variant="soft">
          {CHANNEL_LABEL[row.original.channel] ?? row.original.channel}
        </Chip>
      ),
    },
    {
      header: "Programado",
      accessorKey: "runAt",
      cell: ({ row }) => (
        <span className="text-sm">{formatChile(row.original.runAt, "DD/MM/YYYY HH:mm")}</span>
      ),
    },
    {
      header: "Estado",
      accessorKey: "status",
      cell: ({ row }) => (
        <Chip size="sm" variant="soft" color={STATUS_COLOR[row.original.status] ?? "default"}>
          {STATUS_LABEL[row.original.status] ?? row.original.status}
        </Chip>
      ),
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end">
          {row.original.status === "PENDING" ? (
            <Button size="sm" variant="danger" onPress={() => void onCancel(row.original)}>
              Cancelar
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Consent gate banner */}
      {consentQuery.isLoading ? (
        <Card className="p-4">
          <LoadingSpinner label="Verificando consentimiento" />
        </Card>
      ) : hasConsent ? (
        <div className="flex">
          <Chip size="sm" variant="soft" color="success" className="gap-1">
            <ShieldCheck size={14} aria-hidden="true" />
            Consentimiento vigente
          </Chip>
        </div>
      ) : (
        <Card className="border-warning-200 bg-warning-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldAlert size={20} className="mt-0.5 text-warning-600" aria-hidden="true" />
              <div>
                <p className="font-medium text-sm text-warning-800">
                  Sin consentimiento de recordatorios — no se enviarán
                </p>
                <p className="text-warning-700 text-xs">
                  Registra el consentimiento del paciente (Ley 21.719) para habilitar el envío de
                  recordatorios de adherencia.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="gap-2"
              isPending={recordConsent.isPending}
              onPress={() => recordConsent.mutate()}
            >
              <ShieldCheck size={16} aria-hidden="true" />
              Registrar consentimiento
            </Button>
          </div>
        </Card>
      )}

      {/* Schedule form */}
      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <CalendarClock size={18} aria-hidden="true" className="text-default-500" />
          <h3 className="font-semibold text-base">Programar recordatorios de visita</h3>
        </div>
        <p className="text-default-500 text-sm">
          Genera recordatorios automáticos para 7 y 1 día antes de la próxima visita SCIT/SLIT.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <AppDateTimePicker label="Próxima visita" value={visitAt} onChange={setVisitAt} />
          <div className="space-y-1">
            <Label className="font-medium text-sm">Canal</Label>
            <Select
              aria-label="Canal"
              selectedKey={channel}
              onSelectionChange={(k) => setChannel(String(k) as ReminderChannelDto)}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {CHANNEL_ORDER.map((c) => (
                    <ListBox.Item key={c} id={c} textValue={CHANNEL_LABEL[c]}>
                      {CHANNEL_LABEL[c]}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            className="gap-2"
            isDisabled={!visitAt}
            isPending={schedule.isPending}
            onPress={() => schedule.mutate()}
          >
            <BellRing size={16} aria-hidden="true" />
            Programar recordatorios (T-7 y T-1)
          </Button>
        </div>
      </Card>

      {/* Reminders list */}
      {remindersQuery.isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Cargando recordatorios" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={remindersQuery.data ?? []}
          enablePagination={false}
          enableToolbar={false}
          noDataMessage="No hay recordatorios programados para este paciente."
        />
      )}
    </div>
  );
}
