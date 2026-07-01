import { createFileRoute, redirect } from "@tanstack/react-router";

import { classifySearchSchema } from "@/features/calendar/types";

// Consolidated into `/calendar?tab=clasificacion`. Kept as a redirect so
// deep-links (missing-field filters, pages) keep resolving.
export const Route = createFileRoute("/_authed/clinical/classify")({
  staticData: { hideFromNav: true, title: "Clasificación clínica" },
  validateSearch: (search: Record<string, unknown>) => classifySearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps: search }) => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: "/calendar", search: { ...search, tab: "clasificacion" } });
  },
  component: () => null,
});
