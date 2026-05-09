import type { Key } from "@heroui/react";
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  NumberField,
  Radio,
  RadioGroup,
  Select,
  Spinner,
  TextField,
} from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle,
  MapPin,
  Package,
  PackageCheck,
  Plus,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/context/ToastContext";
import { listAddresses } from "@/features/addresses/api";
import { AddressFormModal } from "@/features/addresses/components/AddressFormModal";
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
  deliveryMode: "home" | "office";
  // Home delivery
  addressId: number | null;
  // Office delivery
  regionId: string;
  coverageRegionCode: string;
  communeName: string;
  commercialOfficeId: string;
  commercialOfficeName: string;
  // Common
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
    deliveryMode: "home",
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
      deliveryMode: "home",
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
              {step === "coverage" && patientData && (
                <CoverageStep
                  state={state}
                  personId={patientData.person.id}
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
  personId,
  onNext,
}: {
  state: Partial<WizardState>;
  personId: number;
  onNext: (data: Partial<WizardState>) => void;
}) {
  const [mode, setMode] = useState<"home" | "office">(state.deliveryMode ?? "home");
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-default-600 text-sm">
        <MapPin size={16} />
        ¿A dónde despachar?
      </div>

      <RadioGroup
        onChange={(value) => setMode(value as "home" | "office")}
        value={mode}
        orientation="horizontal"
      >
        <Radio value="home">
          <Radio.Indicator />
          <Label>Domicilio del paciente</Label>
        </Radio>
        <Radio value="office">
          <Radio.Indicator />
          <Label>Sucursal Chilexpress</Label>
        </Radio>
      </RadioGroup>

      {mode === "home" ? (
        <HomeAddressPicker personId={personId} state={state} onNext={onNext} />
      ) : (
        <OfficePicker state={state} onNext={onNext} />
      )}
    </div>
  );
}

// ─── Step 1a: Home address picker ─────────────────────────────────────────────

