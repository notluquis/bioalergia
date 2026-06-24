import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PrescriptionPage } from "@/features/certificates/pages/PrescriptionPage";

const prescriptionSearchSchema = z.object({
  patientId: z.coerce.number().int().positive().optional(),
});

export const Route = createFileRoute("/_authed/certificates/prescription")({
  validateSearch: prescriptionSearchSchema,
  staticData: {
    nav: { iconKey: "ClipboardList", label: "Recetas Médicas", order: 81, section: "Clínica" },
    permission: { action: "create", subject: "MedicalCertificate" },
    title: "Generar Receta Médica",
  },
  component: PrescriptionPage,
});
