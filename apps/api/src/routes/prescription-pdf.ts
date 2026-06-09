import { db } from "@finanzas/db";
import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";

export const prescriptionPdfRoutes = new Hono();

type Mode = "full" | "overlay" | "template";
const parseMode = (m: string | undefined): Mode =>
  m === "overlay" || m === "template" ? m : "full";

// GET /api/certificates/prescription/blank-template
//
// Recetario EN BLANCO (solo chrome estático: logos, título, "Indicaciones",
// footer/firma) para imprimir en bulk. El médico luego imprime las recetas en
// modo "overlay" encima de estas hojas pre-impresas.
prescriptionPdfRoutes.get("/blank-template", async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.text("Unauthorized", 401);
  if (!(await hasPermission(session, "create", "MedicalCertificate"))) {
    return c.text("Forbidden", 403);
  }
  try {
    const clinic = await db.clinicSettings.findUnique({ where: { id: 1 } });
    const { generateMedicalPrescriptionPdf } = await import(
      "../modules/certificates/certificate.service.ts"
    );
    const { toPdfA3 } = await import("../modules/pdf/pdf-a.ts");
    const rawPdf = await generateMedicalPrescriptionPdf(
      {
        patientId: 0,
        date: "2026-01-01",
        // dummy (no se dibuja en modo template), el schema exige ≥1.
        medications: [{ name: "" }],
        mode: "template",
        doctorName: clinic?.doctorName ?? undefined,
        doctorSpecialty: clinic?.doctorSpecialty ?? undefined,
        doctorRut: clinic?.doctorRut ?? undefined,
        doctorLicense: clinic?.superintendenciaNumber ?? undefined,
        patient: { name: "", rut: null },
      },
      { primary: clinic?.logoUrl, secondary: clinic?.secondaryLogoUrl }
    );
    const pdfBytes = await toPdfA3(rawPdf, "Recetario");
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", 'inline; filename="recetario_blanco.pdf"');
    c.header("Cache-Control", "no-store");
    return c.body(pdfBytes as unknown as ArrayBuffer);
  } catch (error) {
    logError("prescription.blankTemplate", error);
    return c.text("PDF generation failed", 500);
  }
});

// GET /api/certificates/prescription/:id/pdf
//
// Descarga RAW del PDF de una receta. NO pasa por oRPC/SuperJSON: el
// SuperJSONRPCHandler envuelve el File en JSON y corrompe el binario
// ("could not be opened"). Acá regeneramos el PDF determinísticamente desde
// los datos guardados y lo servimos como bytes `application/pdf`.
// También habilita la re-descarga desde "recetas recientes".
prescriptionPdfRoutes.get("/:id/pdf", async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.text("Unauthorized", 401);
  if (!(await hasPermission(session, "read", "MedicalCertificate"))) {
    return c.text("Forbidden", 403);
  }

  const id = c.req.param("id");
  const mode = parseMode(c.req.query("mode"));
  const prescription = await db.medicalPrescription.findUnique({ where: { id } });
  if (!prescription) return c.text("Not found", 404);

  try {
    const clinic = await db.clinicSettings.findUnique({ where: { id: 1 } });
    const { generateMedicalPrescriptionPdf } = await import(
      "../modules/certificates/certificate.service.ts"
    );
    const { toPdfA3 } = await import("../modules/pdf/pdf-a.ts");

    const medications = Array.isArray(prescription.medications)
      ? (prescription.medications as Array<Record<string, unknown>>).map((m) => ({
          name: String(m.name ?? ""),
          dosage: m.dosage ? String(m.dosage) : undefined,
          frequency: m.frequency ? String(m.frequency) : undefined,
          duration: m.duration ? String(m.duration) : undefined,
          instructions: m.instructions ? String(m.instructions) : undefined,
        }))
      : [];

    const rawPdf = await generateMedicalPrescriptionPdf(
      {
        patientId: prescription.patientId,
        // @db.Date queda anclado a medianoche UTC → slice ISO da el YYYY-MM-DD
        // correcto sin corrimiento (formatDate lo re-formatea para mostrar).
        date: prescription.date.toISOString().slice(0, 10),
        diagnosis: prescription.diagnosis ?? undefined,
        medications,
        notes: prescription.notes ?? undefined,
        mode,
        folio: prescription.folio ?? undefined,
        prescriptionType: (prescription.prescriptionType ?? "SIMPLE") as
          | "SIMPLE"
          | "RETENIDA"
          | "CHEQUE",
        doctorLicense: prescription.doctorLicense ?? undefined,
        doctorName: prescription.doctorName ?? undefined,
        doctorSpecialty: prescription.doctorSpecialty ?? undefined,
        doctorRut: prescription.doctorRut ?? undefined,
        doctorEmail: prescription.doctorEmail ?? undefined,
        doctorAddress: prescription.doctorAddress ?? undefined,
        patient: { name: prescription.patientName, rut: prescription.patientRut },
      },
      { primary: clinic?.logoUrl, secondary: clinic?.secondaryLogoUrl }
    );
    const pdfBytes = await toPdfA3(rawPdf, "Receta médica");

    const safeRut = (prescription.patientRut ?? "sin_rut").replace(/\./g, "");
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `inline; filename="receta_${safeRut}.pdf"`);
    c.header("Cache-Control", "no-store");
    return c.body(pdfBytes as unknown as ArrayBuffer);
  } catch (error) {
    logError("prescription.pdf", error, { id });
    return c.text("PDF generation failed", 500);
  }
});
