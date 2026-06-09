import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";

import { HaulmerDtePage } from "@/pages/operations/HaulmerDtePage";

export const Route = createFileRoute("/_authed/operations/haulmer-dte")({
  staticData: {
    nav: { iconKey: "FileText", label: "DTE (operaciones)", order: 20, section: "Logística" },
    permission: { action: "read", subject: "Haulmer" },
    title: "Haulmer DTE",
  },
  beforeLoad: requirePermission("read", "Haulmer"),
  component: HaulmerDtePage,
});
