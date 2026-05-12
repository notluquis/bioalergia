import { Button, Card, Chip, Modal, ProgressBar, Spinner, Table } from "@heroui/react";
import { CalendarClock, Megaphone, Play, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppDateTimePicker } from "@/components/forms/AppDatePicker";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { SelectInput, TextAreaInput, TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import {
  useAccounts,
  useBroadcast,
  useBroadcasts,
  useCancelBroadcast,
  useCreateBroadcast,
  useStartBroadcast,
  useTemplates,
} from "../hooks/useWaCloud";

const STATUS_COLOR: Record<string, "success" | "warning" | "danger" | "default" | "accent"> = {
  DRAFT: "default",
  QUEUED: "warning",
  SENDING: "accent",
  DONE: "success",
  CANCELLED: "default",
  FAILED: "danger",
};

export function WaCloudBroadcastsPage() {
  const list = useBroadcasts();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-lg">
          <Megaphone size={18} className="text-success" />
          Campañas / Broadcasts
        </h2>
        <Button onPress={() => setCreateOpen(true)}>
          <Plus size={14} />
          Nueva campaña
        </Button>
      </div>

      {list.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner aria-label="Cargando" />
        </div>
      ) : (list.data?.broadcasts.length ?? 0) === 0 ? (
        <Card>
          <Card.Content className="p-8 text-center text-default-500 text-sm">
            Sin campañas todavía. Crea una para enviar plantillas a múltiples contactos.
          </Card.Content>
        </Card>
      ) : (
        <Card>
          <Card.Content className="p-0">
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Campañas">
                  <Table.Header>
                    <Table.Column isRowHeader>Nombre</Table.Column>
                    <Table.Column>Plantilla</Table.Column>
                    <Table.Column>Estado</Table.Column>
                    <Table.Column>Progreso</Table.Column>
                    <Table.Column>Programada</Table.Column>
                    <Table.Column>Acciones</Table.Column>
                  </Table.Header>
                  <Table.Body items={list.data?.broadcasts ?? []}>
                    {(b) => (
                      <Table.Row id={String(b.id)}>
                        <Table.Cell>
                          <button
                            type="button"
                            className="text-left font-medium text-accent hover:underline"
                            onClick={() => setSelectedId(b.id)}
                          >
                            {b.name}
                          </button>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="font-mono text-xs">
                            {b.templateName} · {b.templateLanguage}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" color={STATUS_COLOR[b.status]} variant="soft">
                            <Chip.Label>{b.status}</Chip.Label>
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>
                          <ProgressLine
                            sent={b.sentCount}
                            failed={b.failedCount}
                            total={b.totalRecipients}
                          />
                        </Table.Cell>
                        <Table.Cell>
                          {b.scheduledAt ? (
                            <span className="font-mono text-default-600 text-xs">
                              {new Date(b.scheduledAt).toLocaleString("es-CL", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          ) : (
                            <span className="text-default-400 text-xs">—</span>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <BroadcastActions broadcastId={b.id} status={b.status} />
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

      {selectedId && <BroadcastDetail id={selectedId} onClose={() => setSelectedId(null)} />}

      <CreateBroadcastModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function ProgressLine({ sent, failed, total }: { sent: number; failed: number; total: number }) {
  const pct = total > 0 ? Math.floor(((sent + failed) / total) * 100) : 0;
  return (
    <div className="min-w-[180px] space-y-0.5">
      <ProgressBar value={pct} maxValue={100} aria-label={`${pct}%`} className="h-2 w-full" />
      <p className="font-mono text-default-500 text-xs">
        {sent} / {total} enviados{" "}
        {failed > 0 && <span className="text-danger">· {failed} fail</span>}
      </p>
    </div>
  );
}

function BroadcastActions({ broadcastId, status }: { broadcastId: number; status: string }) {
  const start = useStartBroadcast();
  const cancel = useCancelBroadcast();
  const canStart = status === "DRAFT";
  const canCancel = status === "DRAFT" || status === "QUEUED" || status === "SENDING";
  return (
    <div className="flex gap-1">
      {canStart && (
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Iniciar"
          isPending={start.isPending}
          onPress={() => start.mutate(broadcastId)}
        >
          <Play size={12} />
        </Button>
      )}
      {canCancel && (
        <Button
          size="sm"
          variant="danger-soft"
          isIconOnly
          aria-label="Cancelar"
          isPending={cancel.isPending}
          onPress={async () => {
            const ok = await confirmAction({
              title: "Cancelar campaña",
              description:
                "Los destinatarios pendientes no recibirán el mensaje. Esta acción no se puede deshacer.",
              confirmLabel: "Cancelar campaña",
              cancelLabel: "Volver",
              variant: "danger",
            });
            if (!ok) return;
            cancel.mutate(broadcastId);
          }}
        >
          <X size={12} />
        </Button>
      )}
    </div>
  );
}

function BroadcastDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const detail = useBroadcast(id);

  return (
    <Card>
      <Card.Header className="flex items-center justify-between">
        <div>
          <Card.Title>{detail.data?.broadcast.name ?? "Cargando…"}</Card.Title>
          <Card.Description>Detalle por destinatario</Card.Description>
        </div>
        <Button isIconOnly size="sm" variant="outline" onPress={onClose} aria-label="Cerrar">
          <X size={14} />
        </Button>
      </Card.Header>
      <Card.Content>
        {detail.isLoading || !detail.data ? (
          <div className="flex justify-center py-6">
            <Spinner size="sm" />
          </div>
        ) : (
          <Table>
            <Table.ScrollContainer className="max-h-96">
              <Table.Content aria-label="Destinatarios">
                <Table.Header>
                  <Table.Column isRowHeader>Teléfono</Table.Column>
                  <Table.Column>Variables</Table.Column>
                  <Table.Column>Estado</Table.Column>
                  <Table.Column>Error</Table.Column>
                </Table.Header>
                <Table.Body items={detail.data.recipients}>
                  {(r) => (
                    <Table.Row id={String(r.id)}>
                      <Table.Cell>
                        <span className="font-mono text-xs">{r.phoneE164}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-default-600 text-xs">
                          {r.variables.length > 0 ? r.variables.join(" · ") : "—"}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip
                          size="sm"
                          color={
                            r.status === "SENT"
                              ? "success"
                              : r.status === "FAILED"
                                ? "danger"
                                : r.status === "SKIPPED"
                                  ? "warning"
                                  : "default"
                          }
                          variant="soft"
                        >
                          <Chip.Label>{r.status}</Chip.Label>
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="line-clamp-1 text-danger text-xs">
                          {r.errorMessage ?? ""}
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}
      </Card.Content>
    </Card>
  );
}

function CreateBroadcastModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const accounts = useAccounts();
  const create = useCreateBroadcast();
  const [accountId, setAccountId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const templates = useTemplates(accountId ? Number(accountId) : undefined);
  const [tplKey, setTplKey] = useState("");
  const [name, setName] = useState("");
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [rateLimit, setRateLimit] = useState("5");

  useEffect(() => {
    if (!isOpen) {
      setAccountId("");
      setPhoneNumberId("");
      setTplKey("");
      setName("");
      setRecipientsRaw("");
      setScheduledAt("");
      setRateLimit("5");
    }
  }, [isOpen]);

  const accountOptions = [
    { value: "", label: "Selecciona cuenta" },
    ...(accounts.data?.accounts ?? []).map((a) => ({
      value: String(a.id),
      label: a.displayName ?? a.wabaId,
    })),
  ];

  const phoneOptions = useMemo(() => {
    const acc = accounts.data?.accounts.find((a) => String(a.id) === accountId);
    return [
      { value: "", label: "Selecciona número" },
      ...(acc?.phoneNumbers ?? []).map((p) => ({
        value: String(p.id),
        label: p.label ?? p.displayPhoneNumber,
      })),
    ];
  }, [accounts.data, accountId]);

  const tplOptions = useMemo(
    () => [
      { value: "", label: "Selecciona plantilla aprobada" },
      ...(templates.data?.templates ?? [])
        .filter((t) => t.status === "APPROVED")
        .map((t) => ({
          value: `${t.name}|${t.language}`,
          label: `${t.name} (${t.language})`,
        })),
    ],
    [templates.data]
  );

  const parseRecipients = () => {
    const lines = recipientsRaw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.map((line) => {
      const parts = line.split(/[,;\t]/).map((p) => p.trim());
      const phone = parts[0]!;
      const variables = parts.slice(1);
      return { phoneE164: phone, variables };
    });
  };

  const submit = async () => {
    if (!accountId || !phoneNumberId) {
      toast.error("Selecciona cuenta + número");
      return;
    }
    if (!tplKey) {
      toast.error("Selecciona plantilla");
      return;
    }
    if (!name.trim()) {
      toast.error("Nombre obligatorio");
      return;
    }
    const recipients = parseRecipients();
    if (recipients.length === 0) {
      toast.error("Sin destinatarios");
      return;
    }
    const [tplName, tplLang] = tplKey.split("|");
    try {
      await create.mutateAsync({
        accountId: Number(accountId),
        phoneNumberId: Number(phoneNumberId),
        name: name.trim(),
        templateName: tplName!,
        templateLanguage: tplLang!,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        rateLimitPerSecond: Number(rateLimit) || 5,
        recipients,
      });
      toast.success(
        scheduledAt
          ? `Campaña creada y programada (${recipients.length} destinatarios)`
          : `Campaña creada en DRAFT (${recipients.length} destinatarios). Click ▶ para iniciar.`
      );
      onClose();
    } catch (err) {
      toast.error(`Error: ${String(err)}`);
    }
  };

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(o) => !o && onClose()}
        isDismissable
        className="bg-black/40 backdrop-blur-[2px]"
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                Nueva campaña
              </Modal.Heading>
              <p className="text-default-500 text-xs">
                Recuerda: marketing requiere opt-in. Auth/Utility no requieren ventana 24h pero sí
                plantilla aprobada.
              </p>
            </Modal.Header>
            <Modal.Body className="max-h-[70vh] space-y-3 overflow-y-auto">
              <TextInput
                label="Nombre"
                value={name}
                onValueChange={setName}
                placeholder="Recordatorio cita Mayo"
              />
              <div className="grid grid-cols-2 gap-3">
                <SelectInput
                  label="Cuenta WABA"
                  value={accountId}
                  onValueChange={(v) => {
                    setAccountId(v);
                    setPhoneNumberId("");
                    setTplKey("");
                  }}
                  options={accountOptions}
                />
                <SelectInput
                  label="Enviar desde"
                  value={phoneNumberId}
                  onValueChange={setPhoneNumberId}
                  options={phoneOptions}
                />
              </div>
              <SelectInput
                label="Plantilla"
                value={tplKey}
                onValueChange={setTplKey}
                options={tplOptions}
              />
              <div className="grid grid-cols-2 gap-3">
                <AppDateTimePicker
                  label="Programar (opcional)"
                  value={scheduledAt}
                  onChange={setScheduledAt}
                />
                <TextInput
                  label="Rate limit (msg/seg)"
                  value={rateLimit}
                  onValueChange={setRateLimit}
                  placeholder="5"
                />
              </div>
              <TextAreaInput
                label="Destinatarios (uno por línea: teléfono[,var1,var2,…])"
                value={recipientsRaw}
                onValueChange={setRecipientsRaw}
                placeholder={
                  "+56912345678,Juan,2026-05-12 10:00\n+56987654321,María,2026-05-12 11:30"
                }
                rows={8}
              />
              <p className="text-default-500 text-xs">
                Variables se mapean a {"{{1}}"}, {"{{2}}"}, … en la plantilla.
              </p>
            </Modal.Body>
            <Modal.Footer className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onPress={onClose}>
                <X size={14} />
                Cancelar
              </Button>
              <Button onPress={submit} isPending={create.isPending}>
                {scheduledAt ? <CalendarClock size={14} /> : <Plus size={14} />}
                {scheduledAt ? "Crear y programar" : "Crear borrador"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
