import { Button, Card, Chip, Modal, Spinner } from "@heroui/react";
import { Activity, Building2, Check, ImageUp, KeyRound, Save, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { SelectInput, TextAreaInput, TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import {
  uploadProfilePicture,
  useBusinessProfile,
  usePhoneHealth,
  useRegisterPhone,
  useSetTwoStepPin,
  useUpdateBusinessProfile,
} from "../hooks/useWaCloud";

const VERTICAL_OPTIONS = [
  { value: "", label: "Sin categoría" },
  { value: "HEALTH", label: "Salud" },
  { value: "BEAUTY", label: "Belleza" },
  { value: "EDU", label: "Educación" },
  { value: "FINANCE", label: "Finanzas" },
  { value: "PROF_SERVICES", label: "Servicios profesionales" },
  { value: "RETAIL", label: "Retail" },
  { value: "RESTAURANT", label: "Restaurante" },
  { value: "TRAVEL", label: "Viajes" },
  { value: "GOVT", label: "Gobierno" },
  { value: "NONPROFIT", label: "Sin fines de lucro" },
  { value: "OTHER", label: "Otro" },
];

const QUALITY_COLOR: Record<string, "success" | "warning" | "danger" | "default"> = {
  GREEN: "success",
  YELLOW: "warning",
  RED: "danger",
  UNKNOWN: "default",
};

const NAME_STATUS_COLOR: Record<string, "success" | "warning" | "danger" | "default"> = {
  APPROVED: "success",
  AVAILABLE_WITHOUT_REVIEW: "success",
  PENDING_REVIEW: "warning",
  DECLINED: "danger",
  EXPIRED: "danger",
  NONE: "default",
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  phoneNumberId: number;
  displayPhoneNumber: string;
};

export function PhoneToolsModal({ isOpen, onClose, phoneNumberId, displayPhoneNumber }: Props) {
  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(o) => !o && onClose()}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                Herramientas del número
              </Modal.Heading>
              <p className="text-default-500 text-sm">{displayPhoneNumber}</p>
            </Modal.Header>
            <Modal.Body className="max-h-[75vh] space-y-6 overflow-y-auto">
              <HealthCard phoneNumberId={phoneNumberId} />
              <ProfilePictureCard phoneNumberId={phoneNumberId} />
              <ProfileCard phoneNumberId={phoneNumberId} />
              <PhoneRegistrationCard phoneNumberId={phoneNumberId} />
            </Modal.Body>
            <Modal.Footer className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onPress={onClose}>
                <X size={14} />
                Cerrar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function HealthCard({ phoneNumberId }: { phoneNumberId: number }) {
  const health = usePhoneHealth(phoneNumberId);
  return (
    <Card>
      <Card.Header className="flex items-center gap-2 border-default-200 border-b">
        <Activity size={16} className="text-accent" />
        <p className="font-semibold text-sm">Salud y calidad</p>
      </Card.Header>
      <Card.Content className="space-y-3 p-4">
        {health.isLoading ? (
          <div className="flex justify-center py-4">
            <Spinner size="sm" />
          </div>
        ) : health.error ? (
          <p className="text-danger text-xs">No se pudo obtener salud: {String(health.error)}</p>
        ) : health.data ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Calidad" value={health.data.quality_rating} colorMap={QUALITY_COLOR} />
            <Stat label="Nombre" value={health.data.name_status} colorMap={NAME_STATUS_COLOR} />
            <Stat label="Tier de mensajería" value={health.data.messaging_limit_tier} />
            <Stat label="Verificación" value={health.data.code_verification_status} />
            <Stat label="Plataforma" value={health.data.platform_type} />
            <Stat label="Throughput" value={health.data.throughput?.level} />
            <Stat
              label="Puede enviar"
              value={health.data.health_status?.can_send_message}
              colorMap={{ AVAILABLE: "success", LIMITED: "warning", BLOCKED: "danger" }}
            />
          </div>
        ) : (
          <p className="text-default-500 text-xs">Sin datos.</p>
        )}
      </Card.Content>
    </Card>
  );
}

function Stat({
  label,
  value,
  colorMap,
}: {
  label: string;
  value: string | null | undefined;
  colorMap?: Record<string, "success" | "warning" | "danger" | "default">;
}) {
  if (!value) {
    return (
      <div>
        <p className="text-default-500 text-xs">{label}</p>
        <p className="text-default-400 text-xs">—</p>
      </div>
    );
  }
  const color = colorMap?.[value] ?? "default";
  return (
    <div>
      <p className="text-default-500 text-xs">{label}</p>
      <Chip size="sm" color={color} variant="soft" className="mt-0.5">
        <Chip.Label>{value}</Chip.Label>
      </Chip>
    </div>
  );
}

function ProfileCard({ phoneNumberId }: { phoneNumberId: number }) {
  const profile = useBusinessProfile(phoneNumberId);
  const update = useUpdateBusinessProfile();

  const [about, setAbout] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [vertical, setVertical] = useState("");

  useEffect(() => {
    if (!profile.data) return;
    setAbout(profile.data.about ?? "");
    setDescription(profile.data.description ?? "");
    setEmail(profile.data.email ?? "");
    setAddress(profile.data.address ?? "");
    setWebsite(profile.data.websites?.[0] ?? "");
    setVertical(profile.data.vertical ?? "");
  }, [profile.data]);

  const save = async () => {
    type VerticalEnum =
      | "AUTO"
      | "BEAUTY"
      | "APPAREL"
      | "EDU"
      | "ENTERTAIN"
      | "EVENT_PLAN"
      | "FINANCE"
      | "GROCERY"
      | "GOVT"
      | "HOTEL"
      | "HEALTH"
      | "NONPROFIT"
      | "PROF_SERVICES"
      | "RETAIL"
      | "TRAVEL"
      | "RESTAURANT"
      | "NOT_A_BIZ"
      | "OTHER";
    const fields: {
      about?: string;
      description?: string;
      email?: string;
      address?: string;
      vertical?: VerticalEnum;
      websites?: string[];
    } = {};
    if (about.trim()) fields.about = about.trim();
    if (description.trim()) fields.description = description.trim();
    if (email.trim()) fields.email = email.trim();
    if (address.trim()) fields.address = address.trim();
    if (vertical) fields.vertical = vertical as VerticalEnum;
    if (website.trim()) fields.websites = [website.trim()];
    try {
      await update.mutateAsync({ phoneNumberId, fields });
      toast.success("Perfil actualizado en Meta");
    } catch (err) {
      toast.error(`Error: ${String(err)}`);
    }
  };

  return (
    <Card>
      <Card.Header className="flex items-center gap-2 border-default-200 border-b">
        <Building2 size={16} className="text-accent" />
        <p className="font-semibold text-sm">Perfil de empresa</p>
      </Card.Header>
      <Card.Content className="space-y-3 p-4">
        {profile.isLoading ? (
          <div className="flex justify-center py-4">
            <Spinner size="sm" />
          </div>
        ) : (
          <>
            {profile.data?.profile_picture_url && (
              <img
                src={profile.data.profile_picture_url}
                alt="Foto de perfil"
                className="size-20 rounded-full object-cover"
              />
            )}
            <TextInput
              label="Estado (about, máx 139)"
              value={about}
              onValueChange={setAbout}
              placeholder="Atención de lunes a viernes 9-19h"
            />
            <TextAreaInput
              label="Descripción (máx 512)"
              value={description}
              onValueChange={setDescription}
              placeholder="Centro médico Bioalergia · Alergología infantil y adulta..."
              rows={3}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label="Email"
                value={email}
                onValueChange={setEmail}
                placeholder="contacto@bioalergia.cl"
              />
              <SelectInput
                label="Vertical"
                value={vertical}
                onValueChange={setVertical}
                options={VERTICAL_OPTIONS}
              />
            </div>
            <TextInput
              label="Dirección"
              value={address}
              onValueChange={setAddress}
              placeholder="Av. Apoquindo 1234, Las Condes"
            />
            <TextInput
              label="Sitio web"
              value={website}
              onValueChange={setWebsite}
              placeholder="https://bioalergia.cl"
            />
            <div className="flex justify-end pt-2">
              <Button onPress={save} isPending={update.isPending}>
                {update.isSuccess ? <Check size={14} /> : <Save size={14} />}
                Guardar perfil
              </Button>
            </div>
          </>
        )}
      </Card.Content>
    </Card>
  );
}

function ProfilePictureCard({ phoneNumberId }: { phoneNumberId: number }) {
  const profile = useBusinessProfile(phoneNumberId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [cropTarget, setCropTarget] = useState<string | null>(null);

  const onFile = (file: File) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error("Solo JPG, PNG o WEBP");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Original muy grande (>20MB)");
      return;
    }
    setCropTarget(URL.createObjectURL(file));
  };

  const onCropConfirmed = async (cropped: File) => {
    setCropTarget(null);
    setPending(true);
    try {
      await uploadProfilePicture(cropped, phoneNumberId);
      toast.success("Foto de perfil actualizada en Meta");
      void profile.refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error: ${msg.slice(0, 200)}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Card>
        <Card.Header className="flex items-center gap-2 border-default-200 border-b">
          <ImageUp size={16} className="text-accent" />
          <p className="font-semibold text-sm">Foto de perfil</p>
        </Card.Header>
        <Card.Content className="flex items-center gap-4 p-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          {profile.data?.profile_picture_url ? (
            <img
              src={profile.data.profile_picture_url}
              alt="Perfil"
              className="size-20 shrink-0 rounded-full object-cover ring-2 ring-default-200"
            />
          ) : (
            <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-default-100 text-default-400">
              <ImageUp size={28} />
            </div>
          )}
          <div className="flex-1 space-y-1">
            <p className="text-default-500 text-xs">
              Cuadrada, 192-640px, JPG/PNG/WEBP. Recortas + zoom antes de subir.
            </p>
            <Button
              size="sm"
              variant="outline"
              isPending={pending}
              onPress={() => fileRef.current?.click()}
            >
              <ImageUp size={14} />
              {profile.data?.profile_picture_url ? "Reemplazar foto" : "Subir foto"}
            </Button>
          </div>
        </Card.Content>
      </Card>
      {cropTarget && (
        <CropModal
          src={cropTarget}
          onCancel={() => {
            URL.revokeObjectURL(cropTarget);
            setCropTarget(null);
          }}
          onConfirm={onCropConfirmed}
        />
      )}
    </>
  );
}

