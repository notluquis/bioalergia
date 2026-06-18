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
  ClinicalConsentDecision,
  ClinicalConsentDto,
  ClinicalConsentProcedure,
  ClinicalConsentSignature,
  ClinicalConsentStatus,
} from "@finanzas/orpc-contracts/clinical-consent";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardCheck, Plus } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { Page } from "@/components/layouts/Page";
import { PageHeader } from "@/components/layouts/PageHeader";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  clinicalConsentORPCClient,
  toClinicalConsentApiError,
} from "@/features/clinical-consent/orpc";
import { formatChile } from "@/lib/dates";
import { toast } from "@/lib/toast-interceptor";

const KEY = ["settings", "clinical-consent"] as const;

const PROCEDURE_LABEL: Record<ClinicalConsentProcedure, string> = {
  SCIT: "Inmunoterapia subcutánea (SCIT)",
  SKIN_TEST: "Test cutáneo (prick)",
  PATCH_TEST: "Test de parche",
  PROCEDURE: "Procedimiento",
  OTHER: "Otro",
};

const SIGNATURE_LABEL: Record<ClinicalConsentSignature, string> = {
  PRESENCIAL_FISICA: "Presencial (firma física)",
  ELECTRONICA_SIMPLE: "Electrónica simple",
  VERBAL_REGISTRADA: "Verbal registrada",
};

const STATUS_LABEL: Record<ClinicalConsentStatus, string> = {
  PENDING: "Pendiente",
  SIGNED: "Firmado",
  REFUSED: "Rechazado",
  REVOKED: "Revocado",
};

const STATUS_COLOR: Record<ClinicalConsentStatus, "default" | "warning" | "success" | "danger"> = {
  PENDING: "warning",
  SIGNED: "success",
  REFUSED: "danger",
  REVOKED: "default",
};

const PROCEDURE_ORDER: ClinicalConsentProcedure[] = [
  "SCIT",
  "SKIN_TEST",
  "PATCH_TEST",
  "PROCEDURE",
  "OTHER",
];

const SIGNATURE_ORDER: ClinicalConsentSignature[] = [
  "PRESENCIAL_FISICA",
  "ELECTRONICA_SIMPLE",
  "VERBAL_REGISTRADA",
];

const DECISION_LABEL: Record<ClinicalConsentDecision, string> = {
  SIGNED: "Firmar",
  REFUSED: "Rechazar",
  REVOKED: "Revocar",
};

const EMPTY_FORM = {
  patientId: "",
  procedureType: "SCIT" as ClinicalConsentProcedure,
  procedureName: "",
  templateVersion: "v1",
  contentSnapshot: "",
  risksDisclosed: "",
  alternativesDisclosed: "",
  signatureMethod: "PRESENCIAL_FISICA" as ClinicalConsentSignature,
  signerName: "",
  signerRut: "",
  signerRelationship: "paciente",
};

