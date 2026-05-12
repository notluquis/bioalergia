// oxlint-disable typescript/no-non-null-assertion -- TODO(strict-null): refactor each `!` to invariant() or explicit guard. Tracked in repo-wide non-null cleanup.
import { Button, Chip, Modal, Spinner } from "@heroui/react";
import { Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import {
  useAccounts,
  useCommerceProducts,
  useSendMultiProduct,
  useSendSingleProduct,
} from "../hooks/useWaCloud";

// Composer modal: pick products from the linked Meta Commerce catalog
// and send as either a single-product or a multi-product (MPM)
// interactive message. Single-section MPM only (one section is plenty
// for a clinic; multi-section can be added later).
export function CommerceSelectorModal({
  isOpen,
  onClose,
  conversationId,
  phoneNumberId,
}: {
  isOpen: boolean;
  onClose: () => void;
  conversationId: number;
  phoneNumberId: number | null;
}) {
  const accounts = useAccounts();
  const accountId = useMemo(() => {
    if (!phoneNumberId || !accounts.data) return undefined;
    for (const a of accounts.data.accounts) {
      if (a.phoneNumbers.some((p) => p.id === phoneNumberId)) return a.id;
    }
    return undefined;
  }, [phoneNumberId, accounts.data]);

  const products = useCommerceProducts(accountId ? { accountId, limit: 100 } : undefined);
  const items = products.data?.products ?? [];
  const catalogConfigured = Boolean(products.data?.catalogId);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [headerText, setHeaderText] = useState("Productos disponibles");
  const [bodyText, setBodyText] = useState("Selecciona uno para más info.");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSelected(new Set());
      setSearch("");
    }
  }, [isOpen]);

  const sendSingle = useSendSingleProduct();
  const sendMulti = useSendMultiProduct();

  const toggle = (retailerId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(retailerId)) next.delete(retailerId);
      else if (next.size >= 30) {
        toast.error("Máximo 30 productos por mensaje");
        return prev;
      } else next.add(retailerId);
      return next;
    });

  const filtered = items.filter((p) =>
    search ? p.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  const send = () => {
    if (!phoneNumberId) {
      toast.error("Selecciona un número primero");
      return;
    }
    if (selected.size === 0) {
      toast.error("Selecciona al menos 1 producto");
      return;
    }
    if (selected.size === 1) {
      const retailerId = Array.from(selected)[0]!;
      sendSingle.mutate(
        {
          conversationId,
          phoneNumberId,
          productRetailerId: retailerId,
          bodyText: bodyText.trim() || undefined,
        },
        {
          onSuccess: () => {
            toast.success("Producto enviado");
            onClose();
          },
          onError: (e) => toast.error(`Error: ${String(e)}`),
        }
      );
    } else {
      sendMulti.mutate(
        {
          conversationId,
          phoneNumberId,
          headerText: headerText.trim().slice(0, 60) || "Productos",
          bodyText: bodyText.trim() || "Selecciona uno",
          sections: [
            {
              title: "Disponibles",
              product_items: Array.from(selected).map((retailer_id) => ({
                product_retailer_id: retailer_id,
              })),
            },
          ],
        },
        {
          onSuccess: () => {
            toast.success(`${selected.size} productos enviados`);
            onClose();
          },
          onError: (e) => toast.error(`Error: ${String(e)}`),
        }
      );
    }
  };

  const isPending = sendSingle.isPending || sendMulti.isPending;

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(o) => !o && onClose()}
        isDismissable
        className="bg-black/40 backdrop-blur-[2px]"
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-3xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                Enviar producto(s) del catálogo
              </Modal.Heading>
              <p className="text-default-500 text-xs">
                1 producto = mensaje simple. 2+ = multi-product (MPM, máx 30).
              </p>
            </Modal.Header>
            <Modal.Body className="max-h-[70vh] space-y-3 overflow-y-auto">
              {!catalogConfigured ? (
                <p className="rounded-md bg-warning-50 p-3 text-warning text-sm">
                  La cuenta no tiene catálogo Meta Commerce configurado. Ve a Ajustes WA → Catálogo
                  Commerce.
                </p>
              ) : (
                <>
                  <TextInput
                    label="Buscar producto"
                    value={search}
                    onValueChange={setSearch}
                    placeholder="nombre…"
                  />
                  {selected.size > 1 && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <TextInput
                        label="Header (MPM, máx 60)"
                        value={headerText}
                        onValueChange={setHeaderText}
                      />
                      <TextInput label="Body" value={bodyText} onValueChange={setBodyText} />
                    </div>
                  )}
                  {selected.size === 1 && (
                    <TextInput
                      label="Body (opcional)"
                      value={bodyText}
                      onValueChange={setBodyText}
                    />
                  )}
                  {products.isLoading ? (
                    <div className="flex justify-center py-12">
                      <Spinner aria-label="Cargando" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="py-12 text-center text-default-500 text-sm">Sin productos.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {filtered.map((p) => {
                        const isSel = selected.has(p.retailer_id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggle(p.retailer_id)}
                            className={`rounded-md border p-2 text-left transition ${
                              isSel
                                ? "border-success ring-2 ring-success bg-success-50"
                                : "border-default-200 bg-content1 hover:bg-content2"
                            }`}
                          >
                            {p.image_url && (
                              <img
                                src={p.image_url}
                                alt={p.name}
                                loading="lazy"
                                className="aspect-square w-full rounded object-cover"
                              />
                            )}
                            <p className="mt-1 line-clamp-1 font-medium text-xs">{p.name}</p>
                            <p className="font-mono text-xs text-default-500">{p.retailer_id}</p>
                            {p.price && (
                              <Chip size="sm" variant="soft" color="success" className="mt-1">
                                <Chip.Label>
                                  {p.price} {p.currency ?? ""}
                                </Chip.Label>
                              </Chip>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </Modal.Body>
            <Modal.Footer className="mt-4 flex items-center justify-between gap-2">
              <p className="text-default-500 text-xs">{selected.size} seleccionado(s)</p>
              <div className="flex gap-2">
                <Button variant="outline" onPress={onClose}>
                  <X size={14} />
                  Cancelar
                </Button>
                <Button
                  onPress={send}
                  isPending={isPending}
                  isDisabled={!catalogConfigured || selected.size === 0}
                >
                  <Send size={14} />
                  Enviar
                </Button>
              </div>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
