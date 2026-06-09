import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { MedicalCertificatePage } from "@/features/certificates/pages/MedicalCertificatePage";

const medicalCertificateSearchSchema = z.object({
  patientName: z.string().optional(),
  rut: z.string().optional(),
  address: z.string().optional(),
  birthDate: z.string().optional(),
});

export const Route = createFileRoute("/_authed/certificates/medical")({
  validateSearch: medicalCertificateSearchSchema,
  staticData: {
    nav: { iconKey: "FileBadge", label: "Certificados Médicos", order: 80, section: "Clínica" },
    permission: { action: "create", subject: "MedicalCertificate" },
    title: "Generar Certificado Médico",
  },
  component: MedicalCertificatePage,
});
