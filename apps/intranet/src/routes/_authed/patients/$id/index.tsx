import { createFileRoute } from "@tanstack/react-router";
import { fetchPatient } from "@/features/patients/api";
import { patientKeys } from "@/features/patients/queries";
import { PatientDetailsPage } from "@/features/patients/pages/PatientDetailPage";

type Patient = Awaited<ReturnType<typeof fetchPatient>>;

export const Route = createFileRoute("/_authed/patients/$id/")({
  staticData: {
    permission: { action: "read", subject: "Patient" },
    relatedSubjects: ["Budget", "Consultation", "PatientPayment"],
    breadcrumb: (data: unknown) => {
      const patient = data as Patient | undefined;
      return `${patient?.person?.names} ${patient?.person?.fatherName}`.trim() || "Paciente";
    },
    title: "Detalle de paciente",
  },
  loader: async ({ context: { queryClient }, params: { id } }) => {
    return await queryClient.ensureQueryData({
      queryKey: patientKeys.detail(id),
      queryFn: async () => fetchPatient(Number(id)),
    });
  },
  component: PatientDetailsPage,
});
