import {
  Alert,
  Button,
  Chip,
  EmptyState,
  Input,
  Label,
  ListBox,
  Modal,
  NumberField,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { toast } from "@/lib/toast-interceptor";
import { createOrder, createSubject, listOrders, occTestingKeys } from "../api";
import type {
  OccFinalResult,
  OccMandateType,
  OccOrder,
  OccOrderStatus,
  OccRegulatoryBasis,
  OccRequestSource,
  OccTestingReason,
} from "../schemas";
import { OrderWorkflow } from "./OrderWorkflow";

const EMPTY: OccOrder[] = [];

// ── Etiquetas (UI en español) ─────────────────────────────────────────
const REASON_LABEL: Record<OccTestingReason, string> = {
  PRE_EMPLEO: "Pre-empleo",
  PERIODICO: "Periódico",
  ALEATORIO: "Aleatorio",
  POST_ACCIDENTE: "Post-accidente",
  SOSPECHA_RAZONABLE: "Sospecha razonable",
  RETORNO: "Retorno",
  CONTROL_POLICIAL: "Control policial",
  OTRO: "Otro",
};

const REQUEST_SOURCE_LABEL: Record<OccRequestSource, string> = {
  ORDEN_MEDICA: "Orden médica",
  SOLICITUD_EMPLEADOR: "Solicitud empleador",
  ORDEN_JUDICIAL: "Orden judicial",
  SUPERVISOR_FAENA: "Supervisor de faena",
};

const REGULATORY_BASIS_LABEL: Record<OccRegulatoryBasis, string> = {
  DS_132_ART_40: "DS 132 Art. 40 (minería)",
  RIOHS: "RIOHS (reglamento interno)",
  LEY_18290: "Ley 18.290 (tránsito)",
  DS_44_PROGRAMA: "DS 44 (programa)",
  POLITICA_EMPRESA: "Política de empresa",
};

const MANDATE_TYPE_LABEL: Record<OccMandateType, string> = {
  MANDATED_BY_LAW: "Obligatorio por ley",
  PERMITTED_VIA_RIOHS: "Permitido vía RIOHS",
  COMPANY_POLICY: "Política de empresa",
};

const STATUS_LABEL: Record<OccOrderStatus, string> = {
  DRAFT: "Borrador",
  CONSENT_PENDING: "Consentimiento pendiente",
  COLLECTED: "Recolectada",
  IN_TRANSIT: "En tránsito",
  RECEIVED: "Recibida",
  SCREENING: "Tamizaje",
  PRESUMPTIVE_POSITIVE: "Presuntivo positivo",
  CONFIRMATION_PENDING: "Confirmación pendiente",
  MEDICAL_REVIEW: "Revisión médica",
  RESULTED: "Resultada",
  INVALID: "Inválida",
  CANCELLED: "Anulada",
};

// Resultado clínico = dato sensible. Colores NEUTROS — sin veredicto verde/rojo.
const FINAL_RESULT_LABEL: Record<OccFinalResult, string> = {
  PENDING: "Pendiente",
  NEGATIVE: "Negativo",
  POSITIVE: "Positivo",
  NEGATIVE_MEDICALLY_EXPLAINED: "Negativo (explicado médicamente)",
  INVALID: "Inválido",
};

const REASON_OPTIONS = (Object.keys(REASON_LABEL) as OccTestingReason[]).map((id) => ({
  id,
  label: REASON_LABEL[id],
}));
const REQUEST_SOURCE_OPTIONS = (Object.keys(REQUEST_SOURCE_LABEL) as OccRequestSource[]).map(
  (id) => ({ id, label: REQUEST_SOURCE_LABEL[id] })
);
const REGULATORY_BASIS_OPTIONS = (Object.keys(REGULATORY_BASIS_LABEL) as OccRegulatoryBasis[]).map(
  (id) => ({ id, label: REGULATORY_BASIS_LABEL[id] })
);
const MANDATE_TYPE_OPTIONS = (Object.keys(MANDATE_TYPE_LABEL) as OccMandateType[]).map((id) => ({
  id,
  label: MANDATE_TYPE_LABEL[id],
}));

type Props = {
  programId?: number;
};

/**
 * Órdenes de testeo INDIVIDUAL (stage-C). El sujeto es pseudónimo (código de
 * barras, NUNCA nombre/RUT). El resultado clínico se muestra con colores
 * neutros — un resultado médico no es un veredicto bueno/malo.
 */
export function OrdersManager({ programId }: Props) {
  const ordersQuery = useQuery({
    queryKey: occTestingKeys.orders(programId),
    queryFn: () => listOrders(programId),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [openOrderId, setOpenOrderId] = useState<number | undefined>(undefined);

  const orders = ordersQuery.data ?? EMPTY;

  const columns = useMemo<ColumnDef<OccOrder>[]>(
    () => [
      {
        id: "order",
        header: "Orden",
        cell: ({ row }) => <span className="font-medium">#{row.original.id}</span>,
      },
      {
        accessorKey: "testingReason",
        header: "Motivo",
        cell: ({ row }) => REASON_LABEL[row.original.testingReason],
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => (
          <Chip size="sm" variant="soft" color="default">
            {STATUS_LABEL[row.original.status]}
          </Chip>
        ),
      },
      {
        accessorKey: "finalResult",
        header: "Resultado",
        cell: ({ row }) => (
          // Color NEUTRO deliberado: un resultado clínico no se estiliza como
          // veredicto verde/rojo.
          <Chip size="sm" variant="secondary" color="default">
            {FINAL_RESULT_LABEL[row.original.finalResult]}
          </Chip>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" onPress={() => setOpenOrderId(row.original.id)}>
              Abrir
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <Alert status="default">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Resultado individual — compliance por diseño</Alert.Title>
          <Alert.Description>
            El sujeto es pseudónimo (código de barras, nunca nombre/RUT). Un presuntivo NO es un
            positivo — la confirmación GC-MS/LC-MS-MS es obligatoria. La divulgación de resultados
            individuales está gateada por consentimiento y la cadena de custodia es append-only (no
            se edita ni borra).
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button className="gap-2" onPress={() => setCreateOpen(true)}>
          <Plus size={16} aria-hidden="true" />
          Nueva orden
        </Button>
      </div>

      {!ordersQuery.isLoading && orders.length === 0 ? (
        <EmptyState>
          <div className="space-y-3 text-center">
            <p>Aún no hay órdenes de testeo individual.</p>
          </div>
        </EmptyState>
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          isLoading={ordersQuery.isLoading}
          enableToolbar={false}
          enableVirtualization={false}
          noDataMessage="Sin órdenes."
        />
      )}

      <CreateOrderModal
        isOpen={createOpen}
        onOpenChange={setCreateOpen}
        programId={programId}
        onCreated={(orderId) => setOpenOrderId(orderId)}
      />

      {openOrderId != null ? (
        <OrderWorkflow
          orderId={openOrderId}
          isOpen={openOrderId != null}
          onClose={() => setOpenOrderId(undefined)}
        />
      ) : null}
    </div>
  );
}

// ── Crear orden (sujeto picker-or-create + enums) ──────────────────────
function CreateOrderModal({
  isOpen,
  onOpenChange,
  programId,
  onCreated,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  programId?: number;
  onCreated: (orderId: number) => void;
}) {
  const queryClient = useQueryClient();

  // Sujeto: o se referencia uno existente por id, o se crea uno nuevo por código.
  const [subjectMode, setSubjectMode] = useState<"existing" | "new">("new");
  const [subjectId, setSubjectId] = useState<number>(0);
  const [subjectCode, setSubjectCode] = useState("");

  const [testingReason, setTestingReason] = useState<OccTestingReason>("PRE_EMPLEO");
  const [requestSource, setRequestSource] = useState<OccRequestSource>("SOLICITUD_EMPLEADOR");
  const [regulatoryBasis, setRegulatoryBasis] = useState<OccRegulatoryBasis>("RIOHS");
  const [mandateType, setMandateType] = useState<OccMandateType>("PERMITTED_VIA_RIOHS");
  const [riohsClauseRef, setRiohsClauseRef] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setSubjectMode("new");
    setSubjectId(0);
    setSubjectCode("");
    setTestingReason("PRE_EMPLEO");
    setRequestSource("SOLICITUD_EMPLEADOR");
    setRegulatoryBasis("RIOHS");
    setMandateType("PERMITTED_VIA_RIOHS");
    setRiohsClauseRef("");
    setNotes("");
  }

  const create = useMutation({
    mutationFn: async () => {
      let resolvedSubjectId = subjectId;
      if (subjectMode === "new") {
        if (!subjectCode.trim()) throw new Error("Indica el código del sujeto (código de barras)");
        const subject = await createSubject({ subjectCode: subjectCode.trim() });
        resolvedSubjectId = subject.id;
      } else if (!resolvedSubjectId || resolvedSubjectId < 1) {
        throw new Error("Indica el ID del sujeto existente");
      }
      return createOrder({
        subjectId: resolvedSubjectId,
        programId: programId ?? null,
        testingReason,
        requestSource,
        regulatoryBasis,
        mandateType,
        riohsClauseRef: riohsClauseRef.trim() || null,
        notes: notes.trim() || null,
      });
    },
    onSuccess: (order) => {
      toast.success(`Orden #${order.id} creada`);
      void queryClient.invalidateQueries({ queryKey: occTestingKeys.orders(programId) });
      reset();
      onOpenChange(false);
      onCreated(order.id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo crear la orden"),
  });

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg">
        <Modal.Dialog aria-label="Nueva orden de testeo individual">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Nueva orden</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="space-y-4">
              <Alert status="default">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>
                    El sujeto es pseudónimo: usa un código de barras, NO el nombre/RUT del
                    trabajador. La vinculación a identidad real requiere consentimiento
                    (IDENTITY_LINK).
                  </Alert.Description>
                </Alert.Content>
              </Alert>

              <div className="space-y-1">
                <Label className="font-medium text-sm">Sujeto</Label>
                <Select
                  aria-label="Modo de sujeto"
                  selectedKey={subjectMode}
                  onSelectionChange={(k) => setSubjectMode(String(k) as "existing" | "new")}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="new" textValue="Crear nuevo sujeto">
                        Crear nuevo sujeto
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="existing" textValue="Usar sujeto existente">
                        Usar sujeto existente
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              {subjectMode === "new" ? (
                <TextField value={subjectCode} onChange={setSubjectCode}>
                  <Label>Código del sujeto (código de barras)</Label>
                  <Input placeholder="ej. SUJ-2026-00123" />
                </TextField>
              ) : (
                <NumberField
                  variant="secondary"
                  minValue={1}
                  value={subjectId || undefined}
                  onChange={(v) => setSubjectId(v ?? 0)}
                >
                  <Label>ID del sujeto existente</Label>
                  <NumberField.Group className="grid-cols-1">
                    <NumberField.Input />
                  </NumberField.Group>
                </NumberField>
              )}

              <div className="space-y-1">
                <Label className="font-medium text-sm">Motivo del testeo</Label>
                <Select
                  aria-label="Motivo del testeo"
                  selectedKey={testingReason}
                  onSelectionChange={(k) => setTestingReason(String(k) as OccTestingReason)}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {REASON_OPTIONS.map((opt) => (
                        <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                          {opt.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-medium text-sm">Origen de la solicitud</Label>
                <Select
                  aria-label="Origen de la solicitud"
                  selectedKey={requestSource}
                  onSelectionChange={(k) => setRequestSource(String(k) as OccRequestSource)}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {REQUEST_SOURCE_OPTIONS.map((opt) => (
                        <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                          {opt.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-medium text-sm">Base regulatoria</Label>
                <Select
                  aria-label="Base regulatoria"
                  selectedKey={regulatoryBasis}
                  onSelectionChange={(k) => setRegulatoryBasis(String(k) as OccRegulatoryBasis)}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {REGULATORY_BASIS_OPTIONS.map((opt) => (
                        <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                          {opt.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-medium text-sm">Tipo de mandato</Label>
                <Select
                  aria-label="Tipo de mandato"
                  selectedKey={mandateType}
                  onSelectionChange={(k) => setMandateType(String(k) as OccMandateType)}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {MANDATE_TYPE_OPTIONS.map((opt) => (
                        <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                          {opt.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <TextField value={riohsClauseRef} onChange={setRiohsClauseRef}>
                <Label>Cláusula RIOHS (opcional)</Label>
                <TextArea rows={2} placeholder="ej. Art. 27 letra c) del RIOHS vigente…" />
              </TextField>

              <TextField value={notes} onChange={setNotes}>
                <Label>Notas (opcional)</Label>
                <TextArea rows={2} placeholder="Notas internas…" />
              </TextField>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancelar
            </Button>
            <Button isPending={create.isPending} onPress={() => create.mutate()}>
              Crear orden
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
