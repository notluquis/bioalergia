# Auditoría y Verificación de Certificados Médicos - Brainstorm

## Goal
Implementar sistema de auditoría y verificación para certificados médicos:
1. **Auditoría**: Persistir certificados en DB con metadata completa
2. **Verificación**: QR code en PDF + página pública para validar autenticidad

## Constraints
- Stack: ZenStack v3 (Kysely, NO Prisma client), Hono, TanStack Query, HeroUI
- Railway deployment con Volumes para PDFs
- Debe mantener compatibilidad con firma digital @signpdf existente
- QR debe funcionar sin autenticación (página pública)
- Privacidad: página de verificación NO debe exponer datos sensibles del paciente

## Known context
- Schema actual usa ZenStack v3 con modelos: User, Person, Calendar, Event
- Sistema de permisos RBAC ya implementado
- Certificados actualmente se generan y descargan sin guardar
- Railway Volumes ya configurado para PFX, puede reutilizarse para PDFs
- Frontend usa TanStack Query con hooks generados por ZenStack

## Risks
1. **Storage**: PDFs pueden crecer rápido (cada uno ~100-500KB)
2. **Privacy**: QR expone UUID público - debe validarse qué mostrar en verificación
3. **Performance**: Generar QR code puede agregar latencia al PDF
4. **Migración**: Certificados anteriores no tendrán registro en DB
5. **Concurrencia**: Múltiples doctores generando certificados simultáneamente

## Options (2–4)

### Opción 1: Storage en Railway Volumes
**Implementación:**
- PDFs en `/app/certificates/{uuid}.pdf`
- DB guarda solo path relativo
- Endpoint GET `/api/certificates/:id/download` sirve archivo

**Pros:**
- Simple, usa infraestructura existente
- Backups automáticos de Railway
- No requiere S3/external storage

**Contras:**
- Volumen limitado (Railway Volumes tiene límites)
- No CDN (más lento para descargas)
- Difícil escalar horizontalmente

### Opción 2: QR con UUID público vs Hash
**Implementación A (UUID):**
- QR: `https://app.com/verify/{uuid}`
- UUID es el ID del certificado

**Implementación B (Hash):**
- QR: `https://app.com/verify/{sha256}`
- Hash del PDF completo

**Pros UUID:**
- Simple, directo
- Permite mostrar metadata

**Pros Hash:**
- Valida integridad del PDF
- Más seguro (no se puede adivinar)

### Opción 3: Página de Verificación - Qué mostrar
**Nivel 1 (Mínimo):**
- ✅ Válido / ❌ Inválido
- Fecha de emisión
- Doctor emisor

**Nivel 2 (Moderado):**
- Lo anterior +
- Nombre paciente (parcial: "Juan P****")
- Propósito (trabajo/estudio)

**Nivel 3 (Completo):**
- Todo lo anterior +
- Diagnóstico
- Días de reposo

## Recommendation

**Implementar:**

1. **Storage: Railway Volumes**
   - Reutilizar volumen existente
   - Path: `/app/certificates/`
   - Naming: `{uuid}_{timestamp}.pdf`

2. **QR: UUID público**
   - Más simple para MVP
   - Permite evolucionar a hash después

3. **Verificación: Nivel 1 (Mínimo)**
   - Solo: válido/inválido, fecha, doctor
   - NO exponer datos del paciente
   - Cumple con privacidad

4. **Modelo DB:**
```zmodel
model MedicalCertificate {
  id            String   @id @default(cuid())
  patientName   String   @map("patient_name")
  patientRut    String   @map("patient_rut")
  issuedBy      Int      @map("issued_by")
  issuedAt      DateTime @default(now()) @map("issued_at")
  pdfPath       String   @map("pdf_path")
  pdfHash       String   @map("pdf_hash")
  diagnosis     String
  restDays      Int?     @map("rest_days")
  purpose       String
  metadata      Json?
  
  issuer        User     @relation(fields: [issuedBy], references: [id])
  
  @@index([patientRut])
  @@index([issuedAt])
  @@map("medical_certificates")
}
```

## Acceptance criteria

### Backend
- [ ] Modelo `MedicalCertificate` agregado a schema.zmodel
- [ ] Migración ejecutada
- [ ] POST `/api/certificates/medical` actualizado para guardar en DB
- [ ] QR code generado e insertado en PDF
- [ ] GET `/api/certificates/:id/download` (autenticado)
- [ ] GET `/api/verify/:id` (público)

### Frontend
- [ ] Página `/verify/:id` pública
- [ ] Lista `/certificates/history` con filtros
- [ ] QR funcional en PDF generado

### Testing
- [ ] Generar → guardar en DB
- [ ] Escanear QR → verificar
- [ ] Validar integridad con hash
