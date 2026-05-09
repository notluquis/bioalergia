import { Button, Card, Chip, Modal, Spinner } from "@heroui/react";
import { Activity, Building2, Check, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SelectInput, TextAreaInput, TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import { useBusinessProfile, usePhoneHealth, useUpdateBusinessProfile } from "../hooks/useWaCloud";

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
              <ProfileCard phoneNumberId={phoneNumberId} />
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
