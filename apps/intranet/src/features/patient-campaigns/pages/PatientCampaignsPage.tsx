import { Button, Card, Chip, Skeleton, Surface } from "@heroui/react";
import { Megaphone, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useConfirmDialog } from "@/context/ConfirmDialogContext";
import { useToast } from "@/context/ToastContext";
import { useDisclosure } from "@/hooks/use-disclosure";
import { PAGE_CONTAINER_RELAXED } from "@/lib/styles";
import { CampaignFormModal } from "../components/CampaignFormModal";
import { CampaignRecipientsPanel } from "../components/CampaignRecipientsPanel";
import { useDeletePatientCampaign, usePatientCampaigns } from "../queries";
import {
  PATIENT_CAMPAIGN_STATUS_COLORS,
  PATIENT_CAMPAIGN_STATUS_LABELS,
  PATIENT_CAMPAIGN_STATUSES,
  type PatientCampaignWithCounts,
} from "../types";

export function PatientCampaignsPage() {
  const toast = useToast();
  const confirm = useConfirmDialog();
  const { data: campaigns = [], isLoading } = usePatientCampaigns({ includeInactive: true });
  const deleteMutation = useDeletePatientCampaign();
  const { isOpen: formOpen, open: openForm, close: closeForm } = useDisclosure();
  const [editingCampaign, setEditingCampaign] = useState<null | PatientCampaignWithCounts>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<null | number>(null);

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );

  const handleCreate = () => {
    setEditingCampaign(null);
    openForm();
  };

  const handleEdit = (campaign: PatientCampaignWithCounts) => {
    setEditingCampaign(campaign);
    openForm();
  };

  const handleDelete = async (campaign: PatientCampaignWithCounts) => {
    const confirmed = await confirm({
      confirmLabel: "Eliminar campaña",
      confirmVariant: "danger",
      description: `La campaña "${campaign.name}" se eliminará permanentemente. Esta acción no se puede deshacer.`,
      isDismissable: true,
      isKeyboardDismissDisabled: false,
      status: "danger",
      title: "Eliminar campaña",
    });
    if (!confirmed) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(campaign.id);
      toast.success("Campaña eliminada");
      if (selectedCampaignId === campaign.id) {
        setSelectedCampaignId(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al eliminar campaña");
    }
  };

  return (
    <section className={PAGE_CONTAINER_RELAXED}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-default-600 text-sm">
          <Megaphone size={16} />
          <span>{campaigns.length} campañas registradas</span>
        </div>
        <Button variant="primary" onPress={handleCreate}>
          <Plus className="mr-2" size={18} />
          Nueva campaña
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="border-none bg-background shadow-sm">
          <Card.Content className="p-4 space-y-3">
            <h2 className="text-sm font-semibold text-primary">Campañas</h2>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : campaigns.length === 0 ? (
              <p className="text-xs text-foreground-400 italic">
                Aún no hay campañas. Crea la primera para comenzar.
              </p>
            ) : (
              <div className="space-y-2">
                {campaigns.map((campaign) => {
                  const isSelected = selectedCampaignId === campaign.id;
                  return (
                    <Surface
                      key={campaign.id}
                      className={`p-3 rounded-xl transition-colors ${
                        isSelected ? "ring-2 ring-primary bg-primary/5" : "bg-default-50/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{campaign.name}</p>
                          {campaign.description && (
                            <p className="text-[11px] text-foreground-400 line-clamp-2 mt-0.5">
                              {campaign.description}
                            </p>
                          )}
                        </div>
                        {!campaign.isActive && (
                          <Chip size="sm" color="default" variant="soft">
                            Inactiva
                          </Chip>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-foreground-500">
                        <Users size={12} />
                        <span>{campaign.totalRecipients} destinatarios</span>
                      </div>
                      {campaign.totalRecipients > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {PATIENT_CAMPAIGN_STATUSES.map((status) => {
                            const count = campaign.statusCounts[status];
                            if (count === 0) return null;
                            return (
                              <Chip
                                key={status}
                                size="sm"
                                color={PATIENT_CAMPAIGN_STATUS_COLORS[status]}
                                variant="soft"
                              >
                                {PATIENT_CAMPAIGN_STATUS_LABELS[status]}: {count}
                              </Chip>
                            );
                          })}
                        </div>
                      )}
                      <div className="mt-2 flex gap-1">
                        <Button
                          size="sm"
                          variant={isSelected ? "secondary" : "ghost"}
                          onPress={() => setSelectedCampaignId(campaign.id)}
                        >
                          Ver
                        </Button>
                        <Button size="sm" variant="outline" onPress={() => handleEdit(campaign)}>
                          <Pencil size={12} />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() => void handleDelete(campaign)}
                        >
                          <Trash2 size={12} />
                          Eliminar
                        </Button>
                      </div>
                    </Surface>
                  );
                })}
              </div>
            )}
          </Card.Content>
        </Card>

        <Card className="border-none bg-background shadow-sm">
          <Card.Content className="p-4">
            {selectedCampaign ? (
              <CampaignRecipientsPanel campaign={selectedCampaign} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Megaphone className="text-foreground-300 mb-3" size={48} />
                <p className="text-sm text-foreground-400">
                  Selecciona una campaña para ver sus destinatarios
                </p>
              </div>
            )}
          </Card.Content>
        </Card>
      </div>

      <CampaignFormModal isOpen={formOpen} onClose={closeForm} campaign={editingCampaign} />
    </section>
  );
}
