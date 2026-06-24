import {
  Alert,
  Button,
  Card,
  Chip,
  Drawer,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  Spinner,
  Switch,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { formatChile } from "@/lib/dates";
import { toast } from "@/lib/toast-interceptor";
import {
  addCustodyEvent,
  addSample,
  discloseToEmployer,
  getOrder,
  occTestingKeys,
  recordConfirmatory,
  recordConsent,
  recordMedicalReview,
  recordScreening,
  revokeConsent,
} from "../api";
import type {
  OccCustodyAction,
  OccCustodyEvent,
  OccMatrix,
  OccOrderStatus,
  OccSample,
  OccSampleKind,
} from "../schemas";

// ── Etiquetas ─────────────────────────────────────────────────────────
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

const CUSTODY_ACTION_LABEL: Record<OccCustodyAction, string> = {
  COLLECT: "Recolección",
  SPLIT: "División (muestra/contramuestra)",
  SEAL: "Sellado",
  DONOR_VERIFY: "Verificación del donante",
  HANDOFF: "Entrega",
  TRANSPORT: "Transporte",
  RECEIVE: "Recepción",
  SEAL_CHECK: "Verificación de sello",
  ALIQUOT: "Alícuota",
  STORE: "Almacenamiento",
  DESTROY: "Destrucción",
};

const MATRIX_LABEL: Record<OccMatrix, string> = {
  ORINA: "Orina",
  SANGRE: "Sangre",
  SALIVA: "Saliva",
  ALIENTO: "Aliento",
};

const SAMPLE_KIND_LABEL: Record<OccSampleKind, string> = {
  MUESTRA: "Muestra",
  CONTRAMUESTRA: "Contramuestra",
};

const CONSENT_PURPOSE_OPTIONS = [
  { id: "TEST", label: "Realizar el test (TEST)" },
  { id: "EMPLOYER_DISCLOSURE", label: "Divulgación al empleador (EMPLOYER_DISCLOSURE)" },
  {
    id: "SUBSTANCE_LEVEL_DISCLOSURE",
    label: "Divulgar nivel/sustancia (SUBSTANCE_LEVEL_DISCLOSURE)",
  },
  { id: "IDENTITY_LINK", label: "Vincular a identidad real (IDENTITY_LINK)" },
] as const;

const CUSTODY_ACTION_OPTIONS = (Object.keys(CUSTODY_ACTION_LABEL) as OccCustodyAction[]).map(
  (id) => ({ id, label: CUSTODY_ACTION_LABEL[id] })
);
const MATRIX_OPTIONS = (Object.keys(MATRIX_LABEL) as OccMatrix[]).map((id) => ({
  id,
  label: MATRIX_LABEL[id],
}));

type Props = {
  orderId: number;
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Driver del workflow de la orden (state-machine). Muestra el estado, una línea
 * de tiempo de cadena de custodia (append-only) y paneles por etapa gateados por
 * status. Los hard gates legales viven en el servidor — aquí surfaceamos sus
 * mensajes (DomainError).
 */
export function OrderWorkflow({ orderId, isOpen, onClose }: Props) {
  const detailQuery = useQuery({
    queryKey: occTestingKeys.order(orderId),
    queryFn: () => getOrder(orderId),
  });

  const detail = detailQuery.data;
  const order = detail?.order;
  const samples = detail?.samples ?? [];
  const custodyEvents = detail?.custodyEvents ?? [];

  return (
    <Drawer>
      <Drawer.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()} variant="blur">
        <Drawer.Content className="p-0 sm:p-3" placement="right">
          <Drawer.Dialog className="flex h-full max-h-dvh w-[min(96vw,820px)] max-w-none flex-col overflow-hidden rounded-l-lg border border-default-200 bg-background shadow-2xl sm:rounded-lg">
            <Drawer.CloseTrigger />
            <Drawer.Header className="border-default-200/70 border-b">
              <div className="space-y-2">
                <Drawer.Heading className="text-lg leading-snug">Orden #{orderId}</Drawer.Heading>
                {order ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip size="sm" variant="soft" color="default">
                      {STATUS_LABEL[order.status]}
                    </Chip>
                    <span className="text-default-500 text-sm">
                      Sujeto: {detail?.subject.subjectCode}
                    </span>
                  </div>
                ) : null}
              </div>
            </Drawer.Header>

            <Drawer.Body className="space-y-6">
              {detailQuery.isLoading ? (
                <div className="flex justify-center py-10">
                  <Spinner aria-label="Cargando orden" />
                </div>
              ) : order && detail ? (
                <>
                  <Alert status="default">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>Contexto legal</Alert.Title>
                      <Alert.Description>
                        El sujeto es pseudónimo (no nombre/RUT). Un presuntivo NO es positivo: la
                        confirmación GC-MS/LC-MS-MS es obligatoria. La divulgación individual está
                        gateada por consentimiento. La cadena de custodia es append-only — los
                        eventos no se editan ni se borran.
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>

                  <ConsentsPanel orderId={orderId} />

                  <SamplesPanel orderId={orderId} samples={samples} />

                  <CustodyPanel orderId={orderId} samples={samples} events={custodyEvents} />

                  <ScreeningPanel orderId={orderId} status={order.status} />

                  {order.status === "PRESUMPTIVE_POSITIVE" ||
                  order.status === "CONFIRMATION_PENDING" ? (
                    <ConfirmatoryPanel orderId={orderId} samples={samples} />
                  ) : null}

                  {order.finalResult === "POSITIVE" || order.status === "MEDICAL_REVIEW" ? (
                    <MedicalReviewPanel orderId={orderId} />
                  ) : null}

                  <DisclosurePanel orderId={orderId} />
                </>
              ) : (
                <p className="text-default-500 text-sm">No se pudo cargar la orden.</p>
              )}
            </Drawer.Body>

            <Drawer.Footer className="border-default-200/70 border-t">
              <Button variant="secondary" onPress={onClose}>
                Cerrar
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

// ── Consentimientos ───────────────────────────────────────────────────
function ConsentsPanel({ orderId }: { orderId: number }) {
  const queryClient = useQueryClient();
  const [purpose, setPurpose] = useState<(typeof CONSENT_PURPOSE_OPTIONS)[number]["id"]>("TEST");
  const [granted, setGranted] = useState(true);
  const [evidenceRef, setEvidenceRef] = useState("");
  const [revokeId, setRevokeId] = useState<number>(0);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: occTestingKeys.order(orderId) });
  }

  const record = useMutation({
    mutationFn: () =>
      recordConsent({
        orderId,
        purpose,
        granted,
        evidenceRef: evidenceRef.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Consentimiento registrado");
      setEvidenceRef("");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "No se pudo registrar el consentimiento"),
  });

  const revoke = useMutation({
    mutationFn: (consentId: number) => revokeConsent(consentId),
    onSuccess: () => {
      toast.success("Consentimiento revocado");
      setRevokeId(0);
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "No se pudo revocar el consentimiento"),
  });

  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-semibold text-base">Consentimientos</h3>
      <p className="text-default-500 text-sm">
        Registra el consentimiento informado por propósito. La divulgación al empleador y la
        vinculación a identidad real exigen consentimiento vigente.
      </p>

      <div className="space-y-1">
        <Label className="font-medium text-sm">Propósito</Label>
        <Select
          aria-label="Propósito del consentimiento"
          selectedKey={purpose}
          onSelectionChange={(k) =>
            setPurpose(String(k) as (typeof CONSENT_PURPOSE_OPTIONS)[number]["id"])
          }
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {CONSENT_PURPOSE_OPTIONS.map((opt) => (
                <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                  {opt.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <Switch isSelected={granted} onChange={setGranted}>
        Otorgado
      </Switch>

      <TextField value={evidenceRef} onChange={setEvidenceRef}>
        <Label>Referencia de evidencia (opcional)</Label>
        <Input placeholder="ej. URL/folio del documento firmado" />
      </TextField>

      <div className="flex justify-end">
        <Button size="sm" isPending={record.isPending} onPress={() => record.mutate()}>
          Registrar consentimiento
        </Button>
      </div>

      <div className="border-default-200 border-t pt-4">
        <Label className="font-medium text-sm">Revocar consentimiento</Label>
        <div className="mt-1 flex items-end gap-2">
          <NumberField
            variant="secondary"
            minValue={1}
            value={revokeId || undefined}
            onChange={(v) => setRevokeId(v ?? 0)}
            className="flex-1"
          >
            <Label>ID de consentimiento</Label>
            <NumberField.Group className="grid-cols-1">
              <NumberField.Input />
            </NumberField.Group>
          </NumberField>
          <Button
            size="sm"
            variant="secondary"
            isPending={revoke.isPending}
            isDisabled={!revokeId || revokeId < 1}
            onPress={async () => {
              const ok = await confirmAction({
                title: "Revocar consentimiento",
                description: `¿Revocar el consentimiento #${revokeId}? Esto puede bloquear divulgaciones futuras.`,
                variant: "danger",
                confirmLabel: "Revocar",
              });
              if (ok) revoke.mutate(revokeId);
            }}
          >
            Revocar
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Muestras ──────────────────────────────────────────────────────────
function SamplesPanel({ orderId, samples }: { orderId: number; samples: OccSample[] }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<OccSampleKind>("MUESTRA");
  const [containerCode, setContainerCode] = useState("");
  const [matrix, setMatrix] = useState<OccMatrix>("ORINA");
  const [sealId, setSealId] = useState("");

  const add = useMutation({
    mutationFn: () => {
      if (!containerCode.trim()) throw new Error("Indica el código del contenedor");
      return addSample({
        orderId,
        kind,
        containerCode: containerCode.trim(),
        matrix,
        sealId: sealId.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Muestra agregada");
      setContainerCode("");
      setSealId("");
      void queryClient.invalidateQueries({ queryKey: occTestingKeys.order(orderId) });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo agregar la muestra"),
  });

  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-semibold text-base">Muestras</h3>

      {samples.length > 0 ? (
        <ul className="space-y-2">
          {samples.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-default-200 px-3 py-2 text-sm"
            >
              <Chip size="sm" variant="soft" color="default">
                {SAMPLE_KIND_LABEL[s.kind]}
              </Chip>
              <span className="font-medium">{s.containerCode}</span>
              <span className="text-default-500">{MATRIX_LABEL[s.matrix]}</span>
              {s.sealId ? <span className="text-default-500">Sello: {s.sealId}</span> : null}
              <span className="ml-auto text-default-400 text-xs">#{s.id}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-default-500 text-sm">Aún no hay muestras registradas.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="font-medium text-sm">Tipo</Label>
          <Select
            aria-label="Tipo de muestra"
            selectedKey={kind}
            onSelectionChange={(k) => setKind(String(k) as OccSampleKind)}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="MUESTRA" textValue="Muestra">
                  Muestra
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="CONTRAMUESTRA" textValue="Contramuestra">
                  Contramuestra
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="font-medium text-sm">Matriz</Label>
          <Select
            aria-label="Matriz"
            selectedKey={matrix}
            onSelectionChange={(k) => setMatrix(String(k) as OccMatrix)}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {MATRIX_OPTIONS.map((opt) => (
                  <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                    {opt.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <TextField value={containerCode} onChange={setContainerCode}>
          <Label>Código del contenedor</Label>
          <Input placeholder="ej. CONT-0001" />
        </TextField>

        <TextField value={sealId} onChange={setSealId}>
          <Label>ID de sello (opcional)</Label>
          <Input placeholder="ej. SELLO-0001" />
        </TextField>
      </div>

      <div className="flex justify-end">
        <Button size="sm" isPending={add.isPending} onPress={() => add.mutate()}>
          Agregar muestra
        </Button>
      </div>
    </Card>
  );
}

// ── Cadena de custodia (append-only) ──────────────────────────────────
function CustodyPanel({
  orderId,
  samples,
  events,
}: {
  orderId: number;
  samples: OccSample[];
  events: OccCustodyEvent[];
}) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<OccCustodyAction>("COLLECT");
  const [sampleId, setSampleId] = useState<string>("none");
  const [sealIntact, setSealIntact] = useState(true);
  const [signatureRef, setSignatureRef] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const timeline = useMemo(
    () => [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()),
    [events]
  );

  const add = useMutation({
    mutationFn: () =>
      addCustodyEvent({
        orderId,
        sampleId: sampleId === "none" ? null : Number(sampleId),
        action,
        sealIntact,
        signatureRef: signatureRef.trim() || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Evento de custodia registrado");
      setSignatureRef("");
      setLocation("");
      setNotes("");
      void queryClient.invalidateQueries({ queryKey: occTestingKeys.order(orderId) });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar el evento"),
  });

  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-semibold text-base">Cadena de custodia</h3>
      <p className="text-default-500 text-sm">
        Registro append-only. Los eventos no se editan ni se borran.
      </p>

      {timeline.length > 0 ? (
        <ol className="space-y-3 border-default-200 border-l pl-4">
          {timeline.map((ev) => (
            <li key={ev.id} className="relative">
              <span
                aria-hidden="true"
                className="-left-[21px] absolute top-1.5 size-2.5 rounded-full bg-default-400"
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-sm">{CUSTODY_ACTION_LABEL[ev.action]}</span>
                <span className="text-default-400 text-xs">
                  {formatChile(ev.occurredAt, "DD/MM/YYYY HH:mm")}
                </span>
                {ev.sealIntact != null ? (
                  <Chip size="sm" variant="soft" color="default">
                    {ev.sealIntact ? "Sello íntegro" : "Sello roto"}
                  </Chip>
                ) : null}
              </div>
              {ev.sampleId != null ? (
                <p className="text-default-500 text-xs">Muestra #{ev.sampleId}</p>
              ) : null}
              {ev.location ? (
                <p className="text-default-500 text-xs">Ubicación: {ev.location}</p>
              ) : null}
              {ev.signatureRef ? (
                <p className="text-default-500 text-xs">Firma: {ev.signatureRef}</p>
              ) : null}
              {ev.notes ? <p className="text-default-600 text-xs">{ev.notes}</p> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-default-500 text-sm">Aún no hay eventos de custodia.</p>
      )}

      <div className="grid gap-4 border-default-200 border-t pt-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="font-medium text-sm">Acción</Label>
          <Select
            aria-label="Acción de custodia"
            selectedKey={action}
            onSelectionChange={(k) => setAction(String(k) as OccCustodyAction)}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {CUSTODY_ACTION_OPTIONS.map((opt) => (
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
          <Label className="font-medium text-sm">Muestra (opcional)</Label>
          <Select
            aria-label="Muestra asociada"
            selectedKey={sampleId}
            onSelectionChange={(k) => setSampleId(String(k))}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="none" textValue="Sin muestra específica">
                  Sin muestra específica
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                {samples.map((s) => (
                  <ListBox.Item
                    key={s.id}
                    id={String(s.id)}
                    textValue={`#${s.id} ${s.containerCode}`}
                  >
                    #{s.id} — {SAMPLE_KIND_LABEL[s.kind]} {s.containerCode}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <div className="flex items-center sm:col-span-2">
          <Switch isSelected={sealIntact} onChange={setSealIntact}>
            Sello íntegro
          </Switch>
        </div>

        <TextField value={signatureRef} onChange={setSignatureRef}>
          <Label>Referencia de firma (opcional)</Label>
          <Input placeholder="ej. firma del custodio" />
        </TextField>

        <TextField value={location} onChange={setLocation}>
          <Label>Ubicación (opcional)</Label>
          <Input placeholder="ej. faena / laboratorio" />
        </TextField>

        <TextField className="sm:col-span-2" value={notes} onChange={setNotes}>
          <Label>Notas (opcional)</Label>
          <TextArea rows={2} placeholder="Detalle del evento…" />
        </TextField>
      </div>

      <div className="flex justify-end">
        <Button size="sm" isPending={add.isPending} onPress={() => add.mutate()}>
          Registrar evento
        </Button>
      </div>
    </Card>
  );
}

// ── Tamizaje ──────────────────────────────────────────────────────────
function ScreeningPanel({ orderId, status }: { orderId: number; status: OccOrderStatus }) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState("");
  const [outcome, setOutcome] = useState<"NEGATIVE" | "PRESUMPTIVE_POSITIVE">("NEGATIVE");
  const [panelText, setPanelText] = useState("");
  const [labId, setLabId] = useState("");

  const record = useMutation({
    mutationFn: () => {
      const panel = panelText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      return recordScreening({
        orderId,
        method: method.trim() || undefined,
        panel,
        outcome,
        labId: labId.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Tamizaje registrado");
      void queryClient.invalidateQueries({ queryKey: occTestingKeys.order(orderId) });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "No se pudo registrar el tamizaje"),
  });

  const alreadyResulted = status === "RESULTED" || status === "INVALID" || status === "CANCELLED";

  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-semibold text-base">Tamizaje</h3>
      <Alert status="default">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>
            El tamizaje nunca arroja "positivo": solo NEGATIVO o PRESUNTIVO POSITIVO. Un presuntivo
            requiere confirmación GC-MS/LC-MS-MS antes de cualquier conclusión.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField value={method} onChange={setMethod}>
          <Label>Método (opcional)</Label>
          <Input placeholder="ej. inmunoensayo" />
        </TextField>

        <div className="space-y-1">
          <Label className="font-medium text-sm">Resultado</Label>
          <Select
            aria-label="Resultado del tamizaje"
            selectedKey={outcome}
            onSelectionChange={(k) => setOutcome(String(k) as "NEGATIVE" | "PRESUMPTIVE_POSITIVE")}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="NEGATIVE" textValue="Negativo">
                  Negativo
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="PRESUMPTIVE_POSITIVE" textValue="Presuntivo positivo">
                  Presuntivo positivo (a confirmar)
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <TextField value={labId} onChange={setLabId}>
          <Label>ID de laboratorio (opcional)</Label>
          <Input placeholder="ej. LAB-001" />
        </TextField>

        <TextField className="sm:col-span-2" value={panelText} onChange={setPanelText}>
          <Label>Panel (sustancias — una por línea o separadas por coma)</Label>
          <TextArea rows={3} placeholder="THC&#10;Cocaína&#10;Anfetaminas" />
        </TextField>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          isPending={record.isPending}
          isDisabled={alreadyResulted}
          onPress={() => record.mutate()}
        >
          Registrar tamizaje
        </Button>
      </div>
    </Card>
  );
}

// ── Confirmatorio ─────────────────────────────────────────────────────
function ConfirmatoryPanel({ orderId, samples }: { orderId: number; samples: OccSample[] }) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<"GC_MS" | "LC_MS_MS">("GC_MS");
  const [sampleId, setSampleId] = useState<string>(samples[0] ? String(samples[0].id) : "");
  const [outcome, setOutcome] = useState<"NEGATIVE" | "POSITIVE">("NEGATIVE");
  const [analytesText, setAnalytesText] = useState("");
  const [confirmingLabId, setConfirmingLabId] = useState("");
  const [isoAccredited, setIsoAccredited] = useState(false);

  const record = useMutation({
    mutationFn: () => {
      if (!sampleId) throw new Error("Selecciona una muestra de la orden");
      const analytes = analytesText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      return recordConfirmatory({
        orderId,
        method,
        sampleId: Number(sampleId),
        analytes,
        outcome,
        confirmingLabId: confirmingLabId.trim() || null,
        isoAccredited,
      });
    },
    onSuccess: () => {
      toast.success("Confirmatorio registrado");
      void queryClient.invalidateQueries({ queryKey: occTestingKeys.order(orderId) });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "No se pudo registrar el confirmatorio"),
  });

  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-semibold text-base">Confirmatorio</h3>
      <p className="text-default-500 text-sm">
        Requiere un tamizaje presuntivo y una muestra de la misma orden. El servidor rechaza el
        registro en caso contrario.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="font-medium text-sm">Método</Label>
          <Select
            aria-label="Método confirmatorio"
            selectedKey={method}
            onSelectionChange={(k) => setMethod(String(k) as "GC_MS" | "LC_MS_MS")}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="GC_MS" textValue="GC-MS">
                  GC-MS
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="LC_MS_MS" textValue="LC-MS-MS">
                  LC-MS-MS
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="font-medium text-sm">Muestra</Label>
          <Select
            aria-label="Muestra confirmatoria"
            selectedKey={sampleId}
            onSelectionChange={(k) => setSampleId(String(k))}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {samples.map((s) => (
                  <ListBox.Item
                    key={s.id}
                    id={String(s.id)}
                    textValue={`#${s.id} ${s.containerCode}`}
                  >
                    #{s.id} — {SAMPLE_KIND_LABEL[s.kind]} {s.containerCode}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="font-medium text-sm">Resultado</Label>
          <Select
            aria-label="Resultado confirmatorio"
            selectedKey={outcome}
            onSelectionChange={(k) => setOutcome(String(k) as "NEGATIVE" | "POSITIVE")}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="NEGATIVE" textValue="Negativo">
                  Negativo
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="POSITIVE" textValue="Positivo">
                  Positivo
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <TextField value={confirmingLabId} onChange={setConfirmingLabId}>
          <Label>Laboratorio confirmante (opcional)</Label>
          <Input placeholder="ej. LAB-CONF-002" />
        </TextField>

        <TextField className="sm:col-span-2" value={analytesText} onChange={setAnalytesText}>
          <Label>Analitos (uno por línea o separados por coma)</Label>
          <TextArea rows={3} placeholder="THC-COOH&#10;Benzoilecgonina" />
        </TextField>

        <div className="flex items-center sm:col-span-2">
          <Switch isSelected={isoAccredited} onChange={setIsoAccredited}>
            Laboratorio acreditado ISO
          </Switch>
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" isPending={record.isPending} onPress={() => record.mutate()}>
          Registrar confirmatorio
        </Button>
      </div>
    </Card>
  );
}

// ── Revisión médica ───────────────────────────────────────────────────
function MedicalReviewPanel({ orderId }: { orderId: number }) {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<"CONFIRMED_POSITIVE" | "EXPLAINED_BY_RX">(
    "CONFIRMED_POSITIVE"
  );
  const [rationale, setRationale] = useState("");
  const [declaredMedsText, setDeclaredMedsText] = useState("");

  const record = useMutation({
    mutationFn: () => {
      if (!rationale.trim()) throw new Error("Indica el fundamento de la decisión");
      const declaredMeds = declaredMedsText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      return recordMedicalReview({
        orderId,
        declaredMeds: declaredMeds.length > 0 ? declaredMeds : null,
        decision,
        rationale: rationale.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Revisión médica registrada");
      void queryClient.invalidateQueries({ queryKey: occTestingKeys.order(orderId) });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "No se pudo registrar la revisión médica"),
  });

  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-semibold text-base">Revisión médica (MRO)</h3>
      <p className="text-default-500 text-sm">
        Solo tras un positivo confirmado. El revisor médico evalúa medicamentos declarados que
        podrían explicar el resultado.
      </p>

      <div className="space-y-1">
        <Label className="font-medium text-sm">Decisión</Label>
        <Select
          aria-label="Decisión de la revisión médica"
          selectedKey={decision}
          onSelectionChange={(k) =>
            setDecision(String(k) as "CONFIRMED_POSITIVE" | "EXPLAINED_BY_RX")
          }
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="CONFIRMED_POSITIVE" textValue="Positivo confirmado">
                Positivo confirmado
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="EXPLAINED_BY_RX" textValue="Explicado por receta">
                Explicado por receta médica
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <TextField value={declaredMedsText} onChange={setDeclaredMedsText}>
        <Label>Medicamentos declarados (opcional — uno por línea o separados por coma)</Label>
        <TextArea rows={2} placeholder="ej. Codeína&#10;Anfetamina (TDAH)" />
      </TextField>

      <TextField value={rationale} onChange={setRationale}>
        <Label>Fundamento</Label>
        <TextArea rows={3} placeholder="Justificación clínica de la decisión…" />
      </TextField>

      <div className="flex justify-end">
        <Button
          size="sm"
          isPending={record.isPending}
          isDisabled={!rationale.trim()}
          onPress={() => record.mutate()}
        >
          Registrar revisión
        </Button>
      </div>
    </Card>
  );
}

// ── Divulgación al empleador ──────────────────────────────────────────
function DisclosurePanel({ orderId }: { orderId: number }) {
  const disclose = useMutation({
    mutationFn: (payloadKind: "AGGREGATE" | "FITNESS_OUTCOME" | "SUBSTANCE_DETAIL") =>
      discloseToEmployer({ orderId, payloadKind }),
    onSuccess: () => toast.success("Divulgación registrada"),
    onError: (e) =>
      // El servidor lanza 403 si falta el consentimiento de divulgación requerido.
      toast.error(e instanceof Error ? e.message : "No se pudo divulgar al empleador"),
  });

  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-semibold text-base">Divulgación al empleador</h3>
      <Alert status="default">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>
            El empleador solo recibe lo consentido; el resultado clínico crudo nunca se divulga
            (Art. 154 bis). AGGREGATE siempre está permitido. FITNESS_OUTCOME y SUBSTANCE_DETAIL
            requieren consentimiento vigente de divulgación (y, para el detalle de sustancia,
            también de nivel/sustancia).
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          isPending={disclose.isPending}
          onPress={() => disclose.mutate("AGGREGATE")}
        >
          Divulgar agregado
        </Button>
        <Button
          size="sm"
          variant="secondary"
          isPending={disclose.isPending}
          onPress={() => disclose.mutate("FITNESS_OUTCOME")}
        >
          Divulgar aptitud
        </Button>
        <Button
          size="sm"
          variant="secondary"
          isPending={disclose.isPending}
          onPress={() => disclose.mutate("SUBSTANCE_DETAIL")}
        >
          Divulgar detalle de sustancia
        </Button>
      </div>
    </Card>
  );
}
