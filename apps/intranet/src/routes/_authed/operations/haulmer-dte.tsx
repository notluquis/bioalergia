import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";

import { HaulmerDtePage } from "@/pages/operations/HaulmerDtePage";

export const Route = createFileRoute("/_authed/operations/haulmer-dte")({
  staticData: {
    nav: { iconKey: "FileText", label: "DTE (operaciones)", order: 20, section: "Logística" },
    permission: { action: "read", subject: "Integration" },
    title: "Haulmer DTE",
  },
  // The Haulmer oRPC API gates on `read:Integration` (see orpc/haulmer.ts) and
  // the sibling settings/haulmer.tsx route already guards on the same subject.
  // `Haulmer` was never a model nor a synced virtual subject, so the row never
  // existed and this route bounced to `/` for everyone — align with the server.
  beforeLoad: requirePermission("read", "Integration"),
  component: HaulmerDtePage,
});
