import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { DoctoraliaEmailPatientsPage } from "@/features/doctoralia/pages/DoctoraliaEmailPatientsPage";

const routeApi = getRouteApi("/_authed/clinical/doctoralia");

export const Route = createFileRoute("/_authed/clinical/doctoralia")({
  component: DoctoraliaEmailPatientsPage,
  staticData: {
    nav: {
      iconKey: "ClipboardList",
      label: "Pacientes Doctoralia",
      order: 2,
      section: "Prestaciones",
    },
    permission: { action: "read", subject: "DoctoraliaFacility" },
    title: "Pacientes Doctoralia",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "DoctoraliaFacility")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
});
