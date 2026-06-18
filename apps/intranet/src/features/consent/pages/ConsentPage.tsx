import {
  Button,
  Card,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import type {
  ConsentChannel,
  ConsentPurpose,
  ConsentRecordDto,
  ConsentStatus,
} from "@finanzas/orpc-contracts/consent";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, UserCheck } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { Page } from "@/components/layouts/Page";
import { PageHeader } from "@/components/layouts/PageHeader";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { consentORPCClient, toConsentApiError } from "@/features/consent/orpc";
import { formatChile } from "@/lib/dates";
import { toast } from "@/lib/toast-interceptor";

const KEY = ["settings", "consent"] as const;

const PURPOSE_LABEL: Record<ConsentPurpose, string> = {
  MARKETING_EMAIL: "Marketing — Email",
  MARKETING_WHATSAPP: "Marketing — WhatsApp",
  MARKETING_SMS: "Marketing — SMS",
  DATA_PROCESSING_SECONDARY: "Uso secundario de datos",
  RESEARCH: "Investigación",
  DATA_SHARING: "Cesión a terceros",
};

const CHANNEL_LABEL: Record<ConsentChannel, string> = {
  WEB: "Web",
  PRESENCIAL: "Presencial",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  PHONE: "Teléfono",
  IMPORT: "Importación",
};

const STATUS_LABEL: Record<ConsentStatus, string> = {
  GRANTED: "Otorgado",
  WITHDRAWN: "Revocado",
};

const PURPOSE_ORDER: ConsentPurpose[] = [
  "MARKETING_EMAIL",
  "MARKETING_WHATSAPP",
  "MARKETING_SMS",
  "DATA_PROCESSING_SECONDARY",
  "RESEARCH",
  "DATA_SHARING",
];

const CHANNEL_ORDER: ConsentChannel[] = [
  "PRESENCIAL",
  "WEB",
  "EMAIL",
  "WHATSAPP",
  "PHONE",
  "IMPORT",
];

const EMPTY_FORM = {
  personId: "",
  purpose: "MARKETING_EMAIL" as ConsentPurpose,
  channel: "PRESENCIAL" as ConsentChannel,
  policyVersion: "v1",
  evidenceText: "",
  source: "",
};

