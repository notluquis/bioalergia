import { Button, Modal } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Paperclip, XCircle } from "lucide-react";
import { toast } from "@/lib/toast-interceptor";
import type { SharedPayload, SharedPayloadFile } from "../hooks/useSharedPayload";
import { uploadWaMedia, useConversation, useSendMedia, useSendText } from "../hooks/useWaCloud";
import {
  isLockHeldByAnotherTab,
  releaseSendLock,
  tryAcquireSendLock,
} from "../lib/share-send-lock";
import {
  buildSharedCaption,
  classifyFile,
  isHeic,
  tryConvertHeicToJpeg,
} from "../lib/wa-media-limits";

// Per-file state machine for the granular progress UI. Each file
// rendered in the list shows its own spinner / check / X based on
// this status.
type FileStatus = "idle" | "validating" | "uploading" | "sending" | "done" | "failed";
type FileEntry = {
  file: SharedPayloadFile;
  status: FileStatus;
  error?: string;
};

export function SharedPayloadModal({
  payload,
  conversationId,
  onClose,
  onClear,
}: {
  payload: SharedPayload;
  // Pre-selected conversation from the inbox state. Null means the
  // operator hasn't opened a chat yet → send button is disabled.
  conversationId: number | null;
  // Dismiss without clearing (operator may want to retry on a
  // different conversation).
  onClose: () => void;
  // Drop the CacheStorage entries and dismiss. Called only after a
  // fully successful send.
  onClear: () => void | Promise<void>;
}) {
  const conv = useConversation(conversationId ?? undefined);
  const sendMedia = useSendMedia();
  const sendText = useSendText();

  // Object URLs for image previews. Created once per file and revoked
  // on unmount so the modal doesn't leak blob: URLs.
  const previewUrls = useMemo(() => {
    return payload.files.map((f) =>
      f.type.startsWith("image/") ? URL.createObjectURL(f.blob) : null
    );
  }, [payload.files]);
  useEffect(() => {
    return () => {
      for (const url of previewUrls) if (url) URL.revokeObjectURL(url);
    };
  }, [previewUrls]);

  const [entries, setEntries] = useState<FileEntry[]>(() =>
    payload.files.map((file) => ({ file, status: "idle" }))
  );
  const [sending, setSending] = useState(false);
  // a11y live region — screen readers announce send progress on each
  // entry transition without focus shifts.
  const [liveMsg, setLiveMsg] = useState("");
  // Foreign-tab lock visibility. Polled while the modal is open so
  // the UI updates if another tab finishes or crashes.
  const [foreignLock, setForeignLock] = useState(() => isLockHeldByAnotherTab(payload.ts));
  useEffect(() => {
    const t = setInterval(() => {
      setForeignLock(isLockHeldByAnotherTab(payload.ts));
    }, 2000);
    return () => clearInterval(t);
  }, [payload.ts]);

  const updateEntry = (idx: number, patch: Partial<FileEntry>) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const windowOpen = conv.data?.windowOpen ?? false;
  // The "last channel used" is the canonical pick for outbound — the
  // operator's most recent send already proved it can reach this
  // contact through that phone. Falls back to the first channel.
  const phoneNumberId = conv.data?.channels[0]?.phoneNumberId;
  const contactName =
    conv.data?.contact?.name ?? conv.data?.contact?.phoneE164 ?? "esta conversación";

  // Persistent ref kept in sync with state so we can iterate the
  // latest entries inside the async send loop without stale closure
  // bugs (state updates batch; entries[] inside the loop would
  // capture the pre-send array).
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  async function handleSend() {
    if (!conversationId || !conv.data || !phoneNumberId) {
      toast.error("Abre primero la conversación destino.");
      return;
    }
    if (!windowOpen) {
      toast.error(
        "La ventana de 24 h está cerrada. WhatsApp solo permite mensajes de plantilla aquí — no se puede adjuntar el contenido compartido."
      );
      return;
    }
    if (!tryAcquireSendLock(payload.ts)) {
      toast.error("Otra pestaña ya está enviando este contenido.");
      setForeignLock(true);
      return;
    }
    setSending(true);
    setLiveMsg("Iniciando envío…");
    const failures: string[] = [];
    try {
      // Send the shared text FIRST as a standalone message, then
      // every media without caption. Matches the native WhatsApp
      // share-sheet UX (one text bubble + N media bubbles) and avoids
      // the "which file gets the caption?" ambiguity when the
      // operator shares 5 photos with one URL.
      const sharedCaption = buildSharedCaption({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      if (sharedCaption) {
        try {
          setLiveMsg("Enviando texto compartido…");
          await sendText.mutateAsync({
            conversationId,
            phoneNumberId,
            body: sharedCaption,
          });
        } catch (err) {
          failures.push(`texto compartido: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      for (let i = 0; i < payload.files.length; i++) {
        const entry = entriesRef.current[i];
        if (!entry) continue;
        // Skip files that already succeeded (retry path).
        if (entry.status === "done") continue;

        updateEntry(i, { status: "validating", error: undefined });
        setLiveMsg(`Validando ${i + 1} de ${payload.files.length}…`);

        // HEIC from iOS Photos: attempt Safari-native canvas
        // transcode to JPEG before validation. Non-Safari UAs return
        // null and we fall through to the classifyFile rejection.
        let workingBlob = entry.file.blob;
        let workingName = entry.file.name;
        let workingMime = entry.file.type;
        if (isHeic({ name: entry.file.name, type: entry.file.type })) {
          const converted = await tryConvertHeicToJpeg(entry.file.blob, entry.file.name);
          if (converted) {
            workingBlob = converted;
            workingName = converted.name;
            workingMime = converted.type;
          }
        }
        const meta = classifyFile({
          name: workingName,
          type: workingMime,
          size: workingBlob.size,
        });
        if (!meta.ok) {
          updateEntry(i, { status: "failed", error: meta.reason });
          failures.push(`${entry.file.name}: ${meta.reason}`);
          continue;
        }
        try {
          updateEntry(i, { status: "uploading" });
          setLiveMsg(`Subiendo ${i + 1} de ${payload.files.length}…`);
          // Reconstruct a File so the upload endpoint sees a proper
          // filename + corrected mime. Uses the (possibly HEIC-→-JPEG
          // converted) working blob, not the original.
          const fileObj = new File([workingBlob], workingName, {
            type: meta.mime,
          });
          const uploaded = await uploadWaMedia(fileObj, phoneNumberId);
          updateEntry(i, { status: "sending" });
          setLiveMsg(`Enviando ${i + 1} de ${payload.files.length}…`);
          await sendMedia.mutateAsync({
            conversationId,
            phoneNumberId,
            type: meta.type,
            mediaId: uploaded.id,
            filename: meta.type === "document" ? entry.file.name : undefined,
            // No caption: the shared text was sent as a separate
            // message above so every operator sees a single text
            // bubble followed by media bubbles (same as native WA
            // share). Avoids the "caption appears on random file"
            // ambiguity when sharing multiple images at once.
          });
          updateEntry(i, { status: "done" });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          updateEntry(i, { status: "failed", error: msg });
          failures.push(`${entry.file.name}: ${msg}`);
        }
      }

      if (failures.length === 0) {
        setLiveMsg("Envío completo.");
        toast.success("Contenido enviado.");
        await onClear();
      } else {
        setLiveMsg(`Envío parcial — ${failures.length} con error.`);
        toast.error(
          `${failures.length} archivo(s) no se pudieron enviar. Revisa la lista y reintenta.`
        );
      }
    } finally {
      releaseSendLock(payload.ts);
      setSending(false);
    }
  }

  const allDone = entries.length > 0 && entries.every((e) => e.status === "done");
  const totalFailed = entries.filter((e) => e.status === "failed").length;
  const canSend = !sending && !foreignLock && !!conversationId && windowOpen && !allDone;

  return (
    <Modal isOpen onOpenChange={(v) => !v && !sending && onClose()}>
      <Modal.Backdrop />
      <Modal.Container placement="center">
        <Modal.Dialog className="w-full max-w-lg rounded-2xl bg-background p-5 shadow-2xl">
          <Modal.Header className="mb-3 flex items-center gap-2">
            <Paperclip size={18} className="text-success" />
            <Modal.Heading className="font-semibold text-base">
              Enviar contenido compartido
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-3">
            <p className="text-default-700 text-sm">
              Destino:{" "}
              <span className="font-medium">
                {conversationId ? contactName : "selecciona una conversación primero"}
              </span>
            </p>

            {conversationId && !windowOpen && (
              <p className="rounded-lg bg-warning/10 p-2 text-warning text-xs">
                Ventana de 24 h cerrada. Para retomar la conversación envía una plantilla aprobada
                desde el composer y vuelve a compartir el contenido cuando el cliente responda.
              </p>
            )}

            {foreignLock && (
              <p className="rounded-lg bg-default/40 p-2 text-default-700 text-xs">
                Otra pestaña está enviando este contenido. Espera o ciérrala para tomar el control.
              </p>
            )}

            {(payload.title || payload.text || payload.url) && (
              <div className="space-y-1 rounded-lg border border-default-200 p-2">
                {payload.title && <p className="font-medium text-sm">{payload.title}</p>}
                {payload.text && (
                  <p className="whitespace-pre-wrap text-default-700 text-sm">{payload.text}</p>
                )}
                {payload.url && (
                  <a
                    href={payload.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary text-sm underline"
                  >
                    {payload.url}
                  </a>
                )}
              </div>
            )}

            {entries.length > 0 && (
              <ul className="space-y-2">
                {entries.map((e, i) => {
                  const url = previewUrls[i];
                  return (
                    <li
                      key={`${e.file.name}-${i}`}
                      className="flex items-center gap-3 rounded-lg border border-default-200 p-2"
                    >
                      {url ? (
                        <img
                          src={url}
                          alt={e.file.name}
                          className="size-12 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <Paperclip size={20} className="shrink-0 text-default-500" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">{e.file.name}</p>
                        <p className="text-default-500 text-xs">
                          {e.file.type || "tipo desconocido"} · {(e.file.size / 1024).toFixed(1)} kB
                        </p>
                        {e.error && <p className="text-danger text-xs">{e.error}</p>}
                      </div>
                      <FileStatusIcon status={e.status} />
                    </li>
                  );
                })}
              </ul>
            )}

            <div aria-live="polite" className="sr-only">
              {liveMsg}
            </div>
          </Modal.Body>
          <Modal.Footer className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onPress={onClose} isDisabled={sending}>
              {allDone ? "Cerrar" : "Cancelar"}
            </Button>
            {totalFailed > 0 && !sending && (
              <Button variant="outline" onPress={handleSend}>
                Reintentar fallidos
              </Button>
            )}
            {!allDone && (
              <Button
                variant="primary"
                isDisabled={!canSend}
                isLoading={sending}
                onPress={handleSend}
              >
                Enviar a {contactName}
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal>
  );
}

function FileStatusIcon({ status }: { status: FileStatus }) {
  if (status === "done") return <CheckCircle2 size={18} className="text-success" />;
  if (status === "failed") return <XCircle size={18} className="text-danger" />;
  if (status === "validating" || status === "uploading" || status === "sending") {
    return <Loader2 size={18} className="animate-spin text-primary" />;
  }
  return <AlertCircle size={18} className="text-default-400" />;
}
