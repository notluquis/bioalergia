import {
  Button,
  Card,
  Chip,
  FieldError,
  Input,
  Label,
  Skeleton,
  TextArea,
  TextField,
} from "@heroui/react";
import { Mail, Send, Users } from "lucide-react";
import { useState } from "react";
import { useConfirmDialog } from "@/context/ConfirmDialogContext";
import { useToast } from "@/context/ToastContext";
import { PAGE_CONTAINER_RELAXED } from "@/lib/styles";
import { useBroadcastRecipientsCount, useSendBroadcast, useSendTestEmail } from "../queries";

export function EmailBroadcastPage() {
  const toast = useToast();
  const confirm = useConfirmDialog();
  const { data: recipientCount, isLoading: countLoading } = useBroadcastRecipientsCount();
  const sendBroadcast = useSendBroadcast();
  const sendTest = useSendTestEmail();

  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [testTo, setTestTo] = useState("");

  const subjectValid = subject.trim().length > 0;
  const htmlValid = html.trim().length > 0;
  const canSend = subjectValid && htmlValid && (recipientCount ?? 0) > 0;

  const handleTest = async () => {
    if (!testTo.trim()) return;
    try {
      await sendTest.mutateAsync({
        to: testTo.trim(),
        subject: subject.trim() || "Prueba Bioalergia",
        message: html.trim() || "Correo de prueba desde el sistema.",
      });
      toast.success(`Correo de prueba enviado a ${testTo.trim()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al enviar prueba");
    }
  };

  const handleSend = async () => {
    const confirmed = await confirm({
      confirmLabel: "Enviar a todos",
      confirmVariant: "primary",
      description: `Se enviará "${subject.trim()}" a ${recipientCount ?? 0} pacientes suscritos. No se puede deshacer.`,
      isDismissable: true,
      status: "warning",
      title: "Confirmar envío",
    });
    if (!confirmed) return;
    try {
      const result = await sendBroadcast.mutateAsync({
        subject: subject.trim(),
        html: html.trim(),
        dryRun: false,
      });
      toast.success(
        `Enviado: ${result.sent} ok, ${result.failed} fallidos de ${result.recipients}`
      );
      setSubject("");
      setHtml("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al enviar campaña");
    }
  };

  return (
    <section className={PAGE_CONTAINER_RELAXED}>
      <div className="flex items-center gap-2 text-default-600 text-sm">
        <Users size={16} />
        {countLoading ? (
          <Skeleton className="h-5 w-40 rounded" />
        ) : (
          <span>
            <strong>{recipientCount ?? 0}</strong> pacientes suscritos (con email, opt-in, sin baja)
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="border-none bg-background shadow-sm">
          <Card.Header>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Mail size={16} /> Nueva campaña
            </h2>
          </Card.Header>
          <Card.Content className="space-y-4 p-4">
            <TextField value={subject} onChange={setSubject} isRequired isInvalid={!subjectValid}>
              <Label>Asunto</Label>
              <Input placeholder="Ej: Novedades de tu tratamiento — Junio" />
              {!subjectValid ? <FieldError>El asunto es obligatorio.</FieldError> : null}
            </TextField>

            <TextField value={html} onChange={setHtml} isRequired isInvalid={!htmlValid}>
              <Label>Contenido (HTML)</Label>
              <TextArea
                rows={12}
                placeholder={"<h1>Hola</h1>\n<p>Tu mensaje aquí. Se permite HTML básico.</p>"}
              />
              {!htmlValid ? <FieldError>El contenido es obligatorio.</FieldError> : null}
            </TextField>

            <p className="text-xs text-foreground-400">
              El HTML se sanitiza antes de enviar. Se agrega automáticamente el enlace de baja
              (List-Unsubscribe) requerido por Gmail/Yahoo.
            </p>

            <div className="flex justify-end">
              <Button
                variant="primary"
                isDisabled={!canSend || sendBroadcast.isPending}
                onPress={() => void handleSend()}
              >
                <Send className="mr-2" size={16} />
                {sendBroadcast.isPending ? "Enviando…" : `Enviar a ${recipientCount ?? 0}`}
              </Button>
            </div>
          </Card.Content>
        </Card>

        <Card className="border-none bg-background shadow-sm h-fit">
          <Card.Header>
            <h2 className="text-sm font-semibold text-primary">Enviar prueba</h2>
          </Card.Header>
          <Card.Content className="space-y-3 p-4">
            <p className="text-xs text-foreground-400">
              Manda el contenido actual a un correo tuyo para revisarlo antes del envío masivo.
            </p>
            <TextField value={testTo} onChange={setTestTo} type="email">
              <Label>Tu correo</Label>
              <Input placeholder="tucorreo@bioalergia.cl" />
            </TextField>
            <Button
              variant="secondary"
              className="w-full"
              isDisabled={!testTo.trim() || sendTest.isPending}
              onPress={() => void handleTest()}
            >
              {sendTest.isPending ? "Enviando…" : "Enviar prueba"}
            </Button>
            <div className="pt-2">
              <Chip size="sm" variant="soft" color="default">
                Gratis hasta 3.000/mes · 100/día
              </Chip>
            </div>
          </Card.Content>
        </Card>
      </div>
    </section>
  );
}
