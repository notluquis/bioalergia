# Plan: Patient Management System - Fase 1 (MVP)

## Goal
Implementar sistema básico de registro y gestión de pacientes:
- Modelo `Patient` (1:1 con Person)
- Modelo `Consultation` para consultas médicas
- Link opcional `MedicalCertificate.patientId`
- UI para registrar y listar pacientes

## Assumptions
- Person puede ser empleado Y paciente simultáneamente
- Patient es 1:1 con Person (un Person puede tener un Patient profile)
- Lazy loading: módulos clínicos vienen en Fase 2
- UI simple: formulario de registro + lista con búsqueda

## Plan

### Step 1: Agregar modelos Patient y Consultation a schema
**Files:**
- `packages/db/zenstack/schema.zmodel`

**Change:**
Agregar al final del archivo:
```zmodel
model Patient {
  id            Int      @id @default(autoincrement())
  personId      Int      @unique @map("person_id")
  birthDate     DateTime @map("birth_date") @db.Date
  bloodType     String?  @map("blood_type")
  notes         String?  // Notas generales del paciente
  
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @default(now()) @updatedAt @map("updated_at")
  
  person              Person               @relation(fields: [personId], references: [id], onDelete: Cascade)
  consultations       Consultation[]
  medicalCertificates MedicalCertificate[]
  
  @@deny('all', auth() == null)
  @@allow('read', auth().status == 'ACTIVE')
  @@allow('create,update', auth().status == 'ACTIVE')
  
  @@map("patients")
}

model Consultation {
  id          Int      @id @default(autoincrement())
  patientId   Int      @map("patient_id")
  eventId     Int?     @map("event_id") // Link to Calendar Event
  date        DateTime @db.Date
  reason      String   // Motivo de consulta
  diagnosis   String?  // Diagnóstico
  treatment   String?  // Tratamiento indicado
  notes       String?  // Notas adicionales
  
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @default(now()) @updatedAt @map("updated_at")
  
  patient     Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)
  event       Event?   @relation(fields: [eventId], references: [id])
  
  @@deny('all', auth() == null)
  @@allow('read', auth().status == 'ACTIVE')
  @@allow('create,update,delete', auth().status == 'ACTIVE')
  
  @@index([patientId])
  @@index([eventId])
  @@index([date])
  @@map("consultations")
}
```

Agregar en modelo Person:
```zmodel
patient Patient?
```

Agregar en modelo Event:
```zmodel
consultations Consultation[]
```

Agregar en modelo MedicalCertificate:
```zmodel
patientId Int? @map("patient_id")
patient   Patient? @relation(fields: [patientId], references: [id])
```

**Verify:**
```bash
cd packages/db && pnpm generate
npx prisma db push --schema zenstack/~schema.prisma
```

---

### Step 2: Crear módulo backend de pacientes
**Files:**
- `apps/api/src/modules/patients/index.ts` (nuevo)
- `apps/api/src/modules/patients/patients.schema.ts` (nuevo)

**Change:**
Crear estructura de módulo:
- POST `/api/patients` - Crear paciente
- GET `/api/patients` - Listar con búsqueda
- GET `/api/patients/:id` - Detalle
- PUT `/api/patients/:id` - Actualizar

**Verify:**
```bash
cd apps/api && pnpm exec tsc --noEmit
```

---

### Step 3: Registrar módulo en API
**Files:**
- `apps/api/src/index.ts`

**Change:**
```typescript
import patientsRoutes from "./modules/patients/index.js";
app.route("/api/patients", patientsRoutes);
```

**Verify:**
```bash
curl http://localhost:3000/api/patients
```

---

### Step 4: Crear página de lista de pacientes
**Files:**
- `apps/web/src/routes/_authed/patients/index.tsx` (nuevo)

**Change:**
- Lista de pacientes con TanStack Table
- Búsqueda por RUT/nombre
- Botón "Nuevo Paciente"
- Columnas: RUT, Nombre, Edad, Última consulta

**Verify:**
Abrir `http://localhost:5173/patients`

---

### Step 5: Crear formulario de registro
**Files:**
- `apps/web/src/routes/_authed/patients/new.tsx` (nuevo)

**Change:**
- Formulario con TanStack Form
- Campos: RUT, Nombres, Apellido Paterno, Apellido Materno, Fecha Nacimiento, Email, Teléfono, Dirección
- Validación con Zod
- Auto-crear Person si no existe

**Verify:**
Crear un paciente y verificar en DB

---

### Step 6: Crear página de perfil del paciente
**Files:**
- `apps/web/src/routes/_authed/patients/$id.tsx` (nuevo)

**Change:**
- Tabs: Info, Consultas, Certificados
- Tab Info: datos del paciente (editable)
- Tab Consultas: lista de consultas
- Tab Certificados: lista de certificados emitidos

**Verify:**
Abrir perfil de paciente creado

---

## Risks & mitigations

1. **Risk**: Person duplicado (mismo RUT)
   **Mitigation**: Buscar Person por RUT antes de crear

2. **Risk**: Validación de RUT chileno
   **Mitigation**: Usar librería de validación de RUT

3. **Risk**: Edad calculada incorrectamente
   **Mitigation**: Usar dayjs para cálculo preciso

## Rollback plan

1. Si falla migración: `npx prisma db push --force-reset`
2. Si falla backend: Comentar registro de rutas
3. Si falla frontend: Eliminar rutas de pacientes
