# Plan — Pulpo de identidad de pacientes (Person como centro)

Estado: DISEÑO (nada implementado). Basado en datos reales de prod (2026-07-01).

## 0. Realización clave: el pulpo YA existe

No hay que construir un centro nuevo. Ya está:

```
Person (8781) ── rut@unique, names/father/mother, sex, email@unique, phone
   │ 1:1 (personId @unique)   ← solo 12 Person sin Patient
Patient (8769) ── birthDate, bloodType
   │  patientId = LLAVE DE UNIÓN UNIVERSAL
   ├─ ClinicalSeries (patientId, 4 kinds) ── es el unificador clínico
   │    ├ Event[] (30.059, Google + clínico: stage/dosage/testMetadata)
   │    ├ ClinicalSkinTest[] / ClinicalRecord[] (ficha)
   │    └ ImmunotherapyAdministration[] (carnet)
   ├─ ScitPrescription / Consultation / Budget / PatientPayment / Shipment
   ├─ ExamReport / AllergyDiaryEntry / ReminderSchedule / MedicalCertificate
   └─ ClinicalConsent / PatientAttachment / DataRightsRequest / Complaint
```

`getPatientClinicalSeries(patientId)` ya hace `db.clinicalSeries.findMany({ where:{ patientId } })`
uniendo SKIN_TEST + PATCH_TEST + SUBCUTANEOUS_TREATMENT + MEDICAL_CONSULTATION.
El timeline del paciente **ya consume por patientId**.

**Lo roto NO es el centro — son las costuras de resolución de identidad en la INGESTA.**

## 1. El problema real: nada auto-resuelve identidad al ingerir

Toda fuente aterriza **denormalizada** (name/rut sueltos) y solo obtiene `patientId`
por match manual. NADA crea Person salvo el form manual + onboarding de usuarios.

| Fuente | Cómo aterriza hoy | Enlace a Person |
|---|---|---|
| Registro manual / onboarding | `findOrCreatePerson` | ✅ crea |
| DTE / boletas (`dte_sale_details`) | `client_rut`/`client_name` denorm | ❌ ninguno; bridge `patient_dte_sale_sources` **VACÍO** |
| Test cutáneo (import) | crea serie SKIN_TEST, `patientId` a veces NULL | ⚠️ parcial (403 huérfanas) |
| Test parche | serie PATCH_TEST | ⚠️ 18 huérfanas |
| Inmunoterapia | `ImmunotherapyAdministration.patientId` exige Patient | ✅ enlaza (no crea) |
| Ficha (import) | exige `patientId` por match manual | ⚠️ 9.230 sin resolver |
| Google Calendar events | `patient_rut`/`name` denorm, `clinicalSeriesId?` | ⚠️ vía asignación a serie |
| Doctoralia (citas) | ISLA total, solo `patient_external_id` | ❌ ninguno |

### Datos que dimensionan el pulpo (prod real)

- **6.228 RUTs distintos** union (people ∪ dte ∪ skin ∪ events) vs **4.951 people con rut**
  → ~1.277 identidades con RUT que aún NO son Person.
- **people: 4.951 con rut / 3.830 sin rut.**
- **DTE**: 2.057 client_rut distintos, solo 878 son Person → 1.179 sin Person
  (OJO: muchos son **pagadores**, no pacientes — ver §2).
- **Doctoralia**: 3.796 únicos (`external_id`), **3.102 net-new** (no en maestro por nombre);
  phone ~100%, email 97%, birthDate 33%, RUT-en-comments 25%.
- **Series huérfanas** (sin patientId): SKIN_TEST 403, PATCH_TEST 18, SUBCUTANEOUS 7.
- **Backlog fichas**: 10.554 PENDING; ~9.230 con nombre; cross vs Doctoralia = 506 exactas + 1.011 fuzzy.

## 2. Beneficiario ≠ paciente (el matiz que rompe todo si se ignora)

El RUT de la boleta **no siempre es el paciente**. Padre paga (titular) → hijo recibe (beneficiario/paciente).

Datos: 150 clinical_series + 275 events con `beneficiary_rut ≠ patient_rut`.
Muestra: `paciente=Isabella Navarrete Riffo` · `benef=Yarella Riffo Torres` (madre, apellido compartido).

Ya existe soporte parcial: `beneficiary_name/rut/phones` en series+events, y
`signerRelationship` (paciente|representante_legal|apoderado|tutor) en el firmante.

**Regla del modelo:**
- **Person** = una persona (titular o paciente, da igual el rol).
- **Patient** = Person que recibe atención clínica.
- Un titular puede pagar por N pacientes. La boleta enlaza al **beneficiario** (paciente),
  no necesariamente al titular como Patient.
- Falta modelar la relación tutor→paciente como vínculo Person↔Person (no solo denormalizado).

## 3. El corazón: un resolvedor de identidad compartido

Servicio único que TODA ingesta llama. Reemplaza el match ad-hoc por fuente.

