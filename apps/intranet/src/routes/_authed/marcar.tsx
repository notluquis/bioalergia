import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { attendanceQueries } from "@/features/attendance/queries";
import { MarcarPage } from "@/features/attendance/MarcarPage";

export const Route = createFileRoute("/_authed/marcar")({
  staticData: {
    nav: { iconKey: "Fingerprint", label: "Marcaje", order: 10, section: "Operaciones" },
    permission: { action: "create", subject: "Attendance" },
    relatedSubjects: ["Attendance"],
  },
  beforeLoad: ({ context }) => {
    if (!context.can("create", "Attendance")) {
      const routeApi = getRouteApi("/_authed/marcar");
      throw routeApi.redirect({ to: "/" });
    }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(attendanceQueries.status());
  },
  component: MarcarPage,
});