function HomeAddressPicker({
  personId,
  state,
  onNext,
}: {
  personId: number;
  state: Partial<WizardState>;
  onNext: (data: Partial<WizardState>) => void;
}) {
  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["addresses", personId],
    queryFn: () => listAddresses(personId),
  });
  // Auto-select primary (or first) on first render. User can override.
  const initialId =
    state.addressId ?? addresses.find((a) => a.isPrimary)?.id ?? addresses[0]?.id ?? null;
  const [selectedId, setSelectedId] = useState<number | null>(initialId);
  // Re-sync when addresses load.
  useEffect(() => {
    if (selectedId == null && addresses.length > 0) {
      setSelectedId(addresses.find((a) => a.isPrimary)?.id ?? addresses[0]?.id ?? null);
    }
  }, [addresses, selectedId]);
  const [addressModalOpen, setAddressModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }

  if (addresses.length === 0) {
    return (
      <>
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <div className="mb-2 flex items-center gap-2 font-semibold text-warning-700 dark:text-warning-300">
            <AlertTriangle size={15} />
            Este paciente no tiene direcciones registradas
          </div>
          <p className="text-default-600 text-xs">
            Agrega una dirección estructurada para poder despachar a domicilio. La región y comuna
            que selecciones quedarán guardadas y se reutilizarán para Chilexpress.
          </p>
        </div>
        <div className="flex justify-end">
          <Button onPress={() => setAddressModalOpen(true)} size="sm" variant="primary">
            <Plus size={14} />
            Agregar dirección
          </Button>
        </div>
        <AddressFormModal
          isOpen={addressModalOpen}
          onClose={() => setAddressModalOpen(false)}
          personId={personId}
        />
      </>
    );
  }

  const selected = addresses.find((a) => a.id === selectedId) ?? null;
  const canContinue = Boolean(selected?.coverageCode);

  return (
    <>
      <RadioGroup
        onChange={(value) => setSelectedId(Number(value))}
        value={selectedId != null ? String(selectedId) : null}
        className="space-y-2"
      >
        {addresses.map((addr) => (
          <Radio key={addr.id} value={String(addr.id)} className="w-full">
            <Radio.Indicator />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-sm">{addr.label}</span>
                {addr.isPrimary && <span className="text-accent text-xs">· Principal</span>}
              </div>
              <p className="text-default-700 text-xs">
                {addr.street} {addr.number}
                {addr.supplement ? `, ${addr.supplement}` : ""} — {addr.comuna}, {addr.region}
              </p>
            </div>
          </Radio>
        ))}
      </RadioGroup>

      {selected && !selected.coverageCode && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger text-sm">
          Esta dirección no tiene coverageCode de Chilexpress. Edítala y selecciona la comuna otra
          vez para regenerar los códigos.
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button onPress={() => setAddressModalOpen(true)} size="sm" variant="ghost">
          <Plus size={14} />
          Nueva dirección
        </Button>
        <Button
          isDisabled={!canContinue}
          onPress={() =>
            onNext({
              deliveryMode: "home",
              addressId: selected!.id,
              coverageRegionCode: selected!.coverageCode ?? "",
              communeName: selected!.comuna,
              regionId: selected!.regionCode ?? "",
              commercialOfficeId: "",
              commercialOfficeName: "",
            })
          }
        >
          Continuar
        </Button>
      </div>

      <AddressFormModal
        isOpen={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        personId={personId}
      />
    </>
  );
}

// ─── Step 1b: Office picker (Chilexpress sucursal) ────────────────────────────

function OfficePicker({
  state,
  onNext,
}: {
  state: Partial<WizardState>;
  onNext: (data: Partial<WizardState>) => void;
}) {
  const [regionId, setRegionId] = useState<Key | null>(state.regionId ?? null);
  const [coverageCode, setCoverageCode] = useState<Key | null>(state.coverageRegionCode ?? null);
  const [communeName, setCommuneName] = useState(state.communeName ?? "");
  const [officeId, setOfficeId] = useState<Key | null>(state.commercialOfficeId ?? null);
  const [officeName, setOfficeName] = useState(state.commercialOfficeName ?? "");

  const { data: regionsData, isLoading: loadingRegions } = useQuery({
    queryKey: ["cx-regions"],
    queryFn: fetchRegions,
    staleTime: 1000 * 60 * 60,
  });

  const { data: communesData, isLoading: loadingCommunes } = useQuery({
    queryKey: ["cx-communes", regionId],
    queryFn: () => fetchCommunes(String(regionId)),
    enabled: Boolean(regionId),
    staleTime: 1000 * 60 * 60,
  });

  const { data: officesData, isLoading: loadingOffices } = useQuery({
    queryKey: ["cx-offices", coverageCode],
    queryFn: () => fetchCommercialOffices(String(coverageCode)),
    enabled: Boolean(coverageCode),
    staleTime: 1000 * 60 * 60,
  });

  const canContinue = Boolean(coverageCode && officeId);

  return (
    <div className="space-y-4">
      <Select
        isDisabled={loadingRegions}
        isRequired
        onChange={(value) => {
          setRegionId(value as Key | null);
          setCoverageCode(null);
          setCommuneName("");
          setOfficeId(null);
          setOfficeName("");
        }}
        placeholder="Selecciona una región"
        value={regionId}
      >
        <Label>Región</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {(regionsData?.regions ?? []).map((r) => (
              <ListBox.Item id={r.regionId} key={r.regionId} textValue={r.regionName}>
                {r.regionName}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <Select
        isDisabled={!regionId || loadingCommunes}
        isRequired
        onChange={(value) => {
          const next = (value as string | null) ?? null;
          const selected = communesData?.communes.find((c) => c.coverageRegionCode === next);
          setCoverageCode(next);
          setCommuneName(selected?.countyName ?? "");
          setOfficeId(null);
          setOfficeName("");
        }}
        placeholder="Selecciona una comuna"
        value={coverageCode}
      >
        <Label>Comuna</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {(communesData?.communes ?? []).map((c) => (
              <ListBox.Item
                id={c.coverageRegionCode}
                key={c.coverageRegionCode}
                textValue={c.countyName}
              >
                {c.countyName}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <Select
        isDisabled={!coverageCode || loadingOffices}
        isRequired
        onChange={(value) => {
          const next = (value as string | null) ?? null;
          const selected = officesData?.offices.find((o) => o.commercialOfficeId === next);
          setOfficeId(next);
          setOfficeName(selected?.commercialOfficeName ?? "");
        }}
        placeholder="Selecciona una sucursal"
        value={officeId}
      >
        <Label>Sucursal ChileExpress</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {(officesData?.offices ?? []).map((o) => (
              <ListBox.Item
                id={o.commercialOfficeId}
                key={o.commercialOfficeId}
                textValue={o.commercialOfficeName}
              >
                <div>
                  <div className="font-medium">{o.commercialOfficeName}</div>
                  <div className="text-default-500 text-xs">
                    {o.street} {o.number}
                  </div>
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <div className="flex justify-end pt-2">
        <Button
          isDisabled={!canContinue}
          onPress={() =>
            onNext({
              deliveryMode: "office",
              addressId: null,
              regionId: String(regionId ?? ""),
              coverageRegionCode: String(coverageCode ?? ""),
              communeName,
              commercialOfficeId: String(officeId ?? ""),
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
        deliveryMode: state.deliveryMode,
        addressId: state.deliveryMode === "home" ? (state.addressId ?? undefined) : undefined,
        serviceTypeCode: state.serviceTypeCode,
        serviceDescription: state.serviceDescription,
        destinationCoverageCode: state.coverageRegionCode,
        commercialOfficeId: state.deliveryMode === "office" ? state.commercialOfficeId : undefined,
        commercialOfficeName:
          state.deliveryMode === "office" ? state.commercialOfficeName : undefined,
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
