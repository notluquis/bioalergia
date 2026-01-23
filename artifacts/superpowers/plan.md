# Plan: Auditoría y Verificación de Certificados Médicos

## Goal
Implementar sistema de auditoría y verificación para certificados médicos con:
- Persistencia en DB (modelo MedicalCertificate)
- Storage en Google Drive
- QR code con UUID + hash SHA-256
- Página pública de verificación (Nivel 3: nombre completo, diagnóstico, reposo)

## Assumptions
- Google Drive ya configurado y funcionando (OAuth2)
- Schema.zmodel usa ZenStack v3 con Kysely
- `qrcode` npm package para generar QR
- Certificados se guardan en carpeta "Medical Certificates" en Drive
- Usuario aprobó mostrar datos completos en verificación (Nivel 3)

## Plan

### Step 1: Agregar modelo MedicalCertificate a schema
**Files:**
- `packages/db/zenstack/schema.zmodel`

**Change:**
Agregar al final del archivo:
```zmodel
model MedicalCertificate {
  id            String   @id @default(cuid())
  patientName   String   @map("patient_name")
  patientRut    String   @map("patient_rut")
  birthDate     DateTime @map("birth_date") @db.Date
  address       String
  
  diagnosis     String
  symptoms      String?
  restDays      Int?     @map("rest_days")
  restStartDate DateTime? @map("rest_start_date") @db.Date
  restEndDate   DateTime? @map("rest_end_date") @db.Date
  purpose       String
  purposeDetail String?  @map("purpose_detail")
  
  issuedBy      Int      @map("issued_by")
  issuedAt      DateTime @default(now()) @map("issued_at")
  
  driveFileId   String   @map("drive_file_id") // Google Drive file ID
  pdfHash       String   @map("pdf_hash") // SHA-256
  
  metadata      Json?    // Full certificate data as backup
  
  issuer        User     @relation(fields: [issuedBy], references: [id])
  
  @@deny('all', auth() == null)
  @@allow('read', auth().id == issuedBy)
  @@allow('create', auth().status == 'ACTIVE')
  @@allow('read', auth().roles?[role.name == 'ADMIN' || role.name == 'GOD'])
  
  @@index([patientRut])
  @@index([issuedAt])
  @@map("medical_certificates")
}
```

Agregar en modelo User (dentro de relationships):
```zmodel
medicalCertificates MedicalCertificate[]
```

**Verify:**
```bash
cd packages/db && pnpm generate
zen migrate dev --name add_medical_certificates
```

---

### Step 2: Instalar dependencias para QR
**Files:**
- `apps/api/package.json`

**Change:**
```bash
cd apps/api && pnpm add qrcode @types/qrcode
```

**Verify:**
```bash
grep qrcode apps/api/package.json
```

---

### Step 3: Crear servicio de Google Drive para certificados
**Files:**
- `apps/api/src/services/certificates-drive.ts` (nuevo)

**Change:**
```typescript
import { createReadStream } from "node:fs";
import { getDriveClient } from "../lib/google/google-core";
import { parseGoogleError } from "../lib/google/google-errors";

const CERTIFICATES_FOLDER_NAME = "Medical Certificates";

export async function getCertificatesFolderId(): Promise<string> {
  try {
    const drive = await getDriveClient();
    
    const response = await drive.files.list({
      q: `name='${CERTIFICATES_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id)",
      spaces: "drive",
    });

    if (response.data.files?.length) {
      return response.data.files[0].id!;
    }

    const folder = await drive.files.create({
      requestBody: {
        name: CERTIFICATES_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });

    return folder.data.id!;
  } catch (error) {
    throw parseGoogleError(error);
  }
}