export function ClinicalConsentPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      try {
        const res = await clinicalConsentORPCClient.list({});
        return res.consents;
      } catch (error) {
        throw toClinicalConsentApiError(error);
      }
    },
  });

  const [form, setForm] = useState({ ...EMPTY_FORM });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: async () => {
      const patientId = Number(form.patientId);
      if (!Number.isInteger(patientId) || patientId < 1) throw new Error("ID de paciente inválido");
      if (!form.procedureName.trim()) throw new Error("Indica el procedimiento");
      if (!form.contentSnapshot.trim()) throw new Error("Indica el contenido del consentimiento");
      if (!form.signerName.trim()) throw new Error("Indica quién firma");
      try {
        return await clinicalConsentORPCClient.create({
          patientId,
          procedureType: form.procedureType,
          procedureName: form.procedureName.trim(),
          templateVersion: form.templateVersion.trim() || "v1",
          contentSnapshot: form.contentSnapshot.trim(),
          risksDisclosed: form.risksDisclosed.trim() || undefined,
          alternativesDisclosed: form.alternativesDisclosed.trim() || undefined,
          signatureMethod: form.signatureMethod,
          signerName: form.signerName.trim(),
          signerRut: form.signerRut.trim() || undefined,
          signerRelationship: form.signerRelationship.trim() || undefined,
        });
      } catch (error) {
        throw toClinicalConsentApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Consentimiento registrado");
      void invalidate();
      setForm({ ...EMPTY_FORM });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar"),
  });

  const decide = useMutation({
    mutationFn: async (vars: {
      id: string;
      status: ClinicalConsentDecision;
      refusedReason?: string;
    }) => {
      try {
        return await clinicalConsentORPCClient.decide(vars);
      } catch (error) {
        throw toClinicalConsentApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Consentimiento actualizado");
      void invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar"),
  });

  const onDecide = async (c: ClinicalConsentDto, decision: ClinicalConsentDecision) => {
    const ok = await confirmAction({
      title: `${DECISION_LABEL[decision]} consentimiento`,
      description: `¿${DECISION_LABEL[decision]} el consentimiento de "${c.patientName}" para ${PROCEDURE_LABEL[c.procedureType].toLowerCase()}?`,
      confirmLabel: DECISION_LABEL[decision],
      variant: decision === "SIGNED" ? "default" : "danger",
    });
    if (ok) decide.mutate({ id: c.id, status: decision });
  };

  const columns: ColumnDef<ClinicalConsentDto>[] = [
    {
      header: "Paciente",
      accessorKey: "patientName",
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.patientName}</span>,
    },
    {
      header: "Procedimiento",
      accessorKey: "procedureName",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm">{row.original.procedureName}</span>
          <span className="text-default-400 text-xs">
            {PROCEDURE_LABEL[row.original.procedureType] ?? row.original.procedureType}
          </span>
        </div>
      ),
    },
    {
      header: "Estado",
      accessorKey: "status",
      cell: ({ row }) => (
        <Chip size="sm" variant="soft" color={STATUS_COLOR[row.original.status]}>
          {STATUS_LABEL[row.original.status] ?? row.original.status}
        </Chip>
      ),
    },
    {
      header: "Firma",
      accessorKey: "signatureMethod",
      cell: ({ row }) => (
        <span className="text-default-500 text-xs">
          {SIGNATURE_LABEL[row.original.signatureMethod] ?? row.original.signatureMethod}
        </span>
      ),
    },
    {
      header: "Registrado",
      accessorKey: "createdAt",
      cell: ({ row }) => (
        <span className="text-sm">{formatChile(row.original.createdAt, "DD/MM/YYYY")}</span>
      ),
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex justify-end gap-1">
            {c.status === "PENDING" ? (
              <>
                <Button size="sm" variant="ghost" onPress={() => void onDecide(c, "SIGNED")}>
                  Firmar
                </Button>
                <Button size="sm" variant="ghost" onPress={() => void onDecide(c, "REFUSED")}>
                  Rechazar
                </Button>
              </>
            ) : null}
            {c.status === "SIGNED" ? (
              <Button size="sm" variant="danger" onPress={() => void onDecide(c, "REVOKED")}>
                Revocar
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Consentimiento informado clínico"
        description="Consentimiento por procedimiento (Ley 20.584): riesgos, alternativas y decisión del titular. El texto genérico no basta — se guarda el contenido concreto y su versión. Distinto del consentimiento de datos personales."
        icon={<ClipboardCheck size={22} />}
      />

      <Card className="mb-6 space-y-4 p-5">
        <h2 className="font-semibold text-base">Registrar consentimiento</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            value={form.patientId}
            onChange={(v) => setForm((f) => ({ ...f, patientId: v }))}
          >
            <Label>ID de paciente</Label>
            <Input placeholder="123" inputMode="numeric" />
          </TextField>
          <div className="space-y-1">
            <Label className="font-medium text-sm">Procedimiento</Label>
            <Select
              aria-label="Procedimiento"
              selectedKey={form.procedureType}
              onSelectionChange={(k) =>
                setForm((f) => ({ ...f, procedureType: String(k) as ClinicalConsentProcedure }))
              }
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {PROCEDURE_ORDER.map((p) => (
                    <ListBox.Item key={p} id={p} textValue={PROCEDURE_LABEL[p]}>
                      {PROCEDURE_LABEL[p]}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <TextField
            value={form.procedureName}
            onChange={(v) => setForm((f) => ({ ...f, procedureName: v }))}
          >
            <Label>Nombre del procedimiento</Label>
            <Input placeholder="ej. Inmunoterapia subcutánea ácaros" />
          </TextField>
          <div className="space-y-1">
            <Label className="font-medium text-sm">Método de firma</Label>
            <Select
              aria-label="Método de firma"
              selectedKey={form.signatureMethod}
              onSelectionChange={(k) =>
                setForm((f) => ({ ...f, signatureMethod: String(k) as ClinicalConsentSignature }))
              }
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {SIGNATURE_ORDER.map((s) => (
                    <ListBox.Item key={s} id={s} textValue={SIGNATURE_LABEL[s]}>
                      {SIGNATURE_LABEL[s]}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <TextField
            value={form.signerName}
            onChange={(v) => setForm((f) => ({ ...f, signerName: v }))}
          >
            <Label>Firmante</Label>
            <Input placeholder="Nombre de quien firma" />
          </TextField>
          <TextField
            value={form.signerRut}
            onChange={(v) => setForm((f) => ({ ...f, signerRut: v }))}
          >
            <Label>RUT firmante (opcional)</Label>
            <Input placeholder="12.345.678-9" />
          </TextField>
          <TextField
            value={form.signerRelationship}
            onChange={(v) => setForm((f) => ({ ...f, signerRelationship: v }))}
          >
            <Label>Relación</Label>
            <Input placeholder="paciente / representante legal" />
          </TextField>
          <TextField
            value={form.templateVersion}
            onChange={(v) => setForm((f) => ({ ...f, templateVersion: v }))}
          >
            <Label>Versión de plantilla</Label>
            <Input placeholder="v1" />
          </TextField>
        </div>
        <div className="space-y-1">
          <Label className="font-medium text-sm">
            Contenido consentido (procedimiento concreto)
          </Label>
          <TextArea
            aria-label="Contenido"
            fullWidth
            rows={3}
            placeholder="Texto concreto presentado al paciente (procedimiento, qué implica, contraindicaciones)…"
            value={form.contentSnapshot}
            onChange={(e) => setForm((f) => ({ ...f, contentSnapshot: e.target.value }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="font-medium text-sm">Riesgos informados (opcional)</Label>
            <TextArea
              aria-label="Riesgos"
              fullWidth
              rows={2}
              value={form.risksDisclosed}
              onChange={(e) => setForm((f) => ({ ...f, risksDisclosed: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="font-medium text-sm">Alternativas informadas (opcional)</Label>
            <TextArea
              aria-label="Alternativas"
              fullWidth
              rows={2}
              value={form.alternativesDisclosed}
              onChange={(e) => setForm((f) => ({ ...f, alternativesDisclosed: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button className="gap-2" isPending={create.isPending} onPress={() => create.mutate()}>
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
          noDataMessage="Sin consentimientos clínicos registrados."
        />
      )}
    </Page>
  );
}
