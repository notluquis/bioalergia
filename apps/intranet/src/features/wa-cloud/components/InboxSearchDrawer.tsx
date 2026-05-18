import { Drawer } from "@heroui/react";
import { Search } from "lucide-react";
import { WaCloudSearchPanel } from "./WaCloudSearchPanel";

/**
 * Right-side drawer wrapper for the global wa-cloud message search.
 *
 * Triggered from the inbox header (button) or `cmd/ctrl+k`. Result
 * click sets `?conversation=X` on the inbox route + closes the drawer,
 * via the `onSelectConversation` callback owned by the host.
 */
export interface InboxSearchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (conversationId: number) => void;
}

export function InboxSearchDrawer({
  isOpen,
  onClose,
  onSelectConversation,
}: InboxSearchDrawerProps) {
  return (
    <Drawer>
      <Drawer.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()} variant="blur">
        <Drawer.Content placement="right" className="p-0 sm:p-3">
          <Drawer.Dialog className="flex max-h-dvh max-w-xl flex-col overflow-hidden rounded-l-3xl border border-default-200 bg-background shadow-2xl sm:rounded-3xl size-full">
            <Drawer.CloseTrigger />
            <Drawer.Header className="border-b border-default-100 pb-4">
              <Drawer.Heading className="flex items-center gap-2 font-semibold text-base">
                <Search size={18} className="text-success" />
                Buscar mensajes
              </Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="flex-1 overflow-y-auto pt-4">
              <WaCloudSearchPanel
                onSelectConversation={(id) => {
                  onSelectConversation(id);
                  onClose();
                }}
                autoFocus
                showHeader={false}
              />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
