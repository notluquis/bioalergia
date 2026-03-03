import { getRouteApi } from "@tanstack/react-router";
import { CalendarDteLinksOverview } from "@/features/calendar/components/CalendarDteLinksOverview";

const routeApi = getRouteApi("/_authed/calendar/dte-links");

export function CalendarDteLinksPage() {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();

  return (
    <CalendarDteLinksOverview
      search={search}
      onSearchChange={(next) => {
        void navigate({
          search: (prev) => ({
            ...prev,
            ...next,
          }),
        });
      }}
    />
  );
}
