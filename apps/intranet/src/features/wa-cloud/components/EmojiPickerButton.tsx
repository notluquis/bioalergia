import { Button, Popover } from "@heroui/react";
import { Smile } from "lucide-react";
import { lazy, Suspense } from "react";

// The frimousse emoji picker is the heavy part; lazy-load it so it lives in its
// own chunk (out of the wa-cloud route bundle) and only downloads when the user
// opens the popover. The trigger button stays synchronous/instant.
const EmojiPickerPanel = lazy(() => import("./EmojiPickerPanel"));

export function EmojiPickerButton({ onSelect }: { onSelect: (emoji: string) => void }) {
  return (
    <Popover>
      <Popover.Trigger>
        <Button size="sm" variant="outline" isIconOnly aria-label="Insertar emoji">
          <Smile size={16} />
        </Button>
      </Popover.Trigger>
      <Popover.Content className="rounded-2xl border border-default-200 bg-background p-0 shadow-lg">
        <Popover.Dialog className="p-0">
          <Suspense
            fallback={
              <div className="flex h-[380px] w-[320px] items-center justify-center text-default-500 text-sm">
                Cargando…
              </div>
            }
          >
            <EmojiPickerPanel onSelect={onSelect} />
          </Suspense>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
