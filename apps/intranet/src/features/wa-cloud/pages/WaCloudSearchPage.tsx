import { useNavigate } from "@tanstack/react-router";
import { WaCloudSearchPanel } from "../components/WaCloudSearchPanel";

/**
 * Standalone global wa-cloud search page.
 *
 * Now a thin wrapper around `<WaCloudSearchPanel>` since the same
 * search UI also lives inside the inbox `<InboxSearchDrawer>` (Phase 2
 * IA consolidation). The legacy route `/wa-cloud/buscar` was collapsed
 * into a redirect shell that opens the drawer on mount; this page
 * remains in case any external link still resolves to it.
 */
export function WaCloudSearchPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <WaCloudSearchPanel
        onSelectConversation={(conversationId) => {
          void navigate({
            to: "/wa-cloud",
            search: { conversation: conversationId } as never,
          });
        }}
      />
    </div>
  );
}
