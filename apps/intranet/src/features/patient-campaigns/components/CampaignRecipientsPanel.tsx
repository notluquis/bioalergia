import {
  Button,
  Chip,
  Dropdown,
  InputGroup,
  ListBox,
  Select,
  Skeleton,
  Surface,
  TextField,
} from "@heroui/react";
import { Check, Phone, Search, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/context/ToastContext";
import { useDisclosure } from "@/hooks/use-disclosure";
import { formatRut } from "@/lib/rut";
import {
  useCampaignRecipients,
  useDeleteCampaignRecipient,
  useUpdateRecipientStatus,
} from "../queries";
import {
  PATIENT_CAMPAIGN_STATUS_COLORS,
  PATIENT_CAMPAIGN_STATUS_LABELS,
  PATIENT_CAMPAIGN_STATUSES,
  type PatientCampaignRecipientStatus,
  type PatientCampaignWithCounts,
} from "../types";
import { AddRecipientModal } from "./AddRecipientModal";

interface CampaignRecipientsPanelProps {
  campaign: PatientCampaignWithCounts;
}

export function CampaignRecipientsPanel({ campaign }: Readonly<CampaignRecipientsPanelProps>) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | PatientCampaignRecipientStatus>("");
  const { isOpen: addOpen, open: openAdd, close: closeAdd } = useDisclosure();

  const { data: recipients = [], isLoading } = useCampaignRecipients(campaign.id, {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(search.trim() ? { query: search.trim() } : {}),
  });

  const updateStatusMutation = useUpdateRecipientStatus();
  const deleteMutation = useDeleteCampaignRecipient();

  const handleStatusChange = async (
    recipientId: number,
    status: PatientCampaignRecipientStatus
  ) => {
    try {
      await updateStatusMutation.mutateAsync({ id: recipientId, status });
      toast.success("Estado actualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar");
    }
  };

  const handleDelete = async (recipientId: number, name: null | string) => {
    if (!window.confirm(`¿Eliminar destinatario${name ? ` "${name}"` : ""}?`)) return;
    try {
      await deleteMutation.mutateAsync(recipientId);
      toast.success("Destinatario eliminado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al eliminar");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{campaign.name}</h2>
          <p className="text-xs text-foreground-400">
            {campaign.totalRecipients} destinatarios en total
          </p>
        </div>
        <Button variant="primary" size="sm" onPress={openAdd}>
          <UserPlus size={14} />
          Agregar destinatario
        </Button>
      </div>

      {campaign.messageTemplate && (
        <Surface className="p-3 rounded-xl">
          <p className="text-[11px] text-foreground-400 mb-1">Mensaje</p>
          <p className="text-xs whitespace-pre-wrap">{campaign.messageTemplate}</p>
        </Surface>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <TextField className="flex-1" value={search} onChange={setSearch}>
          <InputGroup>
            <InputGroup.Input placeholder="Buscar por RUT, nombre o teléfono..." />
            <InputGroup.Suffix>
              <Search className="text-default-300" size={16} />
            </InputGroup.Suffix>
          </InputGroup>
        </TextField>
        <Select
          className="sm:w-56"
          value={statusFilter || "__all__"}
          onChange={(val) => {
            const str = String(val ?? "__all__");
            setStatusFilter(str === "__all__" ? "" : (str as PatientCampaignRecipientStatus));
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="__all__" key="__all__">
                Todos los estados
              </ListBox.Item>
              {PATIENT_CAMPAIGN_STATUSES.map((status) => (
                <ListBox.Item id={status} key={status}>
                  {PATIENT_CAMPAIGN_STATUS_LABELS[status]}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : recipients.length === 0 ? (
        <p className="text-xs text-foreground-400 italic text-center py-8">
          {search || statusFilter
            ? "No hay destinatarios con esos filtros."
            : "Aún no hay destinatarios en esta campaña."}
        </p>
      ) : (
        <div className="space-y-2">
          {recipients.map((recipient) => (
            <Surface key={recipient.id} className="p-3 rounded-xl">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {recipient.patientName ?? (
                      <span className="italic text-foreground-400">Sin nombre</span>
                    )}
                  </p>
                  <p className="font-mono text-[11px] text-foreground-500">
                    {formatRut(recipient.patientRut)}
                  </p>
                  {recipient.patientPhone && (
                    <p className="text-[11px] text-foreground-400 flex items-center gap-1 mt-0.5">
                      <Phone size={10} />
                      {recipient.patientPhone}
                    </p>
                  )}
                  {recipient.sentAt && (
                    <p className="text-[11px] text-foreground-300 mt-0.5">
                      Enviado: {new Date(recipient.sentAt).toLocaleDateString("es-CL")}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Chip
                    size="sm"
                    color={PATIENT_CAMPAIGN_STATUS_COLORS[recipient.status]}
                    variant="soft"
                  >
                    {PATIENT_CAMPAIGN_STATUS_LABELS[recipient.status]}
                  </Chip>
                  <div className="flex gap-1">
                    <Dropdown>
                      <Dropdown.Trigger>
                        <Button size="sm" variant="ghost">
                          Cambiar
                        </Button>
                      </Dropdown.Trigger>
                      <Dropdown.Popover>
                        <ListBox
                          onAction={(key) =>
                            void handleStatusChange(
                              recipient.id,
                              String(key) as PatientCampaignRecipientStatus
                            )
                          }
                        >
                          {PATIENT_CAMPAIGN_STATUSES.map((status) => (
                            <ListBox.Item
                              id={status}
                              key={status}
                              textValue={PATIENT_CAMPAIGN_STATUS_LABELS[status]}
                            >
                              <div className="flex items-center gap-2">
                                {recipient.status === status && <Check size={12} />}
                                {PATIENT_CAMPAIGN_STATUS_LABELS[status]}
                              </div>
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Dropdown.Popover>
                    </Dropdown>
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => void handleDelete(recipient.id, recipient.patientName)}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              </div>
              {recipient.notes && (
                <p className="mt-2 text-[11px] text-foreground-500 italic">{recipient.notes}</p>
              )}
            </Surface>
          ))}
        </div>
      )}

      <AddRecipientModal isOpen={addOpen} onClose={closeAdd} campaignId={campaign.id} />
    </div>
  );
}
