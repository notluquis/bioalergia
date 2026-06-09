import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { attendanceQueries } from "@/features/attendance/queries";
import { MarcarPage } from "@/features/attendance/MarcarPage";

export const Route = createFileRoute("/_authed/marcar")({
  staticData: {
    nav: { iconKey: "Fingerprint", label: "Marcaje", order: 20, section: "Personal" },
    permission: { action: "create", subject: "Attendance" },
    relatedSubjects: ["Attendance"],
    title: "Marcar asistencia",
  },
  beforeLoad: requirePermission("create", "Attendance"),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(attendanceQueries.status());
  },
  component: MarcarPage,
});
