import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AdminAttendancePage } from "@/features/attendance/AdminAttendancePage";

export const Route = createFileRoute("/_authed/hr/attendance")({
  staticData: {
    nav: { iconKey: "ClipboardList", label: "Asistencia", order: 30, section: "Personal" },
    permission: { action: "read", subject: "AttendanceAdmin" },
    relatedSubjects: ["AttendanceAdmin"],
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "AttendanceAdmin")) {
      const routeApi = getRouteApi("/_authed/hr/attendance");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: AdminAttendancePage,
});