function CropModal({
  src,
  onCancel,
  onConfirm,
}: {
  src: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [pending, setPending] = useState(false);

  const onCropComplete = (
    _area: unknown,
    croppedAreaPixels: { x: number; y: number; width: number; height: number }
  ) => {
    setPixels(croppedAreaPixels);
  };

  const buildFile = async (): Promise<File> => {
    if (!pixels) throw new Error("Sin selección");
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("No se pudo cargar imagen"));
      img.src = src;
    });
    const TARGET = 640;
    const canvas = document.createElement("canvas");
    canvas.width = TARGET;
    canvas.height = TARGET;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas no disponible");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, TARGET, TARGET);
    ctx.drawImage(img, pixels.x, pixels.y, pixels.width, pixels.height, 0, 0, TARGET, TARGET);
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob fail"))), "image/jpeg", 0.9)
    );
    return new File([blob], "profile.jpg", { type: "image/jpeg" });
  };

  const submit = async () => {
    setPending(true);
    try {
      const f = await buildFile();
      onConfirm(f);
    } catch (e) {
      toast.error(`Error: ${String(e)}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal>
      <Modal.Backdrop
        isOpen
        onOpenChange={(o) => !o && onCancel()}
        isDismissable
        className="bg-black/70 backdrop-blur-[2px]"
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-lg rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-3">
              <Modal.Heading className="font-bold text-primary text-lg">
                Recortar foto de perfil
              </Modal.Heading>
              <p className="text-default-500 text-xs">
                Arrastra para mover, scroll/slider para zoom. Resultado 640×640 JPEG.
              </p>
            </Modal.Header>
            <Modal.Body className="space-y-3">
              <div className="relative h-80 w-full overflow-hidden rounded-lg bg-black">
                <Cropper
                  image={src}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-default-500 text-xs">Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.currentTarget.value))}
                  className="flex-1 accent-success"
                  aria-label="Zoom"
                />
                <span className="font-mono text-default-500 text-xs">{zoom.toFixed(2)}×</span>
              </div>
            </Modal.Body>
            <Modal.Footer className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onPress={onCancel}>
                <X size={14} />
                Cancelar
              </Button>
              <Button onPress={submit} isPending={pending}>
                <Check size={14} />
                Recortar y subir
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function PhoneRegistrationCard({ phoneNumberId }: { phoneNumberId: number }) {
  const register = useRegisterPhone();
  const setPin = useSetTwoStepPin();
  const [pin, setPinValue] = useState("");
  const [twoStepPin, setTwoStepPin] = useState("");

  const doRegister = async () => {
    if (!/^\d{6}$/.test(pin)) {
      toast.error("PIN debe ser 6 dígitos");
      return;
    }
    try {
      await register.mutateAsync({ phoneNumberId, pin });
      toast.success("Número registrado en Cloud API");
      setPinValue("");
    } catch (err) {
      toast.error(`Error: ${String(err)}`);
    }
  };

  const doSetPin = async () => {
    if (!/^\d{6}$/.test(twoStepPin)) {
      toast.error("PIN debe ser 6 dígitos");
      return;
    }
    try {
      await setPin.mutateAsync({ phoneNumberId, pin: twoStepPin });
      toast.success("PIN 2FA actualizado");
      setTwoStepPin("");
    } catch (err) {
      toast.error(`Error: ${String(err)}`);
    }
  };

  return (
    <Card>
      <Card.Header className="flex items-center gap-2 border-default-200 border-b">
        <KeyRound size={16} className="text-accent" />
        <p className="font-semibold text-sm">Registro y 2FA</p>
      </Card.Header>
      <Card.Content className="space-y-4 p-4">
        <div className="space-y-2 rounded-lg border border-default-200 bg-content2 p-3">
          <p className="font-medium text-sm">Registrar número (POST /register)</p>
          <p className="text-default-500 text-xs">
            Activa el número en Cloud API. Usa el PIN 2FA configurado en Meta. Se hace una vez tras
            verificación inicial.
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <TextInput
                label="PIN 2FA (6 dígitos)"
                value={pin}
                onValueChange={(v) => setPinValue(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
              />
            </div>
            <Button onPress={doRegister} isPending={register.isPending} size="sm">
              <Check size={14} />
              Registrar
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-default-200 bg-content2 p-3">
          <p className="font-medium text-sm">Cambiar PIN 2FA</p>
          <p className="text-default-500 text-xs">
            Actualiza el PIN de verificación en dos pasos del número. Anti-hijack.
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <TextInput
                label="Nuevo PIN (6 dígitos)"
                value={twoStepPin}
                onValueChange={(v) => setTwoStepPin(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="987654"
              />
            </div>
            <Button onPress={doSetPin} isPending={setPin.isPending} size="sm">
              <ShieldCheck size={14} />
              Actualizar
            </Button>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
