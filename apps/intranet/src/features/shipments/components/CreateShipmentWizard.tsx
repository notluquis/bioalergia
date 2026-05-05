import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  NumberField,
  Select,
  TextField,
} from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, MapPin, Package, PackageCheck, Truck } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/context/ToastContext";
import { fetchPatient } from "@/features/patients/api";
import {
  createShipment,
  fetchCommercialOffices,
  fetchCommunes,
  fetchRegions,
  quoteShipment,
} from "../api";

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" });

type Step = "coverage" | "quote" | "recipient" | "confirm" | "done";

interface WizardState {
  regionId: string;
  coverageRegionCode: string;
  communeName: string;
  commercialOfficeId: string;
  commercialOfficeName: string;
  serviceTypeCode: string;
  serviceDescription: string;
  serviceValue: number;
  weight: number;
  height: number;
  width: number;
  length: number;
  declaredValue: number;
  cashOnDelivery: number;
  recipientName: string;
  recipientPhone: string;
  recipientEmail: string;
  contentDescription: string;
}

interface CreateShipmentWizardProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  patientName: string;
}

export function CreateShipmentWizard({
  isOpen,
  onClose,
  patientId,
  patientName,
}: Readonly<CreateShipmentWizardProps>) {
  const queryClient = useQueryClient();
  const { error: toastError, success } = useToast();
  const [step, setStep] = useState<Step>("coverage");
  const [state, setState] = useState<Partial<WizardState>>({
    weight: 1,
    height: 10,
    width: 10,
    length: 10,
    declaredValue: 10000,
    cashOnDelivery: 0,
  });

  const { data: patientData } = useQuery({
    queryKey: ["patient", String(patientId)],
    queryFn: () => fetchPatient(patientId),
    staleTime: 1000 * 60 * 5,
  });
  const [result, setResult] = useState<{ otNumber: string; labelBase64: string | null } | null>(
    null
  );

  const handleClose = () => {
    setStep("coverage");
    setState({
      weight: 1,
      height: 10,
      width: 10,
      length: 10,
      declaredValue: 10000,
      cashOnDelivery: 0,
    });
    setResult(null);
    onClose();
  };

  const merge = (partial: Partial<WizardState>) => setState((prev) => ({ ...prev, ...partial }));

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="flex items-center gap-2 font-bold text-primary text-xl">
                <Truck size={20} />
                Nuevo Despacho ChileExpress
              </Modal.Heading>
              <p className="mt-1 text-default-500 text-sm">{patientName}</p>
            </Modal.Header>

            <StepIndicator step={step} />

            <Modal.Body className="mt-4 max-h-[70vh] overflow-y-auto overscroll-contain">
              {step === "coverage" && (
                <CoverageStep
                  state={state}
                  patientAddress={patientData?.person.address ?? null}
                  onNext={(data) => {
                    merge(data);
                    setStep("quote");
                  }}
                />
              )}
              {step === "quote" && (
                <QuoteStep
                  state={state}
                  onBack={() => setStep("coverage")}
                  onNext={(data) => {
                    merge(data);
                    setStep("recipient");
                  }}
                />
              )}
              {step === "recipient" && (
                <RecipientStep
                  state={state}
                  patientDefaults={{
                    name: patientName,
                    phone: patientData?.person.phone ?? "",
                    email: patientData?.person.email ?? "",
                  }}
                  onBack={() => setStep("quote")}
                  onNext={(data) => {
                    merge(data);
                    setStep("confirm");
                  }}
                />
              )}
              {step === "confirm" && (
                <ConfirmStep
                  state={state as WizardState}
                  patientId={patientId}
                  onBack={() => setStep("recipient")}
                  onSuccess={(res) => {
                    setResult(res);
                    setStep("done");
                    void queryClient.invalidateQueries({ queryKey: ["shipments", patientId] });
                    success(`OT ${res.otNumber} creada correctamente`);
                  }}
                  onError={(msg) => toastError(msg)}
                />
              )}
              {step === "done" && result && (
                <DoneStep
                  otNumber={result.otNumber}
                  labelBase64={result.labelBase64}
                  onClose={handleClose}
                />
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS: Step[] = ["coverage", "quote", "recipient", "confirm", "done"];
const STEP_LABELS: Record<Step, string> = {
  coverage: "Cobertura",
  quote: "Cotizar",
  recipient: "Datos",
  confirm: "Confirmar",
  done: "Listo",
};

function StepIndicator({ step }: { step: Step }) {
  const current = STEPS.indexOf(step);
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              i < current
                ? "bg-primary text-primary-foreground"
                : i === current
                  ? "bg-primary/20 text-primary"
                  : "bg-default-100 text-default-400"
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`text-xs ${i === current ? "font-semibold text-primary" : "text-default-400"}`}
          >
            {STEP_LABELS[s]}
          </span>
          {i < STEPS.length - 1 && <div className="mx-1 h-px w-4 bg-default-200" />}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Coverage ─────────────────────────────────────────────────────────

function CoverageStep({
  state,
  patientAddress,
  onNext,
}: {
  state: Partial<WizardState>;
  patientAddress: null | string;
  onNext: (data: Partial<WizardState>) => void;
}) {
  const [regionId, setRegionId] = useState(state.regionId ?? "");
  const [coverageCode, setCoverageCode] = useState(state.coverageRegionCode ?? "");
  const [communeName, setCommuneName] = useState(state.communeName ?? "");
  const [officeId, setOfficeId] = useState(state.commercialOfficeId ?? "");
  const [officeName, setOfficeName] = useState(state.commercialOfficeName ?? "");

  const { data: regionsData, isLoading: loadingRegions } = useQuery({
    queryKey: ["cx-regions"],
    queryFn: fetchRegions,
    staleTime: 1000 * 60 * 60,
  });

  const { data: communesData, isLoading: loadingCommunes } = useQuery({
    queryKey: ["cx-communes", regionId],
    queryFn: () => fetchCommunes(regionId),
    enabled: Boolean(regionId),
    staleTime: 1000 * 60 * 60,
  });

  const { data: officesData, isLoading: loadingOffices } = useQuery({
    queryKey: ["cx-offices", coverageCode],
    queryFn: () => fetchCommercialOffices(coverageCode),
    enabled: Boolean(coverageCode),
    staleTime: 1000 * 60 * 60,
  });

  const canContinue = Boolean(coverageCode && officeId);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-default-600 text-sm">
        <MapPin size={16} />
        Selecciona la sucursal de destino del paciente
      </div>
      {patientAddress && (
        <div className="flex items-start gap-2 rounded-lg bg-default-50 px-3 py-2 text-default-600 text-xs">
          <MapPin size={13} className="mt-0.5 shrink-0 text-default-400" />
          <span>
            Dirección del paciente: <span className="font-medium">{patientAddress}</span>
          </span>
        </div>
      )}

      <div className="space-y-4">
        <Select
          isRequired
          selectedKey={regionId}
          onSelectionChange={(key) => {
            setRegionId(String(key));
            setCoverageCode("");
            setCommuneName("");
            setOfficeId("");
            setOfficeName("");
          }}
        >
          <Label>Región</Label>
          <Select.Trigger isDisabled={loadingRegions}>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {(regionsData?.regions ?? []).map((r) => (
                <ListBox.Item id={r.regionId} key={r.regionId}>
                  {r.regionName}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select
          isRequired
          isDisabled={!regionId}
          selectedKey={coverageCode}
          onSelectionChange={(key) => {
            const selected = communesData?.communes.find(
              (c) => c.coverageRegionCode === String(key)
            );
            setCoverageCode(String(key));
            setCommuneName(selected?.countyName ?? "");
            setOfficeId("");
            setOfficeName("");
          }}
        >
          <Label>Comuna</Label>
          <Select.Trigger isDisabled={loadingCommunes}>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {(communesData?.communes ?? []).map((c) => (
                <ListBox.Item id={c.coverageRegionCode} key={c.coverageRegionCode}>
                  {c.countyName}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select
          isRequired
          isDisabled={!coverageCode}
          selectedKey={officeId}
          onSelectionChange={(key) => {
            const selected = officesData?.offices.find((o) => o.commercialOfficeId === String(key));
            setOfficeId(String(key));
            setOfficeName(selected?.commercialOfficeName ?? "");
          }}
        >
          <Label>Sucursal ChileExpress</Label>
          <Select.Trigger isDisabled={loadingOffices}>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {(officesData?.offices ?? []).map((o) => (
                <ListBox.Item id={o.commercialOfficeId} key={o.commercialOfficeId}>
                  <div>
                    <div className="font-medium">{o.commercialOfficeName}</div>
                    <div className="text-default-500 text-xs">
                      {o.street} {o.number}
                    </div>
                  </div>
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          isDisabled={!canContinue}
          onPress={() =>
            onNext({
              regionId,
              coverageRegionCode: coverageCode,
              communeName,
              commercialOfficeId: officeId,
              commercialOfficeName: officeName,
            })
          }
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Quote ────────────────────────────────────────────────────────────

function QuoteStep({
  state,
  onBack,
  onNext,
}: {
  state: Partial<WizardState>;
  onBack: () => void;
  onNext: (data: Partial<WizardState>) => void;
}) {
  const [dims, setDims] = useState({
    weight: state.weight ?? 1,
    height: state.height ?? 10,
    width: state.width ?? 10,
    length: state.length ?? 10,
    declaredValue: state.declaredValue ?? 10000,
  });
  const [selectedService, setSelectedService] = useState<{
    code: string;
    description: string;
    value: number;
  } | null>(
    state.serviceTypeCode
      ? {
          code: state.serviceTypeCode,
          description: state.serviceDescription ?? "",
          value: state.serviceValue ?? 0,
        }
      : null
  );

  const quoteMutation = useMutation({
    mutationFn: () =>
      quoteShipment({
        originCoverageCode: state.coverageRegionCode ?? "",
        destinationCoverageCode: state.coverageRegionCode ?? "",
        ...dims,
      }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-default-600 text-sm">
        <Package size={16} />
        Ingresa las dimensiones del paquete para cotizar
      </div>

      <Form
        className="space-y-4"
        validationBehavior="aria"
        onSubmit={(e) => {
          e.preventDefault();
          quoteMutation.mutate();
          setSelectedService(null);
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            isRequired
            minValue={0.1}
            value={dims.weight}
            onChange={(v) => setDims((d) => ({ ...d, weight: v }))}
          >
            <Label>Peso (kg)</Label>
            <NumberField.Group>
              <NumberField.Input />
            </NumberField.Group>
          </NumberField>
          <NumberField
            isRequired
            minValue={1}
            value={dims.declaredValue}
            onChange={(v) => setDims((d) => ({ ...d, declaredValue: v }))}
          >
            <Label>Valor declarado ($)</Label>
            <NumberField.Group>
              <NumberField.Input />
            </NumberField.Group>
          </NumberField>
          <NumberField
            isRequired
            minValue={1}
            value={dims.height}
            onChange={(v) => setDims((d) => ({ ...d, height: v }))}
          >
            <Label>Alto (cm)</Label>
            <NumberField.Group>
              <NumberField.Input />
            </NumberField.Group>
          </NumberField>
          <NumberField
            isRequired
            minValue={1}
            value={dims.width}
            onChange={(v) => setDims((d) => ({ ...d, width: v }))}
          >
            <Label>Ancho (cm)</Label>
            <NumberField.Group>
              <NumberField.Input />
            </NumberField.Group>
          </NumberField>
          <NumberField
            isRequired
            minValue={1}
            value={dims.length}
            className="col-span-2"
            onChange={(v) => setDims((d) => ({ ...d, length: v }))}
          >
            <Label>Largo (cm)</Label>
            <NumberField.Group>
              <NumberField.Input />
            </NumberField.Group>
          </NumberField>
        </div>

        <Button
          type="submit"
          variant="outline"
          isPending={quoteMutation.isPending}
          className="w-full gap-2"
        >
          <Truck size={16} />
          Cotizar
        </Button>
      </Form>

      {quoteMutation.isSuccess && (
        <div className="space-y-2">
          <p className="font-semibold text-sm">Servicios disponibles:</p>
          {(quoteMutation.data?.services ?? []).length === 0 ? (
            <p className="text-danger text-sm">Sin cobertura para este destino.</p>
          ) : (
            <div className="space-y-2">
              {(quoteMutation.data?.services ?? []).map((svc) => (
                <button
                  key={svc.serviceTypeCode}
                  type="button"
                  onClick={() =>
                    setSelectedService({
                      code: svc.serviceTypeCode,
                      description: svc.serviceDescription,
                      value: svc.serviceValue,
                    })
                  }
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    selectedService?.code === svc.serviceTypeCode
                      ? "border-primary bg-primary/10"
                      : "border-default-200 hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{svc.serviceDescription}</span>
                    <span className="font-bold text-primary text-sm">
                      {CLP.format(svc.serviceValue)}
                    </span>
                  </div>
                  {svc.deliveryTime && (
                    <span className="text-default-500 text-xs">{svc.deliveryTime}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {quoteMutation.isError && (
        <p className="text-danger text-sm">
          Error al cotizar: {(quoteMutation.error as Error).message}
        </p>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onPress={onBack}>
          Atrás
        </Button>
        <Button
          isDisabled={!selectedService}
          onPress={() =>
            onNext({
              ...dims,
              serviceTypeCode: selectedService!.code,
              serviceDescription: selectedService!.description,
              serviceValue: selectedService!.value,
            })
          }
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Recipient ────────────────────────────────────────────────────────

function RecipientStep({
  state,
  patientDefaults,
  onBack,
  onNext,
}: {
  state: Partial<WizardState>;
  patientDefaults: { name: string; phone: string; email: string };
  onBack: () => void;
  onNext: (data: Partial<WizardState>) => void;
}) {
  const form = useForm({
    defaultValues: {
      recipientName: state.recipientName || patientDefaults.name,
      recipientPhone: state.recipientPhone || patientDefaults.phone,
      recipientEmail: state.recipientEmail || patientDefaults.email,
      contentDescription: state.contentDescription ?? "Medicamentos",
      cashOnDelivery: state.cashOnDelivery ?? 0,
    },
    onSubmit: ({ value }) => {
      onNext(value);
    },
  });

  return (
    <Form
      className="space-y-4"
      validationBehavior="aria"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="recipientName"
        validators={{ onChange: ({ value }) => (!value.trim() ? "Requerido" : undefined) }}
      >
        {(field) => (
          <TextField
            isRequired
            isInvalid={field.state.meta.errors.length > 0}
            value={field.state.value}
            onChange={(v) => field.handleChange(v)}
          >
            <Label>Nombre destinatario</Label>
            <Input onBlur={field.handleBlur} placeholder="Nombre completo" />
            {field.state.meta.errors[0] ? (
              <FieldError>{String(field.state.meta.errors[0])}</FieldError>
            ) : null}
          </TextField>
        )}
      </form.Field>

      <form.Field
        name="recipientPhone"
        validators={{ onChange: ({ value }) => (!value.trim() ? "Requerido" : undefined) }}
      >
        {(field) => (
          <TextField
            isRequired
            isInvalid={field.state.meta.errors.length > 0}
            value={field.state.value}
            onChange={(v) => field.handleChange(v)}
          >
            <Label>Teléfono destinatario</Label>
            <Input onBlur={field.handleBlur} placeholder="+56 9 1234 5678" />
            {field.state.meta.errors[0] ? (
              <FieldError>{String(field.state.meta.errors[0])}</FieldError>
            ) : null}
          </TextField>
        )}
      </form.Field>

      <form.Field name="recipientEmail">
        {(field) => (
          <TextField value={field.state.value} onChange={(v) => field.handleChange(v)}>
            <Label>Email destinatario (opcional)</Label>
            <Input onBlur={field.handleBlur} placeholder="correo@ejemplo.com" type="email" />
          </TextField>
        )}
      </form.Field>

      <form.Field name="contentDescription">
        {(field) => (
          <TextField isRequired value={field.state.value} onChange={(v) => field.handleChange(v)}>
            <Label>Descripción del contenido</Label>
            <Input onBlur={field.handleBlur} placeholder="Ej: Medicamentos" />
          </TextField>
        )}
      </form.Field>

      <form.Field name="cashOnDelivery">
        {(field) => (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => field.handleChange(0)}
                className={`flex-1 rounded-xl border px-4 py-3 text-center text-sm transition-colors ${
                  field.state.value === 0
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-default-200 hover:border-primary/40"
                }`}
              >
                Prepagado
                <div className="text-default-500 text-xs">La clínica paga el envío</div>
              </button>
              <button
                type="button"
                onClick={() => field.handleChange(state.serviceValue ?? 0)}
                className={`flex-1 rounded-xl border px-4 py-3 text-center text-sm transition-colors ${
                  field.state.value > 0
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-default-200 hover:border-primary/40"
                }`}
              >
                Flete por cobrar
                <div className="text-default-500 text-xs">El paciente paga al recibir</div>
              </button>
            </div>
          </div>
        )}
      </form.Field>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onPress={onBack} type="button">
          Atrás
        </Button>
        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" isDisabled={!canSubmit} isPending={isSubmitting}>
              Continuar
            </Button>
          )}
        </form.Subscribe>
      </div>
    </Form>
  );
}

// ─── Step 4: Confirm ──────────────────────────────────────────────────────────

function ConfirmStep({
  state,
  patientId,
  onBack,
  onSuccess,
  onError,
}: {
  state: WizardState;
  patientId: number;
  onBack: () => void;
  onSuccess: (res: { otNumber: string; labelBase64: string | null }) => void;
  onError: (msg: string) => void;
}) {
  const createMutation = useMutation({
    mutationFn: () =>
      createShipment({
        patientId,
        serviceTypeCode: state.serviceTypeCode,
        serviceDescription: state.serviceDescription,
        destinationCoverageCode: state.coverageRegionCode,
        commercialOfficeId: state.commercialOfficeId,
        commercialOfficeName: state.commercialOfficeName,
        recipientName: state.recipientName,
        recipientPhone: state.recipientPhone,
        recipientEmail: state.recipientEmail || undefined,
        weight: state.weight,
        height: state.height,
        width: state.width,
        length: state.length,
        declaredValue: state.declaredValue,
        cashOnDelivery: state.cashOnDelivery,
        contentDescription: state.contentDescription,
      }),
    onSuccess: (data) => onSuccess({ otNumber: data.otNumber, labelBase64: data.labelBase64 }),
    onError: (err) => onError((err as Error).message),
  });

  const rows = [
    ["Sucursal destino", state.commercialOfficeName],
    ["Comuna", state.communeName],
    ["Servicio", state.serviceDescription],
    ["Destinatario", state.recipientName],
    ["Teléfono", state.recipientPhone],
    [
      "Pago",
      state.cashOnDelivery > 0
        ? `Flete por cobrar (${CLP.format(state.cashOnDelivery)})`
        : "Prepagado",
    ],
    ["Peso", `${state.weight} kg`],
    ["Dimensiones", `${state.height}×${state.width}×${state.length} cm`],
    ["Valor declarado", CLP.format(state.declaredValue)],
    ["Contenido", state.contentDescription],
  ];

  return (
    <div className="space-y-5">
      <p className="text-default-600 text-sm">Revisa los datos antes de generar la OT:</p>

      <div className="divide-y divide-default-100 rounded-xl border border-default-200">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between px-4 py-2.5 text-sm">
            <span className="text-default-500">{label}</span>
            <span className="ml-4 text-right font-medium">{value}</span>
          </div>
        ))}
      </div>

      {createMutation.isError && (
        <p className="text-danger text-sm">Error: {(createMutation.error as Error).message}</p>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onPress={onBack} isDisabled={createMutation.isPending}>
          Atrás
        </Button>
        <Button isPending={createMutation.isPending} onPress={() => createMutation.mutate()}>
          Generar OT
        </Button>
      </div>
    </div>
  );
}

// ─── Step 5: Done ─────────────────────────────────────────────────────────────

function DoneStep({
  otNumber,
  labelBase64,
  onClose,
}: {
  otNumber: string;
  labelBase64: string | null;
  onClose: () => void;
}) {
  const downloadLabel = () => {
    if (!labelBase64) return;
    const byteChars = atob(labelBase64);
    const byteNums = Array.from({ length: byteChars.length }, (_, i) => byteChars.charCodeAt(i));
    const blob = new Blob([new Uint8Array(byteNums)], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `etiqueta-${otNumber}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <CheckCircle size={56} className="text-success" />
      <div>
        <h3 className="font-bold text-lg">¡OT Generada!</h3>
        <p className="text-default-500 text-sm">Número de orden de transporte:</p>
        <p className="mt-1 font-mono font-bold text-2xl text-primary">{otNumber}</p>
      </div>

      <div className="flex gap-3">
        {labelBase64 && (
          <Button className="gap-2" onPress={downloadLabel}>
            <PackageCheck size={16} />
            Descargar Etiqueta
          </Button>
        )}
        <Button variant="outline" onPress={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
