import { Button, Drawer, Popover, Skeleton } from "@heroui/react";
import { Sticker } from "lucide-react";
import { useState } from "react";
import { useIsTouch } from "../../lib/usePointer";
import { useSavedStickers } from "../../hooks/useWaCloud";

type Tab = "recientes" | "guardados";

function TabButton({
  active,
  onPress,
  children,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={`min-h-9 rounded-full px-3 py-1 font-medium text-sm transition ${
        active ? "bg-success/15 text-success" : "text-default-500 hover:bg-default-100"
      }`}
    >
      {children}
    </button>
  );
}

function StickerGrid({
  accountId,
  enabled,
  onSend,
}: {
  accountId: number | undefined;
  enabled: boolean;
  onSend: (savedStickerId: number) => void;
}) {
  const [tab, setTab] = useState<Tab>("recientes");
  const query = useSavedStickers(enabled ? accountId : undefined, tab);
  const items = query.data?.stickers ?? [];

  return (
    <div className="flex max-w-full flex-col size-[300px]">
      <div className="mb-2 flex gap-1">
        <TabButton active={tab === "recientes"} onPress={() => setTab("recientes")}>
          Recientes
        </TabButton>
        <TabButton active={tab === "guardados"} onPress={() => setTab("guardados")}>
          Guardados
        </TabButton>
      </div>
      <div className="flex-1 overflow-y-auto">
        {query.isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-2 py-10 text-center text-default-400 text-sm">
            {tab === "recientes"
              ? "Aún no envías stickers. Los que mandes aparecerán aquí."
              : "Sin stickers guardados. Mantén presionado un sticker recibido para guardarlo."}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {items.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSend(s.id)}
                aria-label="Enviar sticker"
                className="flex aspect-square min-h-11 items-center justify-center rounded-lg p-1 transition hover:bg-default-100"
              >
                <img
                  src={s.url}
                  alt="sticker"
                  loading="lazy"
                  className="size-full object-contain"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Sticker tray for the composer. Desktop = popover, touch = bottom-sheet with
// bigger tap targets. Listing only fires while open (lazy). Sending routes
// through the parent (sendSavedSticker), which re-uploads the durable R2 copy
// to Meta and bumps "recientes".
export function StickerPickerButton({
  accountId,
  isDisabled,
  onSend,
}: {
  accountId: number | undefined;
  isDisabled: boolean;
  onSend: (savedStickerId: number) => void;
}) {
  const isTouch = useIsTouch();
  const [open, setOpen] = useState(false);
  const send = (id: number) => {
    onSend(id);
    setOpen(false);
  };

  if (isTouch) {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Stickers"
          isDisabled={isDisabled}
          onPress={() => setOpen(true)}
        >
          <Sticker size={16} />
        </Button>
        <Drawer>
          <Drawer.Backdrop isOpen={open} onOpenChange={setOpen} variant="blur">
            <Drawer.Content placement="bottom" className="p-0">
              <Drawer.Dialog
                aria-label="Stickers"
                className="rounded-t-3xl border border-default-200 border-b-0 bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl"
              >
                <Drawer.Handle />
                <StickerGrid accountId={accountId} enabled={open} onSend={send} />
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>
      </>
    );
  }

  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Popover.Trigger>
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Stickers"
          isDisabled={isDisabled}
        >
          <Sticker size={16} />
        </Button>
      </Popover.Trigger>
      <Popover.Content className="rounded-2xl border border-default-200 bg-background p-2 shadow-lg">
        <Popover.Dialog aria-label="Stickers" className="p-1">
          <StickerGrid accountId={accountId} enabled={open} onSend={send} />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
