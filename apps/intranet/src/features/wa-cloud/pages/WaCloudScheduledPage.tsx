import { Button, Card, Chip, Spinner, Table } from "@heroui/react";
import dayjs from "dayjs";
import { CalendarClock, X } from "lucide-react";
import { useState } from "react";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { SelectInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import { useAllScheduled, useCancelScheduled } from "../hooks/useWaCloud";

const STATUS_COLOR: Record<string, "success" | "warning" | "danger" | "default"> = {
  PENDING: "warning",
  SENT: "success",
  FAILED: "danger",
  CANCELLED: "default",
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "PENDING", label: "Pendientes" },
  { value: "SENT", label: "Enviados" },
  { value: "FAILED", label: "Fallidos" },
  { value: "CANCELLED", label: "Cancelados" },
];

export function WaCloudScheduledPage() {
  const [status, setStatus] = useState<"" | "PENDING" | "SENT" | "FAILED" | "CANCELLED">("");
  const all = useAllScheduled(
    status
      ? { status: status as "PENDING" | "SENT" | "FAILED" | "CANCELLED", limit: 200 }
      : undefined
  );
  const cancel = useCancelScheduled();
  const items = all.data?.scheduled ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-lg">
          <CalendarClock size={18} className="text-warning" />
          Mensajes programados
        </h2>
        <div className="w-56">
          <SelectInput
            label=""
            value={status}
            onValueChange={(v) => setStatus(v as "" | "PENDING" | "SENT" | "FAILED" | "CANCELLED")}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      {all.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner aria-label="Cargando" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <Card.Content className="p-8 text-center text-default-500 text-sm">
            Sin mensajes programados.
          </Card.Content>
        </Card>
      ) : (
        <Card>
          <Card.Content className="p-0">
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Programados">
                  <Table.Header>
                    <Table.Column isRowHeader>Fecha</Table.Column>
                    <Table.Column>Contacto</Table.Column>
                    <Table.Column>Tipo</Table.Column>
                    <Table.Column>Mensaje</Table.Column>
                    <Table.Column>Estado</Table.Column>
                    <Table.Column>Acción</Table.Column>
                  </Table.Header>
                  <Table.Body items={items}>
                    {(s) => (
                      <Table.Row id={String(s.id)}>
                        <Table.Cell>
                          <span className="font-mono text-default-700 text-xs">
                            {dayjs(s.scheduledAt).format("DD-MM HH:mm")}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-sm">
                              {s.contactName ?? s.phoneE164}
                            </p>
                            <p className="font-mono text-default-400 text-xs">{s.phoneE164}</p>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" variant="soft" color="default">
                            <Chip.Label>{s.type}</Chip.Label>
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>
                          <p className="line-clamp-2 max-w-md text-default-700 text-xs">
                            {s.body ?? (s.templateName ? `[plantilla] ${s.templateName}` : "—")}
                          </p>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" color={STATUS_COLOR[s.status]} variant="soft">
                            <Chip.Label>{s.status}</Chip.Label>
                          </Chip>
                          {s.errorMessage && (
                            <p className="mt-0.5 line-clamp-1 text-danger text-xs">
                              {s.errorMessage}
                            </p>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          {s.status === "PENDING" && (
                            <Button
                              size="sm"
                              variant="danger-soft"
                              isIconOnly
                              aria-label="Cancelar"
                              isPending={cancel.isPending}
                              onPress={async () => {
                                const ok = await confirmAction({
                                  title: "Cancelar envío programado",
                                  description:
                                    "El mensaje no se enviará. Esta acción no se puede deshacer.",
                                  confirmLabel: "Cancelar envío",
                                  cancelLabel: "Volver",
                                  variant: "danger",
                                });
                                if (!ok) return;
                                cancel.mutate(s.id, {
                                  onSuccess: () => toast.success("Cancelado"),
                                  onError: (e) => toast.error(`Error: ${String(e)}`),
                                });
                              }}
                            >
                              <X size={12} />
                            </Button>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Card.Content>
        </Card>
      )}
    </div>
  );
}
