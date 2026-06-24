import { createFileRoute, redirect } from "@tanstack/react-router";

// Tabs consolidados viven en /wa-cloud?tab=<key>. Las sub-rutas legacy
// (/wa-cloud/plantillas, /wa-cloud/buscar, …) se eliminaron en la consolidación
// IA Phase 2, pero bookmarks / enlaces externos aún pueden golpearlas. Este splat
// las redirige al query param equivalente (push, para que "atrás" vuelva al tab
// previo). Debe coincidir con el `tabKey` enum de ./index.tsx.
const TABS = [
  "inbox",
  "plantillas",
  "programados",
  "broadcasts",
  "catalogo",
  "alertas",
  "webhooks",
  "analytics",
  "configuracion",
] as const;
type Tab = (typeof TABS)[number];

function isTab(value: string): value is Tab {
  return (TABS as readonly string[]).includes(value);
}

export const Route = createFileRoute("/_authed/wa-cloud/$")({
  beforeLoad: ({ params }) => {
    const segment = (params._splat ?? "").split("/")[0] ?? "";
    // /wa-cloud/buscar → abre el drawer de búsqueda sobre el inbox.
    if (segment === "buscar") {
      throw redirect({ to: "/wa-cloud", search: { tab: "inbox", search: 1 } });
    }
    throw redirect({
      to: "/wa-cloud",
      search: { tab: isTab(segment) ? segment : "inbox" },
    });
  },
});
