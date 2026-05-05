import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { WhatsappSettingsPage } from "@/pages/settings/WhatsappSettingsPage";

export const Route = createFileRoute("/_authed/settings/whatsapp")({
  staticData: {
    nav: { iconKey: "MessageCircle", label: "WhatsApp", order: 90, section: "Sistema" },
    permission: { action: "read", subject: "Integration" },
    relatedSubjects: ["WhatsappNotification", "PushSubscription"],
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Integration")) {
      const routeApi = getRouteApi("/_authed/settings/whatsapp");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: WhatsappSettingsPage,
});
