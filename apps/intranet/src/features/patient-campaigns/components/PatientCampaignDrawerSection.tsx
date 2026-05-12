import {
  Button,
  Chip,
  Dropdown,
  ListBox,
  Select,
  Separator,
  Skeleton,
  Surface,
} from "@heroui/react";
import { Check, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/context/ToastContext";
import {
  usePatientCampaigns,
  usePatientCampaignsByPatient,
  useUpdateRecipientStatus,
  useUpsertCampaignRecipient,
} from "../queries";
import {
  PATIENT_CAMPAIGN_STATUS_COLORS,
  PATIENT_CAMPAIGN_STATUS_LABELS,
  PATIENT_CAMPAIGN_STATUSES,
  type PatientCampaignRecipientStatus,
} from "../types";

interface PatientCampaignDrawerSectionProps {
  patientRut: string;
  patientName?: null | string;
  patientPhone?: null | string;
}

export function PatientCampaignDrawerSection({
  patientRut,
  patientName,
  patientPhone,
}: Readonly<PatientCampaignDrawerSectionProps>) {
  const toast = useToast();
  const { data: enrollments = [], isLoading: isLoadingEnrollments } =
    usePatientCampaignsByPatient(patientRut);
  const { data: campaigns = [], isLoading: isLoadingCampaigns } = usePatientCampaigns();
  const upsertMutation = useUpsertCampaignRecipient();
  const updateStatusMutation = useUpdateRecipientStatus();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

  const enrolledCampaignIds = useMemo(
    () => new Set(enrollments.map((r) => r.campaignId)),
    [enrollments]
  );

  const availableCampaigns = useMemo(
    () => campaigns.filter((c) => c.isActive && !enrolledCampaignIds.has(c.id)),
    [campaigns, enrolledCampaignIds]
  );

  const handleEnroll = async () => {
    const campaignId = Number(selectedCampaignId);
    if (!campaignId) {
      toast.error("Selecciona una campaña");
      return;
    }
    try {
      await upsertMutation.mutateAsync({
        campaignId,
        patientRut,
        patientName: patientName ?? undefined,
        patientPhone: patientPhone ?? undefined,
        status: "SENT",
      });
      toast.success("Paciente registrado en la campaña");
      setSelectedCampaignId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al registrar en campaña");
    }
  };

  const handleStatusChange = async (
    recipientId: number,
    status: PatientCampaignRecipientStatus
  ) => {
    try {
      await updateStatusMutation.mutateAsync({ id: recipientId, status });
      toast.success("Estado actualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar estado");
    }
  };

  const isLoading = isLoadingEnrollments || isLoadingCampaigns;

  return (
    <div className="space-y-3">
      {isLoading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : (
        <>
          {enrollments.length === 0 ? (
            <p className="text-xs text-foreground-400 italic">
              Este paciente aún no ha recibido campañas.
            </p>
          ) : (
            <div className="space-y-2">
              {enrollments.map((recipient) => (
                <Surface key={recipient.id} className="p-2 rounded-lg space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{recipient.campaign.name}</p>
                      {recipient.sentAt && (
                        <p className="text-xs text-foreground-400">
                          Enviado: {new Date(recipient.sentAt).toLocaleDateString("es-CL")}
                        </p>
                      )}
                    </div>
                    <Chip
                      size="sm"
                      color={PATIENT_CAMPAIGN_STATUS_COLORS[recipient.status]}
                      variant="soft"
                    >
                      {PATIENT_CAMPAIGN_STATUS_LABELS[recipient.status]}
                    </Chip>
                  </div>
                  <Dropdown>
                    <Dropdown.Trigger>
                      <Button size="sm" variant="outline" className="w-full justify-start">
                        Cambiar estado
                      </Button>
                    </Dropdown.Trigger>
                    <Dropdown.Popover>
                      <Dropdown.Menu
                        onAction={(key) =>
                          void handleStatusChange(
                            recipient.id,
                            String(key) as PatientCampaignRecipientStatus
                          )
                        }
                      >
                        {PATIENT_CAMPAIGN_STATUSES.map((status) => (
                          <Dropdown.Item
                            id={status}
                            key={status}
                            textValue={PATIENT_CAMPAIGN_STATUS_LABELS[status]}
                          >
                            <div className="flex items-center gap-2">
                              {recipient.status === status && <Check size={14} />}
                              {PATIENT_CAMPAIGN_STATUS_LABELS[status]}
                            </div>
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </Surface>
              ))}
            </div>
          )}

          {availableCampaigns.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs text-foreground-400">Agregar a una campaña</p>
                <div className="flex gap-2">
                  <Select
                    className="flex-1"
                    value={selectedCampaignId || "__placeholder__"}
                    onChange={(val) => {
                      const str = String(val ?? "");
                      setSelectedCampaignId(str === "__placeholder__" ? "" : str);
                    }}
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="__placeholder__" key="__placeholder__">
                          Selecciona una campaña
                        </ListBox.Item>
                        {availableCampaigns.map((campaign) => (
                          <ListBox.Item id={String(campaign.id)} key={campaign.id}>
                            {campaign.name}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <Button
                    size="sm"
                    variant="primary"
                    isPending={upsertMutation.isPending}
                    isDisabled={!selectedCampaignId}
                    onPress={() => void handleEnroll()}
                  >
                    <Plus size={14} />
                    Agregar
                  </Button>
                </div>
              </div>
            </>
          )}

          {availableCampaigns.length === 0 && campaigns.length > 0 && enrollments.length > 0 && (
            <p className="text-xs text-foreground-300 italic">
              Paciente incluido en todas las campañas activas.
            </p>
          )}

          {campaigns.length === 0 && (
            <p className="text-xs text-foreground-300 italic">
              No hay campañas activas. Crea una en la sección de campañas.
            </p>
          )}
        </>
      )}
    </div>
  );
}
