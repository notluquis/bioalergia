import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { medicalCertificateSchema } from "./certificate.schema.js";
import { generateMedicalCertificatePdf, signPdf } from "./certificate.service.js";

const certificates = new Hono();

/**
 * POST /medical
 * Generate a signed medical certificate PDF
 */
certificates.post(
  "/medical",
  zValidator("json", medicalCertificateSchema),
  async (c) => {
    try {
      const input = c.req.valid("json");

      // Generate PDF
      const pdfBytes = await generateMedicalCertificatePdf(input);

      // Sign PDF (if configured)
      const signedPdfBytes = await signPdf(pdfBytes);

      // Return as PDF download
      c.header("Content-Type", "application/pdf");
      c.header(
        "Content-Disposition",
        `attachment; filename="certificado_medico_${input.rut.replace(/\./g, "")}.pdf"`
      );

      return c.body(Buffer.from(signedPdfBytes));
    } catch (error) {
      console.error("Error generating certificate:", error);
      return c.json(
        { error: "Error al generar el certificado", details: String(error) },
        500
      );
    }
  }
);

/**
 * GET /health
 * Health check for the certificates module
 */
certificates.get("/health", (c) => {
  return c.json({ status: "ok", module: "certificates" });
});

export default certificates;
