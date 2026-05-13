import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { WaCloudInboxPage } from "@/features/wa-cloud/pages/WaCloudInboxPage";

// `?conversation=<id>` is the canonical deep-link param so any
// surface (global search, push notification body, future digest
// email) can drop a user straight into a thread. Validated with Zod
// per TanStack Router 2025 golden pattern — invalid IDs get coerced
// to undefined instead of throwing.
const inboxSearchSchema = z.object({
  conversation: z.coerce.number().int().positive().optional(),
  // Marker set by the SW `/share-target` POST → 303 redirect. When
  // present, the inbox page reads the cached payload from
  // CacheStorage and offers it to the operator (file preview +
  // pick-conversation flow).
  shared: z.coerce.number().int().optional(),
});

export const Route = createFileRoute("/_authed/wa-cloud/")({
  validateSearch: inboxSearchSchema,
  staticData: {
    nav: {
      iconKey: "MessageSquare",
      label: "WhatsApp Cloud",
      order: 10,
      section: "Comunicaciones",
    },
    permission: { action: "read", subject: "WaBusinessAccount" },
    title: "WhatsApp Cloud — Bandeja",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "WaBusinessAccount")) {
      throw redirect({ to: "/" });
    }
  },
  component: WaCloudInboxPage,
});
