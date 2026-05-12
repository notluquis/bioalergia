import { createFileRoute, redirect } from "@tanstack/react-router";
import { OutreachEstablishmentDetailPage } from "@/features/outreach/pages/OutreachEstablishmentDetailPage";

export const Route = createFileRoute("/_authed/outreach/establecimientos/$rbd")({
  staticData: {
    permission: { action: "read", subject: "OutreachEstablishment" },
    title: "Detalle de establecimiento",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "OutreachEstablishment")) {
      throw redirect({ to: "/" });
    }
  },
  component: OutreachEstablishmentDetailPage,
});
