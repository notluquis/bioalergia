import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { RolesSettingsPage } from "@/pages/settings/RolesSettingsPage";

export const Route = createFileRoute("/_authed/settings/roles")({
  staticData: {
    nav: { iconKey: "ShieldCheck", label: "Roles", order: 20, section: "Sistema" },
    permission: { action: "read", subject: "Role" },
    relatedSubjects: ["Permission"],
    title: "Roles y permisos",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Role")) {
      const routeApi = getRouteApi("/_authed/settings/roles");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: RolesSettingsPage,
});
