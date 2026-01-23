# Brainstorm: Sistema Modular de Gestión de Pacientes

## Goal
Diseñar un sistema modular y escalable para gestionar información de pacientes en Bioalergia que:
- Evite "sábanas de datos" (formularios largos y abrumadores)
- Sea modular y organizado por contextos clínicos
- Facilite el flujo de trabajo del doctor
- Integre con el sistema de certificados médicos existente
- Permita evolucionar sin romper funcionalidad existente

## Constraints
- Stack: ZenStack v3, Kysely, Hono, React 19, TanStack Router/Query
- Ya existe modelo `Person` en el schema (usado para empleados, contrapartes, usuarios)
- Sistema de calendario con eventos ya implementado (Google Calendar sync)
- Debe respetar RBAC existente
- UI: HeroUI v3 + Tailwind CSS
- Datos sensibles: cumplir con normativas de privacidad médica chilenas

## Known context
- **Modelo Person existente**: Tiene RUT, nombres, email, phone, address
- **Modelo Event**: Ya tiene campos médicos (category, amountExpected, amountPaid, attended, dosage, treatmentStage)
- **Certificados médicos**: Ya capturan datos del paciente (nombre, RUT, fecha nacimiento, dirección, diagnóstico)
- **Flujo actual**: Doctor usa Google Calendar para agendar, luego genera certificados manualmente
- **Problema**: Datos del paciente se repiten en cada certificado, no hay historial clínico

## Risks
1. **Duplicación con Person**: Crear modelo `Patient` separado vs extender `Person`
2. **Sobre-ingeniería**: Crear demasiados módulos desde el inicio
3. **Privacidad**: Datos médicos sensibles en DB sin encriptación
4. **Migración**: Datos de certificados existentes quedan huérfanos
5. **UX compleja**: Demasiados pasos para registrar un paciente
6. **Sincronización**: Desconexión entre Calendar events y registros de pacientes

## Options (2–4)

### Opción 1: Modelo Patient Separado (Clean Slate)
**Estructura:**
- Modelo `Patient` independiente con todos los campos
- Modelo `Consultation` para consultas médicas
- Separación total de contextos (empleados vs pacientes)

**Pros:**
- Separación clara de contextos
- Modelo limpio sin campos legacy
- Fácil agregar campos médicos específicos

**Contras:**
- Duplicación de datos básicos (RUT, nombre, contacto)
- Dos modelos para "personas"
- Complejidad en búsquedas globales

### Opción 2: Extender Person con PatientProfile (Hybrid)
**Estructura:**
- Reutilizar `Person` para datos básicos
- `PatientProfile` 1:1 con `Person` para datos médicos
- Un solo lugar para RUT, nombre, contacto

**Pros:**
- Reutiliza datos básicos de Person
- Un solo lugar para RUT, nombre, contacto
- Fácil convertir Person → Patient

**Contras:**
- Person se vuelve más complejo
- Joins adicionales en queries
- Mezcla contextos (empleados/pacientes)

### Opción 3: Modular por Contextos Clínicos (Progressive) ⭐
**Estructura:**
- `Patient` con datos básicos
- Módulos opcionales: `PatientAllergies`, `PatientImmunology`
- Lazy loading: solo cargas lo que necesitas
- Cada módulo tiene su UI dedicada (tabs)

**Pros:**
- Modular: solo cargas lo que necesitas
- Escalable: fácil agregar nuevos módulos
- Evita sábanas de datos
- Cada módulo tiene su UI dedicada

**Contras:**
- Más tablas en DB
- Complejidad en queries con múltiples módulos
- Requiere UI para gestionar módulos

### Opción 4: Hybrid con Timeline (Event-Sourced)
**Estructura:**
- `Patient` con snapshot de estado actual
- `MedicalEvent` para timeline de eventos
- Historial completo auditable

**Pros:**
- Historial completo auditable
- Flexible para cualquier tipo de evento
- Fácil generar timeline visual

**Contras:**
- Queries complejas para estado actual
- Requiere lógica de agregación
- Más espacio en DB

## Recommendation

**Implementar Opción 3 (Modular por Contextos) con elementos de Opción 1**

**Razones:**
1. **Evita sábanas**: Cada módulo es una sección separada en la UI
2. **Escalable**: Empezar con módulos básicos, agregar más después
3. **Performance**: Solo cargas datos relevantes por contexto
4. **UX**: Formularios pequeños y enfocados
5. **Separación clara**: Patient != Person (diferentes contextos)

**Fases de implementación:**

**Fase 1 - Core (MVP):**
- Modelo `Patient` con datos básicos
- Modelo `Consultation` (consultas médicas)
- Link `MedicalCertificate` → `Patient`
- UI: Lista de pacientes + formulario básico

**Fase 2 - Módulos Clínicos:**
- `PatientAllergies` (alergias conocidas)
- `PatientImmunology` (tratamientos de inmunoterapia)
- UI: Tabs por módulo en perfil del paciente

**Fase 3 - Integración:**
- Link `Consultation` ↔ `Event` (Calendar)
- Auto-crear consulta desde evento de calendario
- Timeline visual de historial médico

## Acceptance criteria

### Fase 1 - Core (MVP)
- [ ] Modelo `Patient` en schema con: id, rut (unique), names, birthDate, email, phone, address
- [ ] Modelo `Consultation` con: id, patientId, date, reason, diagnosis, treatment, notes
- [ ] `MedicalCertificate.patientId` (opcional, para link)
- [ ] Endpoint POST `/api/patients` (crear paciente)
- [ ] Endpoint GET `/api/patients` (listar con búsqueda por RUT/nombre)
- [ ] Endpoint GET `/api/patients/:id` (detalle + consultas)
- [ ] UI: `/patients` - Lista con búsqueda
- [ ] UI: `/patients/new` - Formulario de registro (max 6 campos visibles)
- [ ] UI: `/patients/:id` - Perfil con tabs (Info, Consultas, Certificados)

### Fase 2 - Módulos Clínicos
- [ ] Modelo `PatientAllergies` (1:1 con Patient)
- [ ] Modelo `PatientImmunology` (1:1 con Patient)
- [ ] UI: Tab "Alergias" en perfil
- [ ] UI: Tab "Inmunoterapia" en perfil
- [ ] Lazy loading: solo cargar módulo si tiene datos

### Fase 3 - Integración
- [ ] Campo `Consultation.eventId` (link a Calendar)
- [ ] Botón "Crear consulta" desde evento de calendario
- [ ] Timeline visual en perfil del paciente
- [ ] Auto-completar datos del paciente en certificados
