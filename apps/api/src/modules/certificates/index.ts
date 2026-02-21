import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { User } from "@finanzas/db";
import { db } from "@finanzas/db";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { Hono } from "hono";
import { zValidator } from "../../lib/zod-validator";
import { uploadCertificateToDrive } from "../../services/certificates-drive.js";
import { replyRaw } from "../../utils/reply";
import { medicalCertificateSchema } from "./certificate.schema.js";
import { generateMedicalCertificatePdf, generateQRCode, signPdf } from "./certificate.service.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";

const parseDateOnly = (value: string) => dayjs.tz(value, "YYYY-MM-DD", TIMEZONE).toDate();

export type Variables = {
  user: User;
};

const certificates = new Hono<{ Variables: Variables }>();

/**
 * POST /medical
 * Generate a signed medical certificate PDF with QR code
 * Saves to Google Drive and database for auditing
 */
certificates.post("/medical", zValidator("json", medicalCertificateSchema), async (c) => {
  try {
    const input = c.req.valid("json");
    const userId = c.get("user")?.id;

    if (!userId) {
      return replyRaw(c, { error: "Usuario no autenticado" }, 401);
    }

    // Generate unique ID for certificate
    const certificateId = crypto.randomUUID();

    // Generate QR code
    const qrCode = await generateQRCode(certificateId);

    // Generate PDF with QR
    const pdfBytes = await generateMedicalCertificatePdf(input, qrCode);

    // Sign PDF (if configured)
    const signedPdfBytes = await signPdf(pdfBytes);

    // Calculate hash for integrity
    const pdfHash = crypto.createHash("sha256").update(signedPdfBytes).digest("hex");

    // Save to temp file for Drive upload
    const tempPath = path.join(os.tmpdir(), `${certificateId}.pdf`);
    fs.writeFileSync(tempPath, signedPdfBytes);

    try {
      // Upload to Google Drive
      const { fileId } = await uploadCertificateToDrive(
        tempPath,
        `certificado_${input.rut.replace(/\./g, "")}_${Date.now()}.pdf`,
        input,
        pdfHash,
      );

      // Save to database
      await db.medicalCertificate.create({
        data: {
          id: certificateId,
          patientName: input.patientName,
          patientRut: input.rut,
          birthDate: parseDateOnly(input.birthDate),
          address: input.address,
          diagnosis: input.diagnosis,
          symptoms: input.symptoms,
          restDays: input.restDays,
          restStartDate: input.restStartDate ? parseDateOnly(input.restStartDate) : null,
          restEndDate: input.restEndDate ? parseDateOnly(input.restEndDate) : null,
          purpose: input.purpose,
          purposeDetail: input.purposeDetail,
          issuedBy: userId,
          driveFileId: fileId,
          pdfHash,
          metadata: input,
        },
      });

      console.log(`Certificate ${certificateId} saved to DB and Drive (${fileId})`);
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }

    // Return PDF as download
    c.header("Content-Type", "application/pdf");
    c.header(
      "Content-Disposition",
      `attachment; filename="certificado_medico_${input.rut.replace(/\./g, "")}.pdf"`,
    );

    return c.body(Buffer.from(signedPdfBytes));
  } catch (error) {
    console.error("Error generating certificate:", error);
    return replyRaw(c, { error: "Error al generar el certificado", details: String(error) }, 500);
  }
});

/**
 * GET /verify/:id
 * Public endpoint to verify certificate authenticity
 * No authentication required
 */
certificates.get("/verify/:id", async (c) => {
  const { id } = c.req.param();

  try {
    const certificate = await db.medicalCertificate.findUnique({
      where: { id },
      include: {
        issuer: {
          include: {
            person: true,
          },
        },
      },
    });

    if (!certificate) {
      return replyRaw(c, { valid: false, error: "Certificado no encontrado" }, 404);
    }

    // Return Level 3 verification (full details as approved by user)
    return replyRaw(c, {
      valid: true,
      issuedAt: certificate.issuedAt,
      doctor: {
        name: certificate.issuer.person.names,
        specialty: "Especialista en Alergología e Inmunología Clínica",
      },
      patient: {
        name: certificate.patientName,
      },
      diagnosis: certificate.diagnosis,
      restDays: certificate.restDays,
      restStartDate: certificate.restStartDate,
      restEndDate: certificate.restEndDate,
      purpose: certificate.purpose,
    });
  } catch (error) {
    console.error("Error verifying certificate:", error);
    return replyRaw(c, { valid: false, error: "Error al verificar certificado" }, 500);
  }
});

/**
 * GET /health
 * Health check for the certificates module
 */
certificates.get("/health", (c) => {
  return replyRaw(c, { status: "ok", module: "certificates" });
});

export const certificatesRoutes = certificates;