export function ConsentPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      try {
        const res = await consentORPCClient.list({});
        return res.records;
      } catch (error) {
        throw toConsentApiError(error);
      }
    },
  });

  const [form, setForm] = useState({ ...EMPTY_FORM });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const record = useMutation({
    mutationFn: async () => {
      const personId = Number(form.personId);
      if (!Number.isInteger(personId) || personId < 1) throw new Error("ID de persona inválido");
      if (!form.policyVersion.trim()) throw new Error("Indica la versión de la política");
      try {
        return await consentORPCClient.record({
          personId,
          purpose: form.purpose,
          channel: form.channel,
          policyVersion: form.policyVersion.trim(),
          evidenceText: form.evidenceText.trim() || undefined,
          source: form.source.trim() || undefined,
        });
      } catch (error) {
        throw toConsentApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Consentimiento registrado");
      void invalidate();
      setForm({ ...EMPTY_FORM });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar"),
  });

  const withdraw = useMutation({
    mutationFn: async (id: string) => {
      try {
        return await consentORPCClient.withdraw({ id });
      } catch (error) {
        throw toConsentApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Consentimiento revocado");
      void invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo revocar"),
  });

  const onWithdraw = async (r: ConsentRecordDto) => {
    const ok = await confirmAction({
      title: "Revocar consentimiento",
      description: `¿Revocar el consentimiento de "${r.personName}" para ${PURPOSE_LABEL[r.purpose].toLowerCase()}? Quedará registrado con fecha de revocación.`,
      confirmLabel: "Revocar",
      variant: "danger",
    });
    if (ok) withdraw.mutate(r.id);
  };

  const columns: ColumnDef<ConsentRecordDto>[] = [
    {
      header: "Persona",
      accessorKey: "personName",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{row.original.personName}</span>
          {row.original.personEmail ? (
            <span className="text-default-500 text-xs">{row.original.personEmail}</span>
          ) : null}
        </div>
      ),
    },
    {
      header: "Propósito",
      accessorKey: "purpose",
      cell: ({ row }) => (
        <Chip size="sm" variant="soft">
          {PURPOSE_LABEL[row.original.purpose] ?? row.original.purpose}
        </Chip>
      ),
    },
    {
      header: "Estado",
      accessorKey: "status",
      cell: ({ row }) => (
        <Chip
          size="sm"
          variant="soft"
          color={row.original.status === "GRANTED" ? "success" : "default"}
        >
          {STATUS_LABEL[row.original.status] ?? row.original.status}
        </Chip>
      ),
    },
    {
      header: "Canal",
      accessorKey: "channel",
      cell: ({ row }) => (
        <span className="text-sm">
          {CHANNEL_LABEL[row.original.channel] ?? row.original.channel}
        </span>
      ),
    },
    {
      header: "Otorgado",
      accessorKey: "grantedAt",
      cell: ({ row }) => (
        <span className="text-sm">{formatChile(row.original.grantedAt, "DD/MM/YYYY")}</span>
      ),
    },
    {
      header: "Versión",
      accessorKey: "policyVersion",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.policyVersion}</span>,
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end">
          {row.original.status === "GRANTED" ? (
            <Button size="sm" variant="danger" onPress={() => void onWithdraw(row.original)}>
              Revocar
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Consentimientos"
        description="Registro probatorio del consentimiento para el tratamiento de datos personales (Ley 21.719): marketing, usos secundarios, investigación, cesión. Distinto del consentimiento informado clínico de un procedimiento."
        icon={<UserCheck size={22} />}
      />

      <Card className="mb-6 space-y-4 p-5">
        <h2 className="font-semibold text-base">Registrar consentimiento</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            value={form.personId}
            onChange={(v) => setForm((f) => ({ ...f, personId: v }))}
          >
            <Label>ID de persona</Label>
            <Input placeholder="123" inputMode="numeric" />
          </TextField>
          <div className="space-y-1">
            <Label className="font-medium text-sm">Propósito</Label>
            <Select
              aria-label="Propósito"
              selectedKey={form.purpose}
              onSelectionChange={(k) =>
                setForm((f) => ({ ...f, purpose: String(k) as ConsentPurpose }))
              }
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {PURPOSE_ORDER.map((p) => (
                    <ListBox.Item key={p} id={p} textValue={PURPOSE_LABEL[p]}>
                      {PURPOSE_LABEL[p]}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="font-medium text-sm">Canal</Label>
            <Select
              aria-label="Canal"
              selectedKey={form.channel}
              onSelectionChange={(k) =>
                setForm((f) => ({ ...f, channel: String(k) as ConsentChannel }))
              }
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
          <TextField
            value={form.policyVersion}
            onChange={(v) => setForm((f) => ({ ...f, policyVersion: v }))}
          >
            <Label>Versión de la política</Label>
            <Input placeholder="v1" />
          </TextField>
          <TextField value={form.source} onChange={(v) => setForm((f) => ({ ...f, source: v }))}>
            <Label>Origen (opcional)</Label>
            <Input placeholder="ej. formulario web" />
          </TextField>
        </div>
        <div className="space-y-1">
          <Label className="font-medium text-sm">Evidencia / texto consentido (opcional)</Label>
          <TextArea
            aria-label="Evidencia"
            fullWidth
            rows={3}
            placeholder="Snapshot del texto que el titular aceptó o cómo consta el consentimiento"
            value={form.evidenceText}
            onChange={(e) => setForm((f) => ({ ...f, evidenceText: e.target.value }))}
          />
        </div>
        <div className="flex justify-end">
          <Button className="gap-2" isPending={record.isPending} onPress={() => record.mutate()}>
            <Plus size={16} aria-hidden="true" />
            Registrar
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Cargando consentimientos" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          enablePagination={false}
          enableToolbar={false}
          noDataMessage="Sin consentimientos registrados."
        />
      )}
    </Page>
  );
}
