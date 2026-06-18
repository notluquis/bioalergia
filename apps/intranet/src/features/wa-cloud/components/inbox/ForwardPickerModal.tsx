import { Button, Modal, Spinner } from "@heroui/react";
import { Forward, X } from "lucide-react";
import { useState } from "react";
import { useConversations } from "../../hooks/useWaCloud";

// Pick a destination conversation to forward a message into. Text-only for now
// (the parent re-sends the body via sendText); media forwarding would need a
// Meta media re-upload and is deferred.
export function ForwardPickerModal({
  isOpen,
  onClose,
  onForward,
  isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  onForward: (targetConversationId: number, targetPhoneNumberId: number | undefined) => void;
  isPending: boolean;
}) {
  const [q, setQ] = useState("");
  const list = useConversations({
    search: q.trim() || undefined,
    page: 1,
    pageSize: 30,
  });
  const items = list.data?.items ?? [];

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(o) => !o && onClose()}
        isDismissable
        className="bg-black/40 backdrop-blur-[2px]"
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-md rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                <Forward className="mr-2 inline" size={20} />
                Reenviar a…
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="max-h-[60vh] space-y-2 overflow-y-auto">
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.currentTarget.value)}
                placeholder="Buscar conversación…"
                aria-label="Buscar conversación"
                className="w-full rounded-lg border border-default-200 bg-content2 px-3 py-1.5 text-sm outline-none focus:border-success"
              />
              {list.isLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner size="sm" />
                </div>
              ) : items.length === 0 ? (
                <p className="py-6 text-center text-default-500 text-sm">Sin conversaciones.</p>
              ) : (
                items.map((c) => {
                  const name = c.contact.name ?? c.contact.pushName ?? c.contact.phoneE164;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={isPending}
                      onClick={() => onForward(c.id, c.channelPhoneNumberIds[0])}
                      className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-default-200 bg-content1 p-3 text-left transition hover:bg-content2 disabled:opacity-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">{name}</p>
                        <p className="truncate text-default-500 text-xs">{c.contact.phoneE164}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </Modal.Body>
            <Modal.Footer className="mt-3 flex justify-end">
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
