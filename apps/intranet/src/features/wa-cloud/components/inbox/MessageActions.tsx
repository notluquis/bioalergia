import { Button, Drawer, Popover } from "@heroui/react";
import { Copy, CornerUpLeft, Forward, MoreVertical, Pencil, Plus, RotateCw } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "@/lib/toast-interceptor";
import { QUICK_REACTIONS } from "../shared/_shared";

const EmojiPickerPanel = lazy(() => import("./EmojiPickerPanel"));

export type MessageActionsApi = {
  canReact: boolean;
  canReply: boolean;
  canEdit: boolean;
  canForward: boolean;
  canRetry: boolean;
  body: string | null;
  /** The operator's own current reaction emoji on this message, if any. */
  ownReaction: string | null;
  /** Empty string removes the reaction. */
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  onForward: () => void;
  onRetry: () => void;
};

// Quick-reaction row + "+" full emoji picker, shared by the desktop popover and
// the touch bottom-sheet. Tapping the operator's own reaction again removes it.
function ReactionRow({
  ownReaction,
  onReact,
  onClose,
}: {
  ownReaction: string | null;
  onReact: (emoji: string) => void;
  onClose: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  if (showAll) {
    return (
      <Suspense
        fallback={
          <div className="flex h-[360px] w-full items-center justify-center text-default-500 text-sm">
            Cargando…
          </div>
        }
      >
        <EmojiPickerPanel
          onSelect={(emoji) => {
            onReact(emoji);
            onClose();
          }}
        />
      </Suspense>
    );
  }
  return (
    <div className="flex items-center gap-1">
      {QUICK_REACTIONS.map((e) => {
        const isOwn = ownReaction === e;
        return (
          <Button
            key={e}
            size="sm"
            variant="outline"
            isIconOnly
            aria-label={isOwn ? `Quitar reacción ${e}` : `Reaccionar ${e}`}
            aria-pressed={isOwn}
            onPress={() => {
              onReact(isOwn ? "" : e);
              onClose();
            }}
            className={`size-11 rounded-full border-0 text-xl sm:size-9 ${
              isOwn ? "bg-success/20 ring-2 ring-success" : ""
            }`}
          >
            {e}
          </Button>
        );
      })}
      <Button
        size="sm"
        variant="outline"
        isIconOnly
        aria-label="Más emojis"
        onPress={() => setShowAll(true)}
        className="size-11 rounded-full sm:size-9"
      >
        <Plus size={16} />
      </Button>
    </div>
  );
}

function SheetRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-default-100 ${
        danger ? "text-danger" : "text-foreground"
      }`}
    >
      <span className="shrink-0 text-default-500">{icon}</span>
      {label}
    </button>
  );
}

function ActionRows({ api, onClose }: { api: MessageActionsApi; onClose: () => void }) {
  const copy = () => {
    if (api.body) {
      void navigator.clipboard?.writeText(api.body).then(() => toast.success("Copiado"));
    }
    onClose();
  };
  return (
    <div className="flex flex-col">
      {api.canReply && (
        <SheetRow
          icon={<CornerUpLeft size={18} />}
          label="Responder"
          onPress={() => {
            api.onReply();
            onClose();
          }}
        />
      )}
      {api.canEdit && (
        <SheetRow
          icon={<Pencil size={18} />}
          label="Editar"
          onPress={() => {
            api.onEdit();
            onClose();
          }}
        />
      )}
      {api.canForward && (
        <SheetRow
          icon={<Forward size={18} />}
          label="Reenviar"
          onPress={() => {
            api.onForward();
            onClose();
          }}
        />
      )}
      {api.body && <SheetRow icon={<Copy size={18} />} label="Copiar texto" onPress={copy} />}
      {api.canRetry && (
        <SheetRow
          icon={<RotateCw size={18} />}
          label="Reintentar"
          danger
          onPress={() => {
            api.onRetry();
            onClose();
          }}
        />
      )}
    </div>
  );
}

// Touch: controlled bottom-sheet. Opened by the kebab tap OR a long-press on
// the bubble (parent drives `open`). The trigger button lives in ChatBubble.
export function MessageActionSheet({
  open,
  onOpenChange,
  api,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  api: MessageActionsApi;
}) {
  const close = () => onOpenChange(false);
  return (
    <Drawer>
      <Drawer.Backdrop isOpen={open} onOpenChange={(o) => !o && close()} variant="blur">
        <Drawer.Content placement="bottom" className="p-0">
          <Drawer.Dialog
            aria-label="Acciones del mensaje"
            className="flex max-h-[80dvh] flex-col gap-2 rounded-t-3xl border border-default-200 border-b-0 bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl"
          >
            <Drawer.Handle />
            {api.canReact && (
              <div className="flex justify-center pb-1">
                <ReactionRow ownReaction={api.ownReaction} onReact={api.onReact} onClose={close} />
              </div>
            )}
            <ActionRows api={api} onClose={close} />
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

// Desktop: kebab opens a popover with the same reaction row + actions.
export function MessageActionMenu({ api }: { api: MessageActionsApi }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Popover.Trigger>
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Acciones del mensaje"
          className="size-8 rounded-full"
        >
          <MoreVertical size={16} />
        </Button>
      </Popover.Trigger>
      <Popover.Content className="rounded-2xl border border-default-200 bg-content1 p-2 shadow-md">
        <Popover.Dialog aria-label="Acciones del mensaje" className="flex w-56 flex-col gap-1 p-0">
          {api.canReact && (
            <div className="pb-1">
              <ReactionRow ownReaction={api.ownReaction} onReact={api.onReact} onClose={close} />
            </div>
          )}
          <ActionRows api={api} onClose={close} />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
