// oxlint-disable typescript/no-non-null-assertion -- TODO(strict-null): refactor each `!` to invariant() or explicit guard. Tracked in repo-wide non-null cleanup.
import type { Key } from "@heroui/react";
import {
  Button,
  Chip,
  Description,
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
  Clock,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  Plus,
  Sparkles,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FeatureErrorBoundary } from "@/components/ui/FeatureErrorBoundary";
import { useToast } from "@/context/ToastContext";
import { listAddresses } from "@/features/addresses/api";
import { AddressFormModal } from "@/features/addresses/components/AddressFormModal";
import { fetchPatient } from "@/features/patients/api";
import {
  createShipment,
  fetchCommercialOffices,
  fetchCommunes,
  fetchNearbyOffices,
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
    // Defaults match the clinic's most common shipment: a 20×12×5 cm
    // box with a 80 g refrigerant + insulin syringe + 0.5 ml
    // immunotherapy fluid (~0.15 kg total). Operator tweaks per
    // exception, not per shipment.
    weight: 0.2,
    height: 5,
    width: 12,
    length: 20,
    declaredValue: 60000,
    cashOnDelivery: 0,
    contentDescription: "Vacuna inmunoterapia con caja de 20×12×5 cm + unidad refrigerante 80 gr",
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
      weight: 0.2,
      height: 5,
      width: 12,
      length: 20,
      declaredValue: 60000,
      cashOnDelivery: 0,
      contentDescription: "Vacuna inmunoterapia con caja de 20×12×5 cm + unidad refrigerante 80 gr",
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
          <Modal.Dialog className="relative w-full max-w-3xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="flex items-center gap-2 font-bold text-primary text-xl">
                <Truck size={20} />
                Nuevo Despacho ChileExpress
              </Modal.Heading>
              <p className="mt-1 text-default-500 text-sm">{patientName}</p>
            </Modal.Header>

            <StepIndicator step={step} />

            <Modal.Body className="mt-4 max-h-[70vh] overflow-y-auto overscroll-contain">
              <FeatureErrorBoundary
                featureName="Nuevo Despacho"
                onClose={handleClose}
                resetKey={step}
              >
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
              </FeatureErrorBoundary>
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
  // Wizard progress (NOT Tabs — clicking should not jump steps). <ol>
  // + aria-current="step" per WAI-ARIA Authoring Practices; completed
  // steps show a check so progress is not color-only. Same compound
  // pattern as PhoneMigrationCard's StepIndicator.
  const current = STEPS.indexOf(step);
  return (
    <ol aria-label="Progreso del despacho" className="flex flex-wrap items-center gap-1.5">
      {STEPS.map((s, i) => {
        const isComplete = i < current;
        const isCurrent = i === current;
        return (
          <li key={s} aria-current={isCurrent ? "step" : undefined}>
            <Chip
              size="sm"
              variant={isCurrent ? "primary" : "soft"}
              color={isComplete ? "success" : isCurrent ? "accent" : "default"}
            >
              {isComplete ? <CheckCircle size={12} aria-hidden /> : null}
              <Chip.Label>
                {i + 1}. {STEP_LABELS[s]}
              </Chip.Label>
            </Chip>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_SHORT: Record<string, string> = {
  Lunes: "Lun",
  Martes: "Mar",
  Miercoles: "Mié",
  Miércoles: "Mié",
  Jueves: "Jue",
  Viernes: "Vie",
  Sabado: "Sáb",
  Sábado: "Sáb",
  Domingo: "Dom",
};

interface BusinessHour {
  day: string;
  initialStartHour: string;
  initialEndHour: string;
  finalStartHour?: string;
  finalEndHour?: string;
}

// Collapse the businessHour list to a compact human label.
// Empty initialStartHour means closed that day; we drop those rows.
// If every open day shares the same range we render "Lun–Vie 09:00–18:00".
// Otherwise we list the first open day and show a count chip for the rest.
function summariseHours(hours: BusinessHour[]): {
  primary: string | null;
  extraDays: number;
} {
  const open = hours.filter((h) => h.initialStartHour && h.initialEndHour);
  if (open.length === 0) return { primary: null, extraDays: 0 };

  const range = (h: BusinessHour) => {
    const am = `${h.initialStartHour}–${h.initialEndHour}`;
    if (h.finalStartHour && h.finalEndHour) {
      return `${am}, ${h.finalStartHour}–${h.finalEndHour}`;
    }
    return am;
  };

  const allSame = open.every((h) => range(h) === range(open[0]!));
  if (allSame) {
    const first = DAY_SHORT[open[0]!.day] ?? open[0]!.day;
    const last = DAY_SHORT[open[open.length - 1]!.day] ?? open[open.length - 1]!.day;
    const span = open.length === 1 ? first : `${first}–${last}`;
    return { primary: `${span} ${range(open[0]!)}`, extraDays: 0 };
  }

  const first = open[0]!;
  return {
    primary: `${DAY_SHORT[first.day] ?? first.day} ${range(first)}`,
    extraDays: open.length - 1,
  };
}

// Treat "0" / empty / "—" as missing — Chilexpress sometimes returns
// "0" as a sentinel for "no phone".
function cleanPhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "0" || trimmed === "—") return null;
  return trimmed;
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
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          <Radio.Content>
            <Label>Domicilio del paciente</Label>
          </Radio.Content>
        </Radio>
        <Radio value="office">
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          <Radio.Content>
            <Label>Sucursal Chilexpress</Label>
          </Radio.Content>
        </Radio>
      </RadioGroup>

      {mode === "home" ? (
        <HomeAddressPicker personId={personId} state={state} onNext={onNext} />
      ) : (
        <OfficePicker personId={personId} state={state} onNext={onNext} />
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
        className="space-y-2"
        onChange={(value) => setSelectedId(Number(value))}
        value={selectedId != null ? String(selectedId) : ""}
      >
        {addresses.map((addr) => (
          <Radio key={addr.id} value={String(addr.id)}>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            <Radio.Content>
              <div className="flex items-center gap-2">
                <Label>{addr.label}</Label>
                {addr.isPrimary && <span className="text-accent text-xs">· Principal</span>}
              </div>
              <Description>
                {addr.street} {addr.number}
                {addr.supplement ? `, ${addr.supplement}` : ""} — {addr.comuna}, {addr.region}
              </Description>
            </Radio.Content>
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
        <Button onPress={() => setAddressModalOpen(true)} size="sm" variant="outline">
          <Plus size={14} />
          Nueva dirección
        </Button>
        <Button
          isDisabled={!canContinue}
          onPress={() => {
            // canContinue guards against null selected, but the deployed
            // bundle was crashing on `selected!.comuna` (likely a stale
            // closure or an address row whose schema-required comuna
            // arrived null from the backend). Defensive guard + ?? "" so
            // the wizard never throws — downstream API call will surface
            // the missing-comuna case as a validation error instead.
            if (!selected) return;
            onNext({
              deliveryMode: "home",
              addressId: selected.id,
              coverageRegionCode: selected.coverageCode ?? "",
              communeName: selected.comuna ?? "",
              regionId: selected.regionCode ?? "",
              commercialOfficeId: "",
              commercialOfficeName: "",
            });
          }}
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
  personId,
  state,
  onNext,
}: {
  personId: number;
  state: Partial<WizardState>;
  onNext: (data: Partial<WizardState>) => void;
}) {
  const [regionId, setRegionId] = useState<Key | null>(state.regionId ?? null);
  const [coverageCode, setCoverageCode] = useState<Key | null>(state.coverageRegionCode ?? null);
  const [communeName, setCommuneName] = useState(state.communeName ?? "");
  const [officeId, setOfficeId] = useState<Key | null>(state.commercialOfficeId ?? null);
  const [officeName, setOfficeName] = useState(state.commercialOfficeName ?? "");
  const [officeKind, setOfficeKind] = useState<"0" | "4">("0");

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
    queryKey: ["cx-offices", regionId, communeName, officeKind],
    queryFn: () =>
      fetchCommercialOffices({
        regionCode: String(regionId),
        countyName: communeName,
        type: officeKind,
      }),
    enabled: Boolean(regionId && communeName),
    staleTime: 1000 * 60 * 60,
  });

  // Suggest nearby Chilexpress offices using the patient's primary
  // address geocoding (filled by addresses.create / .update via
  // /addresses/georeference). Only enabled when we have a chilexpress
  // addressId on file.
  const { data: addressesData } = useQuery({
    queryKey: ["addresses", personId],
    queryFn: () => listAddresses(personId),
    staleTime: 1000 * 60,
  });
  const primaryAddressId = (addressesData ?? []).find(
    (a) => a.isPrimary && (a as { chilexpressAddressId?: number | null }).chilexpressAddressId
  ) as { chilexpressAddressId?: number | null } | undefined;
  const nearbyAddressId = primaryAddressId?.chilexpressAddressId ?? null;

  const { data: nearbyData } = useQuery({
    queryKey: ["cx-nearby-offices", nearbyAddressId],
    queryFn: () => fetchNearbyOffices(nearbyAddressId!),
    enabled: nearbyAddressId != null,
    staleTime: 1000 * 60 * 30,
  });
  const nearbyOffices = nearbyData?.offices ?? [];

  const canContinue = Boolean(coverageCode && officeId);
  const allOffices = officesData?.offices ?? [];
  // Chilexpress API: Type=0 returns mixed (sucursales propias + pickup
  // partners). When the user picked "Sucursales Chilexpress" we filter
  // out pickup partners (officeType === 4) so the lists actually match
  // the toggle label.
  const offices = officeKind === "0" ? allOffices.filter((o) => o.officeType !== 4) : allOffices;
  const selectedOffice = offices.find((o) => o.commercialOfficeId === String(officeId));

  return (
    <div className="space-y-4">
      {nearbyOffices.length > 0 && (
        <div className="space-y-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
          <div className="flex items-center gap-2 font-semibold text-accent text-sm">
            <MapPin size={14} />
            Sucursales cerca del domicilio del paciente
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {nearbyOffices.slice(0, 4).map(({ distance, office }) => (
              <Button
                key={office.commercialOfficeId}
                className="h-auto justify-start whitespace-normal p-3 text-left"
                onPress={() => {
                  setRegionId(office.regionCode);
                  setCoverageCode(office.countyCode ?? "");
                  setCommuneName(office.commune);
                  setOfficeId(office.commercialOfficeId);
                  setOfficeName(office.commercialOfficeName);
                }}
                variant="secondary"
              >
                <div className="flex w-full flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{office.commercialOfficeName}</span>
                    <Chip color="accent" size="sm" variant="soft">
                      {Number(distance).toFixed(1)} km
                    </Chip>
                  </div>
                  <span className="text-default-500 text-xs">
                    {office.street} {office.number}, {office.commune}
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  <span className="flex w-full items-center justify-between gap-2">
                    <span>{c.countyName}</span>
                    {!c.supportsCashOnDelivery && (
                      <Chip color="warning" size="sm" variant="soft">
                        Solo prepago
                      </Chip>
                    )}
                  </span>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {coverageCode && (
        <div className="space-y-3">
          <RadioGroup
            onChange={(value) => {
              setOfficeKind(value as "0" | "4");
              setOfficeId(null);
              setOfficeName("");
            }}
            orientation="horizontal"
            value={officeKind}
          >
            <Radio value="0">
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <Radio.Content>
                <Label>Sucursales Chilexpress</Label>
              </Radio.Content>
            </Radio>
            <Radio value="4">
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <Radio.Content>
                <Label>Pickup partners</Label>
              </Radio.Content>
            </Radio>
          </RadioGroup>

          {loadingOffices ? (
            <div className="flex items-center justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : offices.length === 0 ? (
            <p className="rounded-lg bg-default-50 px-4 py-3 text-default-500 text-sm">
              No hay {officeKind === "0" ? "sucursales propias" : "pickup partners"} para esta
              comuna.
            </p>
          ) : (
            <RadioGroup
              className="grid grid-cols-1 gap-2 md:grid-cols-2"
              onChange={(value) => {
                setOfficeId(value);
                const selected = offices.find((o) => o.commercialOfficeId === value);
                setOfficeName(selected?.commercialOfficeName ?? "");
              }}
              value={officeId != null ? String(officeId) : ""}
            >
              {offices.map((o) => {
                const phone = cleanPhone(o.phone);
                const { primary: hoursLabel, extraDays } = summariseHours(o.businessHour ?? []);
                const address = [o.street, o.number].filter(Boolean).join(" ");
                const fullAddress = o.complement ? `${address}, ${o.complement}` : address;
                return (
                  <Radio key={o.commercialOfficeId} value={o.commercialOfficeId}>
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    <Radio.Content className="w-full">
                      <div className="flex items-start justify-between gap-2">
                        <Label className="font-semibold">{o.commercialOfficeName}</Label>
                        {o.officeType === 4 && (
                          <Chip color="accent" size="sm" variant="soft">
                            Pickup
                          </Chip>
                        )}
                      </div>
                      <div className="mt-1 flex items-start gap-1.5 text-default-600 text-xs">
                        <MapPin className="mt-0.5 shrink-0" size={12} />
                        <span>{fullAddress || "Dirección no disponible"}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-default-600 text-xs">
                        <Phone className="shrink-0" size={12} />
                        {phone ? (
                          <span>{phone}</span>
                        ) : (
                          <Chip color="default" size="sm" variant="soft">
                            Sin teléfono
                          </Chip>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-default-600 text-xs">
                        <Clock className="shrink-0" size={12} />
                        {hoursLabel ? (
                          <span className="flex items-center gap-1">
                            <span>{hoursLabel}</span>
                            {extraDays > 0 && (
                              <Chip color="default" size="sm" variant="soft">
                                +{extraDays} {extraDays === 1 ? "día" : "días"}
                              </Chip>
                            )}
                          </span>
                        ) : (
                          <Chip color="default" size="sm" variant="soft">
                            Horario no disponible
                          </Chip>
                        )}
                      </div>
                    </Radio.Content>
                  </Radio>
                );
              })}
            </RadioGroup>
          )}

          {selectedOffice && selectedOffice.services.length > 0 && (
            <div className="rounded-lg border border-default-100 p-3">
              <p className="mb-2 font-semibold text-default-700 text-xs">
                Servicios disponibles en {selectedOffice.commercialOfficeName}
              </p>
              <div className="flex flex-wrap gap-1">
                {selectedOffice.services
                  .filter((s) => s.serviceStatusCode === 1)
                  .map((s) => (
                    <Chip key={s.serviceTypeCode} size="sm" variant="soft">
                      {s.serviceDescription}
                    </Chip>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

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
    weight: state.weight ?? 0.2,
    height: state.height ?? 5,
    width: state.width ?? 12,
    length: state.length ?? 20,
    declaredValue: state.declaredValue ?? 60000,
  });

  // Clinic shipping presets. Each one swaps every dimension at once
  // (no half-applied state) and resets the selected service so a fresh
  // quote runs. Add more presets here when new packaging is approved.
  const presets: { id: string; label: string; values: typeof dims }[] = [
    {
      id: "vacuna-inmuno",
      label: "Vacuna inmunoterapia (20×12×5 cm · 200 g)",
      values: { weight: 0.2, height: 5, width: 12, length: 20, declaredValue: 60000 },
    },
  ];
  const [selectedCode, setSelectedCode] = useState<string | null>(state.serviceTypeCode ?? null);

  // Debounce dims so re-typing a value doesn't blast Chilexpress.
  const [debouncedDims, setDebouncedDims] = useState(dims);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedDims(dims), 400);
    return () => clearTimeout(t);
  }, [dims]);

  // Auto re-quote whenever dimensions stabilise (incl. on first mount).
  const {
    data: quote,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: [
      "cx-quote",
      state.coverageRegionCode,
      debouncedDims.weight,
      debouncedDims.height,
      debouncedDims.width,
      debouncedDims.length,
      debouncedDims.declaredValue,
    ],
    queryFn: () =>
      quoteShipment({
        originCoverageCode: state.coverageRegionCode ?? "",
        destinationCoverageCode: state.coverageRegionCode ?? "",
        ...debouncedDims,
      }),
    enabled: Boolean(state.coverageRegionCode),
    staleTime: 1000 * 60,
  });

  const services = useMemo(() => quote?.services ?? [], [quote]);

  // Pre-select cheapest service automatically once a quote arrives.
  useEffect(() => {
    if (services.length === 0) return;
    if (selectedCode && services.some((s) => s.serviceTypeCode === selectedCode)) return;
    const cheapest = services.reduce((acc, s) => (s.serviceValue < acc.serviceValue ? s : acc));
    setSelectedCode(cheapest.serviceTypeCode);
  }, [services, selectedCode]);

  const cheapestCode = services.length
    ? services.reduce((acc, s) => (s.serviceValue < acc.serviceValue ? s : acc)).serviceTypeCode
    : null;

  const selectedService = services.find((s) => s.serviceTypeCode === selectedCode) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-default-600 text-sm">
        <Package size={16} />
        Ajusta las dimensiones — la cotización se actualiza automáticamente.
      </div>

      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-default-50 px-3 py-2">
          <span className="flex items-center gap-1 text-default-500 text-xs">
            <Sparkles size={12} />
            Presets:
          </span>
          {presets.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant="tertiary"
              onPress={() => {
                setDims(p.values);
                setSelectedCode(null);
              }}
            >
              <Package size={14} />
              {p.label}
            </Button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <NumberField
          fullWidth
          isRequired
          minValue={0.1}
          step={0.1}
          value={dims.weight}
          formatOptions={{ minimumFractionDigits: 1, maximumFractionDigits: 2 }}
          onChange={(v) => setDims((d) => ({ ...d, weight: v }))}
        >
          <Label>Peso (kg)</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input className="flex-1" />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>
        <NumberField
          fullWidth
          isRequired
          minValue={1}
          step={1000}
          value={dims.declaredValue}
          formatOptions={{ style: "currency", currency: "CLP", maximumFractionDigits: 0 }}
          onChange={(v) => setDims((d) => ({ ...d, declaredValue: v }))}
        >
          <Label>Valor declarado</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input className="flex-1" />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>
        <NumberField
          fullWidth
          isRequired
          minValue={1}
          value={dims.height}
          onChange={(v) => setDims((d) => ({ ...d, height: v }))}
        >
          <Label>Alto (cm)</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input className="flex-1" />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>
        <NumberField
          fullWidth
          isRequired
          minValue={1}
          value={dims.width}
          onChange={(v) => setDims((d) => ({ ...d, width: v }))}
        >
          <Label>Ancho (cm)</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input className="flex-1" />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>
        <NumberField
          fullWidth
          isRequired
          minValue={1}
          value={dims.length}
          className="col-span-2"
          onChange={(v) => setDims((d) => ({ ...d, length: v }))}
        >
          <Label>Largo (cm)</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input className="flex-1" />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>
      </div>

      {isFetching ? (
        <div className="flex items-center justify-center gap-2 py-4 text-default-500 text-sm">
          <Spinner size="sm" />
          Cotizando…
        </div>
      ) : services.length === 0 && !isError ? (
        <p className="rounded-xl bg-default-50 px-4 py-3 text-default-500 text-sm">
          Sin cobertura para este destino y dimensiones.
        </p>
      ) : services.length > 0 ? (
        <RadioGroup
          className="space-y-2"
          onChange={(value) => setSelectedCode(value)}
          value={selectedCode ?? ""}
        >
          {services.map((svc) => (
            <Radio key={svc.serviceTypeCode} value={svc.serviceTypeCode}>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <Radio.Content className="w-full space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label>{svc.serviceDescription}</Label>
                  <span className="font-bold text-primary text-sm">
                    {CLP.format(svc.serviceValue)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {svc.deliveryTime && <Description>{svc.deliveryTime}</Description>}
                  {svc.serviceTypeCode === cheapestCode && (
                    <Chip color="success" size="sm" variant="soft">
                      <Chip.Label>Más barato</Chip.Label>
                    </Chip>
                  )}
                  {svc.didUseVolumetricWeight && (
                    <Chip color="warning" size="sm" variant="soft">
                      <Chip.Label>Peso volumétrico</Chip.Label>
                    </Chip>
                  )}
                  {typeof svc.finalWeight === "number" && (
                    <Chip color="default" size="sm" variant="soft">
                      <Chip.Label>Cobrado por {svc.finalWeight.toFixed(2)} kg</Chip.Label>
                    </Chip>
                  )}
                </div>
                {svc.conditions ? (
                  <p className="text-default-500 text-xs">{svc.conditions}</p>
                ) : null}
                {svc.additionalServices && svc.additionalServices.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-default-400 text-xs">Servicios opcionales:</span>
                    {svc.additionalServices.map((extra) => (
                      <Chip
                        key={`${svc.serviceTypeCode}-${extra.serviceTypeCode}`}
                        size="sm"
                        variant="soft"
                        color={extra.required ? "danger" : "accent"}
                      >
                        <Chip.Label>
                          {extra.serviceDescription} (+{CLP.format(extra.serviceValue)})
                          {extra.required ? " · obligatorio" : ""}
                        </Chip.Label>
                      </Chip>
                    ))}
                  </div>
                ) : null}
              </Radio.Content>
            </Radio>
          ))}
        </RadioGroup>
      ) : null}

      {isError && (
        <p className="text-danger text-sm">
          Error al cotizar: {(error as Error)?.message ?? "desconocido"}
        </p>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onPress={onBack}>
          Atrás
        </Button>
        <Button
          isDisabled={!selectedService}
          onPress={() => {
            if (!selectedService) return;
            onNext({
              ...debouncedDims,
              serviceTypeCode: selectedService.serviceTypeCode,
              serviceDescription: selectedService.serviceDescription,
              serviceValue: selectedService.serviceValue,
            });
          }}
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
          <RadioGroup
            onChange={(value) => {
              field.handleChange(value === "ppd" ? (state.serviceValue ?? 0) : 0);
            }}
            orientation="horizontal"
            value={field.state.value > 0 ? "ppd" : "prepaid"}
          >
            <Radio value="prepaid">
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <Radio.Content>
                <Label>Prepagado</Label>
                <Description>La clínica paga el envío</Description>
              </Radio.Content>
            </Radio>
            <Radio value="ppd">
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <Radio.Content>
                <Label>Flete por cobrar</Label>
                <Description>El paciente paga al recibir</Description>
              </Radio.Content>
            </Radio>
          </RadioGroup>
        )}
      </form.Field>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onPress={onBack} type="button">
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
        <Button variant="outline" onPress={onBack} isDisabled={createMutation.isPending}>
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