```
resolvePerson({ rut?, names?, fatherName?, motherName?, birthDate?,
                doctoraliaExternalId?, phone?, email? })
  → { personId, patientId?, confidence, action: 'linked'|'created'|'review' }
```

Tiers de resolución (de fuerte a débil):
1. `rut` canónico exacto → Person.rut (llave dura existente)
2. `doctoraliaExternalId` → Person.doctoraliaExternalId (nuevo, @unique)
3. `email`/`phone` exacto **solo como refuerzo** (NO llave — 159 emails / 167 phones compartidos por familias)
4. `names+fatherName+motherName` normalizado + `birthDate`/edad (desambigua homónimos)
5. nombre solo → cola de revisión (no auto-crea)

Reusa lo que ya hay: `findOrCreatePerson` (con rut) y `createPersonWithoutRut` (sin rut).
Crea Patient cuando la fuente es clínica; NO crea Patient para un titular-pagador puro.

## 4. Fases (por valor, con datos)

### Fase 0 — Espina + resolvedor (migraciones aditivas)
- `Person.doctoraliaExternalId String? @unique`
- `DoctoraliaCalendarAppointment.patientId Int?` (FK → Patient)
- Relación tutor→paciente: `Patient.guardianPersonId Int?` + `guardianRelationship` enum
  (reusa valores de `signerRelationship`). Aditivo, nullable.
- Servicio `resolvePerson` + tests. Migrar vía `migrate deploy` (solo aditivo).

### Fase 1 — Doctoralia como feeder de identidad (alto valor, independiente de fichas)
- Ingerir 3.796 únicos → `resolvePerson`:
  - RUT de `comments` (regex, 25% = 950) → tier-1
  - resto → `createPersonWithoutRut`, llave `doctoraliaExternalId`
  - `title` → split nombre best-effort (últimos 2 = apellidos si ≥3 tokens; guardar `title` crudo)
  - enriquecer contacto: phone/email/birthDate (el maestro tiene email=15, birthDate=3 → esto lo llena)
- Setear `Appointment.patientId`. Timeline une por patientId (SIN kind nuevo — 24% overlap no lo justifica).
- Resultado: +~3.100 Person, enriquece ~680, 476 fichas ganan timeline con cita.

### Fase 2 — DTE como feeder (respetando titular≠paciente)
- `dte_sale_details.client_rut` → `resolvePerson` como **titular** (Person, no Patient auto).
- Poblar `patient_dte_sale_sources` (bridge hoy vacío) vía `syncPatientDteSaleSources`.
- El vínculo boleta→paciente pasa por el beneficiario de la serie/evento, no por el titular.
- Cuidado: de 1.179 ruts-no-Person, filtrar empresas (companies.rut) y pagadores.

### Fase 3 — Backfill de series huérfanas (cleanup)
- 428 series (403 skin + 18 patch + 7 subq) con `patient_name/rut` pero sin `patientId`
  → `resolvePerson` por rut/nombre → setear patientId.

### Fase 4 — Re-matchear backlog de fichas contra la espina enriquecida
- Con Person ahora con birthDate (de Doctoralia) + 3.100 identidades nuevas,
  re-correr `matchPatientForRecord` → recupera ~500-1.500 fichas (cross medido).
- Agregar `title`+`birthDate` de Doctoralia como segundo pool de candidatos en `match.ts`.

### Fase 5 — Google events por el resolvedor
- La asignación evento→serie (`assignEventToSeries`, `syncClinicalSeriesForExternalEvents`)
  ya matchea por rut/nombre; rutear su resolución por `resolvePerson` para consistencia.

### Fase 6 — Resto net-new (~3.400 fichas de pacientes pre-Doctoralia)
- Decidir: crear-desde-ficha (nombre+edad, sin rut) vs scrape histórico completo Doctoralia
  (por `patient_external_id`, no solo la ventana de calendario). Diferir hasta medir 1-5.

## 5. Decisiones abiertas (para confirmar con datos)
1. Tutor→paciente: `Patient.guardianPersonId` (relación 1 tutor) vs tabla `PersonRelationship`
   (N-a-N, soporta múltiples tutores/hermanos). Dato: 150 series benef≠paciente → volumen bajo,
   `guardianPersonId` alcanza; tabla si aparece necesidad de hermanos/múltiples.
2. DTE titular: ¿crear Person para TODO client_rut, o solo cuando también es paciente?
   Recomendado: crear Person titular (identidad), Patient solo si recibe atención.
3. Split de nombre Doctoralia: heurística + revisión de 4+ tokens (970 casos) vs aceptar ruido.
4. Llave Doctoralia = `external_id` (confirmado por datos: 8/3786 sucios). email/phone NO.

## 6. Qué NO hacer
- NO llave por email/phone (familias comparten → colisión @unique).
- NO kind de serie `APPOINTMENT` (YAGNI; link por patientId basta).
- NO crear Patient para titulares-pagadores puros.
- NO `migrate dev`/`db push` en prod — solo `migrate deploy` aditivo (regla del repo).