export async function uploadCertificateToDrive(
  filepath: string,
  filename: string,
  metadata: Record<string, any>,
  pdfHash: string
): Promise<{ fileId: string; webViewLink: string | null }> {
  try {
    const drive = await getDriveClient();
    const folderId = await getCertificatesFolderId();

    const response = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
        description: JSON.stringify(metadata),
        appProperties: {
          pdfHash,
          certificateType: "medical",
        },
      },
      media: {
        mimeType: "application/pdf",
        body: createReadStream(filepath),
      },
      fields: "id,webViewLink",
    });

    return {
      fileId: response.data.id!,
      webViewLink: response.data.webViewLink || null,
    };
  } catch (error) {
    throw parseGoogleError(error);
  }
}
```

**Verify:**
```bash
cd apps/api && pnpm exec tsc --noEmit
```

---

### Step 4: Actualizar certificate.service.ts para generar QR
**Files:**
- `apps/api/src/modules/certificates/certificate.service.ts`

**Change:**
1. Agregar import:
```typescript
import QRCode from "qrcode";
```

2. Agregar función antes de `generateMedicalCertificatePDF`:
```typescript
async function generateQRCode(certificateId: string): Promise<Buffer> {
  const verifyUrl = `${process.env.APP_URL || "http://localhost:5173"}/verify/${certificateId}`;
  return await QRCode.toBuffer(verifyUrl, {
    errorCorrectionLevel: "M",
    type: "png",
    width: 200,
    margin: 1,
  });
}
```

3. Modificar firma de `generateMedicalCertificatePDF`:
```typescript
export async function generateMedicalCertificatePDF(
  input: MedicalCertificateInput,
  qrCodeBuffer?: Buffer
): Promise<Uint8Array>
```

4. Dentro de la función, antes de `pdfDoc.save()`, agregar QR en esquina inferior derecha:
```typescript
if (qrCodeBuffer) {
  const qrImage = await pdfDoc.embedPng(qrCodeBuffer);
  const qrDims = qrImage.scale(0.3); // 60x60px aprox
  
  firstPage.drawImage(qrImage, {
    x: firstPage.getWidth() - qrDims.width - 30,
    y: 30,
    width: qrDims.width,
    height: qrDims.height,
  });
}
```

**Verify:**
```bash
cd apps/api && pnpm exec tsc --noEmit
```

---

### Step 5: Actualizar endpoint POST para guardar en DB + Drive
**Files:**
- `apps/api/src/modules/certificates/index.ts`

**Change:**
1. Agregar imports:
```typescript
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { db } from "@finanzas/db";
import { uploadCertificateToDrive } from "../../services/certificates-drive";
import { generateQRCode } from "./certificate.service"; // mover función a export
```

2. Reemplazar el handler POST completo:
```typescript
certificatesApp.post("/medical", async (c) => {
  const input = await c.req.json();
  const parsed = medicalCertificateSchema.parse(input);
  
  // Generate unique ID
  const certificateId = crypto.randomUUID();
  
  // Generate QR code
  const qrCode = await generateQRCode(certificateId);
  
  // Generate PDF with QR
  const pdfBytes = await generateMedicalCertificatePDF(parsed, qrCode);
  
  // Calculate hash
  const pdfHash = crypto.createHash("sha256").update(pdfBytes).digest("hex");
  
  // Save to temp file
  const tempPath = path.join(os.tmpdir(), `${certificateId}.pdf`);
  fs.writeFileSync(tempPath, pdfBytes);
  
  try {
    // Upload to Google Drive
    const { fileId, webViewLink } = await uploadCertificateToDrive(
      tempPath,
      `certificado_${parsed.patientRut.replace(/\./g, "")}_${Date.now()}.pdf`,
      parsed,
      pdfHash
    );
    
    // Save to database
    await db.medicalCertificate.create({
      data: {
        id: certificateId,
        patientName: parsed.patientName,
        patientRut: parsed.patientRut,
        birthDate: new Date(parsed.birthDate),
        address: parsed.address,
        diagnosis: parsed.diagnosis,
        symptoms: parsed.symptoms,
        restDays: parsed.restDays,
        restStartDate: parsed.restStartDate ? new Date(parsed.restStartDate) : null,
        restEndDate: parsed.restEndDate ? new Date(parsed.restEndDate) : null,
        purpose: parsed.purpose,
        purposeDetail: parsed.purposeDetail,
        issuedBy: c.req.user.id,
        driveFileId: fileId,
        pdfHash,
        metadata: parsed,
      },
    });
    
    console.log(`Certificate ${certificateId} saved to DB and Drive (${fileId})`);
  } finally {
    // Clean up temp file
    fs.unlinkSync(tempPath);
  }
  
  // Return PDF
  return c.body(pdfBytes, 200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="certificado_${parsed.patientRut.replace(/\./g, "")}.pdf"`,
  });
});
```

**Verify:**
```bash
curl -X POST http://localhost:3000/api/certificates/medical \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ..." \
  -d '{"patientName":"Test","rut":"12.345.678-9",...}' \
  --output test.pdf
```

---

### Step 6: Crear endpoint público GET /verify/:id
**Files:**
- `apps/api/src/modules/certificates/index.ts`

**Change:**
Agregar al final del archivo, antes de `export default certificatesApp`:
```typescript
// Public endpoint - no auth required
certificatesApp.get("/verify/:id", async (c) => {
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
      return c.json({ valid: false, error: "Certificado no encontrado" }, 404);
    }

    // Return Level 3 verification (full details)
    return c.json({
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
    return c.json({ valid: false, error: "Error al verificar certificado" }, 500);
  }
});
```

**Verify:**
```bash
curl http://localhost:3000/api/certificates/verify/{uuid}
```

---

### Step 7: Crear página frontend /verify/:id
**Files:**
- `apps/web/src/routes/verify.$id.tsx` (nuevo)

**Change:**
```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";

import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/verify/$id")({
  component: VerifyCertificatePage,
});

function VerifyCertificatePage() {
  const { id } = Route.useParams();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["verify-certificate", id],
    queryFn: async () => {
      const response = await apiClient.get(`certificates/verify/${id}`);
      return await response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg"></div>
          <p className="mt-4 text-foreground/70">Verificando certificado...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-error/10">
        <div className="bg-base-100 p-8 rounded-2xl shadow-xl max-w-md text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-3xl font-bold text-error mb-2">Certificado Inválido</h1>
          <p className="text-foreground/70">
            {data?.error || "Este certificado no existe o ha sido revocado"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-success/10 p-4">
      <div className="bg-base-100 p-8 rounded-2xl shadow-xl max-w-2xl w-full">
        <div className="text-center mb-6">
          <div className="text-6xl mb-2">✅</div>
          <h1 className="text-3xl font-bold text-success">Certificado Válido</h1>
        </div>
        
        <div className="space-y-6">
          <div className="border-b border-base-300 pb-4">
            <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide mb-1">
              Paciente
            </h3>
            <p className="text-xl font-medium">{data.patient.name}</p>
          </div>
          
          <div className="border-b border-base-300 pb-4">
            <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide mb-1">
              Diagnóstico
            </h3>
            <p className="text-lg">{data.diagnosis}</p>
          </div>
          
          {data.restDays && (
            <div className="border-b border-base-300 pb-4">
              <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide mb-1">
                Reposo Médico
              </h3>
              <p className="text-lg font-medium">{data.restDays} días</p>
              {data.restStartDate && data.restEndDate && (
                <p className="text-sm text-foreground/60 mt-1">
                  Desde {dayjs(data.restStartDate).format("DD/MM/YYYY")} hasta{" "}
                  {dayjs(data.restEndDate).format("DD/MM/YYYY")}
                </p>
              )}
            </div>
          )}
          
          <div className="border-b border-base-300 pb-4">
            <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide mb-1">
              Propósito
            </h3>
            <p className="text-lg capitalize">{data.purpose}</p>
          </div>
          
          <div className="border-b border-base-300 pb-4">
            <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide mb-1">
              Emitido por
            </h3>
            <p className="text-lg font-medium">{data.doctor.name}</p>
            <p className="text-sm text-foreground/60">{data.doctor.specialty}</p>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide mb-1">
              Fecha de emisión
            </h3>
            <p className="text-lg">{dayjs(data.issuedAt).format("DD [de] MMMM [de] YYYY")}</p>
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-info/10 rounded-lg">
          <p className="text-sm text-info text-center">
            Este certificado ha sido verificado digitalmente y es auténtico
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Verify:**
Abrir `http://localhost:5173/verify/{uuid}` en navegador

---

### Step 8: Exportar generateQRCode desde service
**Files:**
- `apps/api/src/modules/certificates/certificate.service.ts`

**Change:**
Cambiar `async function generateQRCode` a `export async function generateQRCode`

**Verify:**
```bash
cd apps/api && pnpm exec tsc --noEmit
```

---

## Risks & mitigations

1. **Risk**: Google Drive quota exceeded
   **Mitigation**: Monitorear uso, implementar cleanup de certificados antiguos (>1 año)

2. **Risk**: QR code aumenta tamaño del PDF
   **Mitigation**: QR pequeño (200x200px → 60x60 scaled), compresión PNG

3. **Risk**: UUID público puede ser adivinado
   **Mitigation**: Usar cuid() (26 chars, collision-resistant, ~2^130 combinations)

4. **Risk**: Página pública expone datos sensibles
   **Mitigation**: Usuario aprobó Nivel 3, pero NO exponemos: RUT, dirección, fecha nacimiento

5. **Risk**: Temp file no se limpia si hay error
   **Mitigation**: Usar try/finally para garantizar cleanup

## Rollback plan

1. **Si falla migración DB**: 
   ```bash
   zen migrate reset
   git checkout HEAD~1 packages/db/zenstack/schema.zmodel
   pnpm generate
   ```

2. **Si falla Google Drive**: 
   - Certificados siguen funcionando sin persistencia
   - Comentar código de upload, solo retornar PDF

3. **Si falla QR generation**: 
   - PDF se genera sin QR (parámetro opcional)
   - Verificación sigue funcionando con URL manual

4. **Si falla página de verificación**: 
   - Endpoint API sigue funcionando
   - Mostrar JSON raw como fallback
