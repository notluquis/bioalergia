# Contexto — Sistema TDAH-friendly de gestión financiera/operacional Bioalergia

> Documento de hand-off entre chats. Captura estado del monorepo, modelos relevantes, patrones, frameworks evidence-based, marco legal Chile, y decisiones pendientes. Versión iterada — operador real = Lucas (dueño + ADHD), enfoque pivotó de "IA primero" a "frameworks evidence-based primero, IA diferida".

---

## 1. Snapshot del proyecto

- **Repo**: monorepo `pnpm` workspaces + Turborepo
- **Apps**: `apps/api` (Hono v4 + Node 26 type-stripping), `apps/intranet` (React 19 + Vite + HeroUI v3 + TanStack Router/Query), `apps/site` (marketing), `apps/doctoralia-scraper`, `apps/local-mail-agent`
- **Packages**: `packages/db` (ZenStack v3 + Kysely sobre Postgres), `packages/orpc-contracts` (Zod v4 contracts)
- **Auth**: PASETO + Argon2 + WebAuthn/TOTP MFA + CASL ability roles
- **Deploy**: Railway (branch `forthcoming-ocelot`), Postgres en Railway
- **Branding/UX**: HeroUI v3 compound components, i18n español (Chile), `@internationalized/date` + dayjs locale `es`
- **Seguridad**: CSP estricta + Trusted Types, RLS infra (gated por flag), audit log con HMAC hash chain RFC 6962-style, web push para alertas
- **Estado actual**: 113 modelos en `schema.zmodel`, finanzas/clínica/inventario/calendario/WhatsApp/Doctoralia ya en producción.

---

## 2. Modelos de dominio financiero ya implementados

### 2.1 Núcleo transaccional
- **`FinancialTransaction`** — cada movimiento bancario o caja. Campos: `date`, `description`, `amount` Decimal(19,4), `type` (INCOME/EXPENSE), `categoryId`, `counterpartId`, `sourceId` (idempotencia con feed externo), `comment`. Indexes en date/type/category/counterpart.
- **`TransactionCategory`** — taxonomía colorada con icon.
- **`FinancialAutoCategoryRule`** — reglas auto-categorización (filtros por counterpart, monto, descripción regex).
- **`FinancialTransactionAllocation`** — particiona transacción en sub-asignaciones (split). Conecta con `CompensationProfile`.

### 2.2 Allocations / Compensaciones (multi-doctor / multi-servicio)
- **`CompensationProfile`** — perfil de pago (un doctor o tipo de servicio). Conecta a `TransactionCategory` y `Counterpart`.
- **`CompensationPeriodBudget`** — monto base mensual (YYYY-MM) por profile. Lockeable.
- Use case: cada transacción puede split-arse a profiles, agregando un % o monto fijo a cada doctor/colaborador.

### 2.3 Pacientes / facturación
- **`Patient`**, **`Budget`** (presupuesto multi-pago), **`PatientPayment`** (cada cuota abonada al budget, método: Transfer/Cash/Card, ref opcional).
- **`Consultation`** — visita médica, vincula al patient.
- **`PatientDteSaleSource`** — vínculo a DTE (boleta/factura electrónica chilena Haulmer).
- **`DTESaleDetail`**, **`DTEPurchaseDetail`**, **`DTELineItem`** — feed SII Chile vía Haulmer scraper. Analytics propio en `apps/intranet/src/features/finance/dte-analytics`.

### 2.4 Gastos y servicios recurrentes
- **`Expense`** + **`ExpenseService`** + **`ExpenseTransaction`** + **`UtilityAccount`** — facturación servicios recurrentes (agua, luz, internet, arriendo). Genera `FinancialTransaction` programados.
- **`Service`** + **`ServiceSchedule`** — calendario servicios facturables a clínica.

### 2.5 Préstamos
- **`Loan`** — préstamo otorgado o recibido (`borrowerType`: STAFF/PATIENT/EXTERNAL). Decimal(15,2), interés simple o compuesto, frecuencia, total cuotas, fecha inicio, status.
- **`LoanSchedule`** — cada cuota con `expectedAmount`, `expectedPrincipal`, `expectedInterest`, `paidAmount`, `paidDate`, `transactionId`. Status: PENDING/PAID/PARTIAL/LATE.
- **`PersonalCredit`** + **`PersonalCreditInstallment`** — créditos al staff (vinculado a `Employee`).

### 2.6 Counterparts / cuentas externas
- **`Counterpart`** — entidades comerciales (proveedores, doctores, pacientes con cuentas, bancos). Tiene `CounterpartAccount` (CBU/RUT bancario), `SettlementTransaction`, `ReleaseTransaction`, `WithdrawTransaction`.
- **`DailyBalance`** — saldo diario por counterpart.

### 2.7 RRHH / Operacional
- **`Employee`** + **`EmployeeTimesheet`** + **`AttendanceMark`** + **`OfficeNetwork`** (geofencing IP).
- **`InventoryItem`** + **`InventoryMovement`** + **`SupplyRequest`** + **`CommonSupply`** + **`DailyProductionBalance`**.

### 2.8 Pasarela de pago
- **`apps/intranet/src/features/finance/mercadopago`** + integración real en prod. MP MCP server disponible (`mcp__mercadopago__*`).

---

## 3. UI/features ya construidas

### En `apps/intranet/src/features/finance/`:
- `pages/FinancialDashboardPage.tsx` — KPIs por rango, `FinancialSummaryCards`, `IncomeBreakdown`.
- `pages/CashFlowPage.tsx` — flujo de caja.
- `pages/DailyIncomePage.tsx` — ingreso diario.
- `balances/` — saldos por counterpart.
- `loans/` — listado + detalle préstamos + schedule.
- `mercadopago/` — gestión pagos online.
- `dte-analytics/` — análisis facturación SII.
- `statistics/` — métricas operacionales.

### En `apps/intranet/src/features/dashboard/`:
- `DashboardTransactionsSection.tsx` — widget transacciones recientes.

### Modules backend `apps/api/src/modules/`:
- `calendar`, `certificates`, `chilexpress`, `clinical-records`, `haulmer`, `outreach`, `patients`, `wa-cloud`.
- `apps/api/src/services/` tiene servicios cross-cutting: clinical-record-imports, expenses, etc.

---

## 4. Patrones técnicos críticos

### 4.1 oRPC contract-first
```ts
export const fooORPCRouter = base.prefix("/api/orpc/foo").router(fooRouterBase);
// ⚠ siempre .prefix() ANTES de .router()
```

### 4.2 ZenStack
- Editar **solo** `packages/db/zenstack/schema.zmodel`. Nunca tocar Prisma generados.
- `pnpm generate` / `pnpm migrate:dev` / `pnpm migrate:deploy`.
- Kysely pin 0.28.17 vía `pnpm.overrides` (ZenStack v3.6.4 no soporta 0.29).

### 4.3 Frontend
- **HeroUI v3 compound** obligatorio. Tailwind v4. NO Provider component.
- TanStack Router file-based. `routeTree.gen.ts` auto-generado.
- TanStack Query + oRPC client.
- Forms: `<Form validationBehavior="aria">` + Zod v4.
- Fechas: `@internationalized/date` + dayjs locale es. NUNCA native `<input type="date">`.

### 4.4 Auto memoria
6 memorias relevantes en `~/.claude/projects/-Users-notluquis-bioalergia/memory/`.

### 4.5 Patrones que NO funcionan
- pnpm v10+ deploy sin `dependenciesMeta.injected: true` por consumer (✅ wireado)
- `VITE_*` vars sin `ARG` en Dockerfile build stage (✅ wireado)
- FB.login con callback async → bridge void IIFE
- WhatsApp Embedded Signup feature `whatsapp_business_app_onboarding` requiere BSP/TP — Bioalergia bloqueado

---

## 5. Visión del sistema TDAH (frameworks-first, IA diferida)

### 5.1 Idea central revisada
Sistema **proactivo** para Lucas (operador único, dueño, ADHD) que:
1. **Detecta** tareas pendientes (cuotas vencidas, txs sin categoría, presupuestos stale, DTEs sin reconciliar).
2. **Prioriza** con Impact/Effort matrix (NO Eisenhower — falla justo donde TDAH falla).
3. **Sugiere** próximos pasos con quick-action inline (1 click).
4. **Genera reportes** auto al jefe (semanal/mensual).
5. **Ejecuta** acciones repetitivas (recordatorios WhatsApp, conciliación).

**Pivot clave (2026-05)**: IA difer ida a fase 3+. Primero construir el sistema sobre frameworks evidence-based (sección 11). IA entra después como capa de aceleración, no como motor.

### 5.2 Componentes UX TDAH-friendly
- **Single-task focus mode**: 1 acción visible a la vez. Drilldown opcional.
- **Daily standup** al login: top-N acciones priorizadas por Impact/Effort.
- **Quick capture global** (cmd+K): input flotante con BlockNote → IA o regla categoriza después.
- **Time-boxing flexible**: bloques 45min (no 90 Newport), tarea nombrada por bloque, buffer transición.
- **Visual progress**: barras progreso runway / cobranza / gastos vs budget.
- **Notificaciones push** (ya hay `PushSubscription` infra).
- **Sin overwhelm**: top-N + drilldown, nunca tablas de 500 filas.
- **Undo everywhere**: toast "deshacer" en cada acción.
- **Externalización Barkley**: tiempo visible (countdown), working memory representado físico (cards), point of performance (UI donde el evento pasa).

### 5.3 Datos faltantes / a modelar
- **`Trigger`** — implementation intentions codificadas. Campos: `condition` (cron expr o evento), `action` (notif/quickaction), `enabled`, `lastFired`. Ej: `if día 25 mes, then notif "revisar gastos fijos"`.
- **`ActionItem`** — vista materializada o tabla. Origen, priorityImpact (1-5), priorityEffort (1-5), score = impact/effort, dueDate, status, suggestedAction, owner.
- **`FinancialGoal`** — target revenue, max expense ratio, target loan recovery, mensual.
- **`CashflowSnapshot`** — proyección 13-week rolling, regenerada cada lunes.
- **`Briefing`** — daily/weekly summary cacheado (cuando aparezca IA).
- **`Note`** — quick-capture BlockNote, tipo brain-dump + tags PARA (Project/Area/Resource/Archive).

---

## 6. Tareas concretas iniciales (priorizadas — versión revisada)

### Fase 0 — Frameworks foundation (1 semana)
1. Documentar flujo CBT Safren simplificado (capture → review → next action → weekly review viernes) en `/docs/operator-flow.md`.
2. Decidir bloque calendar primario: Apple Calendar (sync CalDAV) o calendar interno extender.
3. Definir Impact/Effort scoring rules para `ActionItem`.

### Fase 1 — ActionItem + briefing manual (2 semanas)
1. Modelo `ActionItem` + service que la genera (cron diario: cuotas vencidas, txs sin categoría, budgets stale, DTEs sin reconciliar).
2. Página `/finance/actions` con Impact/Effort matrix + single-task focus mode.
3. Daily briefing card en `/dashboard` (top 5 priorizadas).
4. Quick-action inline (registrar pago, categorizar, marcar resuelta).

### Fase 2 — 13-week rolling cashflow + triggers (2 semanas)
1. `forecastCashFlow13w(asOf)` — proyecta 13 semanas basado en `LoanSchedule` PENDING + `ExpenseService` scheduled + `DTE` histórico (promedio últimos 12w + estacionalidad simple). Lib: `arima` npm o `simple-statistics` regresión.
2. Página `/finance/forecast-13w` — grid 13 columnas, fila por categoría, weekly totals + running balance.
3. Alertas runway < 4 semanas → push notification.
4. Modelo `Trigger` — UI declarativa "si X then Y" (cron + notif). Reemplaza scheduled jobs hardcoded.

### Fase 3 — Quick capture + Notion-like (2 semanas)
1. Cmd+K global con BlockNote editor (sección 13.3).
2. `Note` model con tags PARA + link a entidades (`patientId`, `transactionId`, `actionItemId`).
3. Apple Calendar two-way sync vía CalDAV (sección 13.1). Bloques de focus aparecen en Apple Calendar nativo.
4. Page `/notes` con database view filtros PARA.

### Fase 4 — Reportes automatizados (1 semana)
1. Cron weekly: PDF (Puppeteer) → email jefe via Resend.
2. `Report` model con `kind`, `url`, `period`.
3. UI `/finance/reports` histórico.

### Fase 5 — IA básica (3 semanas, opcional)
1. Categorización auto txs (clasificador stateless, no agente). Modelo: Haiku 4.5.
2. Daily briefing prose-generation (1 call/día, Sonnet 4.6).
3. Quick-capture parser ("Gasto $5000 farmacia hoy" → FinancialTransaction draft). Haiku.
4. Opcional chat contextual con tool calling (postergable si fases 1-4 alcanzan).

### Fase 6 — Continuo
1. Computer Use para conciliar cuentas bancarias sin API (BancoEstado etc) — solo si fase 5 ya estable.
2. Gamificación leve "loss-forgiving" si Lucas lo pide después.

---

## 7. Costos estimados IA (cuando se active)

Para 1 operador moderado (30-50 chats/día, 10-15k tokens):
- **Opus 4.7**: ~$15-25/día → $450-750/mes
- **Sonnet 4.6**: ~$3-6/día → $90-180/mes
- **Haiku 4.5**: ~$0.5-1/día → $15-30/mes

Patrón híbrido (Haiku categorización, Sonnet decisiones, Opus reportes complejos): ~$80-150/mes.

**Prompt caching aplicable** (90% off cached input): cachear system prompt + tool schemas + reference data (TransactionCategory, CompensationProfile, Counterpart top). TTL 1h. Ahorro estimado ~50-70% si sesiones > 5min.

**Batch API**: 50% off para reportes nocturnos no time-sensitive.

---

## 8. Riesgos / consideraciones

- **Acceso datos médicos**: cualquier IA tool que pueda leer `Patient`, `ClinicalRecord`, `Consultation`, `MedicalCertificate` debe loguear (audit log + HMAC chain ya wireado) y respetar consent. Cód Sanitario + Ley 20.584 → ficha clínica = dato sensible, reserva.
- **Ley 21.719 LPDP** (vigencia 1 dic 2026, sanción hasta 4% facturación o 20.000 UTM):
  - Derecho oposición decisiones automatizadas → IA toma decisiones financieras solo con supervisión humana visible.
  - DPIA requerida para tratamientos alto riesgo (perfilamiento, datos sensibles).
  - DPO obligatorio si manejo significativo datos personales.
  - Notificación incidentes en plazo.
- **Acciones escritura IA**: jamás auto-ejecutar. UI preview + botón "ejecutar". Non-negotiable.
- **Prompt injection**: pacientes pueden poner texto en refs transferencia → sanitizar antes de pasar al modelo.
- **PII en prompts**: RUT, dirección, teléfono → anonymizar con IDs internos. Lookup table local.
- **Budget guardrails**: cron mensual mata feature si spend IA pasa cap (TBD).

---

## 9. Stack sugerido para chat nuevo

```
Bioalergia (monorepo pnpm/turbo, apps/api Hono + apps/intranet React 19 + HeroUI v3 + TanStack + ZenStack v3 + Kysely + Postgres Railway).

Finance ya implementado: FinancialTransaction, Loan, Budget, PatientPayment, CompensationProfile, DTE Chile via Haulmer, Mercadopago.

Operador único = Lucas (dueño, ADHD, técnico).

Construir asistente TDAH-friendly con frameworks-first (CBT Safren/Solanto, implementation intentions Gollwitzer, Barkley externalización, 13-week TWCF, Impact/Effort, PARA, single-task focus). IA diferida a Fase 5+.

Leer doc completo: docs/context-tdah-finance-system.md
```

---

## 10. Direcciones (research ya completado)

- **Maybe Finance** (open source, AGPLv3): archivado por equipo original 2023, fork community `Sure` activo. Tiene MCP server. Buena referencia UI/UX self-hosted finance.
- **Tana / Capacities / Mem.ai**: PKM con AI. Capacities mejor para ADHD por móvil + AI chat similar a Mem. Tana power-user (curva alta).
- **Akiflow / Sunsama / Motion**: Akiflow rituales rígidos (a veces overwhelm), Sunsama capacity limits + reflection (mejor ADHD), Motion AI re-prioriza (distrae ADHD según user reports). Sunsama gana en ADHD.
- **Linear / Cal.com / Reflect**: skip por ahora, no calza con caso clínica.

---

## 11. Frameworks evidence-based (núcleo del sistema)

### 11.1 Capa financiera — 13-week rolling cashflow (TWCF)
Estándar SMB servicios. Calza clínica porque payroll pesado (doctores 40-60% revenue) + cobro diferido (presupuestos pago multi-cuota).

- **Cadencia**: lunes 9am update con actuals → roll forward 1 semana → 13 semanas visibles siempre.
- **Mapeo modelos**: inflows = `LoanSchedule` PENDING + `Budget` pago esperado + `DTE` ventas recurrentes. Outflows = `ExpenseService` schedule + `CompensationPeriodBudget` + `Loan` cuotas a pagar.
- **Beneficio**: 4 semanas antes de shortfall ves el problema, tiempo para renegociar o cobrar.
- **No es P&L**: cash vs profit. P&L existente sigue. Esto agrega capa liquidez.

### 11.2 Capa ejecutiva TDAH — CBT Safren + Solanto
Ambos RCT positiva en adultos ADHD. Núcleo skill-building, no insight.

**Safren módulo 1 (organización/planificación)** — codificado en UI:
1. Lista única tareas + calendario único (NO multi-app). → `/finance/actions` + Apple Calendar sync.
2. Prioridad A/B/C — no Eisenhower (falla en clasificar). Aplica Impact/Effort en su lugar.
3. Descomposición pasos pequeños — cada `ActionItem` debe ser ≤1 acción concreta accionable, no proyecto.

**Solanto** — time-mgmt + mantención skill. Aporta:
- Weekly review viernes (15min, prompt UI)
- Procesar inbox brain-dump notes → ActionItem o archivar

### 11.3 Implementation Intentions (Gollwitzer) — codificado como `Trigger`
Meta-análisis 642 tests + estudios específicos ADHD (Gawrilow & Gollwitzer 2008) confirman efecto en task initiation y response inhibition.

Formato `if [trigger contextual], then [acción]`:
- `if lunes 9am, then abrir /finance/forecast-13w y revisar`
- `if día 25 mes, then notif "revisar gastos fijos próximo mes"`
- `if FinancialTransaction sin categoría > 3 días, then notif "categorizar pendientes"`
- `if runway < 4 semanas, then push notif + email`

**Modelo DB**:
```
Trigger {
  id, name, ownerId
  condition: JSON  // { type: 'cron' | 'event', expr: '0 9 * * 1' | 'tx.uncategorized.gt', threshold: 3 }
  action: JSON     // { type: 'notify' | 'create_action_item' | 'open_url', payload }
  enabled: boolean
  lastFiredAt
}
```

UI declarativa para crear/editar — operador codifica sus propios if-then sin tocar código.

### 11.4 Externalización Barkley
"Out of sight, out of mind." Reglas de diseño aplicables:

| Principio Barkley | Implementación UI |
|---|---|
| Tiempo visible | Countdown timers, no solo fechas. Reloj grande en focus mode. |
| Working memory externalizada | Cards visibles, no acordeones colapsados por default. |
| Point of performance | Acción disponible donde el evento ocurre (categorizar tx desde la lista, no menú aparte). |
| 30% lag adultos ADHD | Asumir que cualquier deadline necesita buffer +30%. |

### 11.5 Brown 6-cluster EF model
Diagnóstico → diseño:
1. **Activation** (iniciar) → 5-second nudge + quick capture sin fricción
2. **Focus** → focus mode single-task + bloquear notif no-prioritarias
3. **Effort** → bloques 45min con descanso obligatorio
4. **Emotion** → no streaks loss-based (shame trigger); celebración suave completar
5. **Memory** → externalización (sección 11.4)
6. **Action** (auto-regulación) → confirmation step en acciones destructivas + undo

### 11.6 PARA + BASB (Tiago Forte) — para captura/notas
- **Projects**: campañas activas (cierre mes, cobranza vencidos). Cierre con deadline.
- **Areas**: dominios continuos (caja, doctores, pacientes, RRHH). Sin deadline.
- **Resources**: docs reusables (template reporte jefe, scripts WhatsApp).
- **Archive**: cerrado/inactivo.

**CODE**: Capture (BlockNote inbox) → Organize (PARA tag) → Distill (highlight key) → Express (genera ActionItem o Reporte).

### 11.7 Time blocking flexible (NO rígido)
Research específico ADHD: rigid backfires.
- Bloques 45min (no 90)
- Tarea nombrada por bloque (no categoría vaga)
- Buffer 15min transición
- Reschedulable sin shame ("movido" no "fallado")

### 11.8 Impact/Effort matrix (reemplazo Eisenhower)
Eisenhower falla en ADHD: clasificar urgent/important requiere lo que ADHD le falta.

Impact/Effort:
- Impact 1-5 (qué tan grande es el resultado)
- Effort 1-5 (cuánto cuesta hacerlo)
- Score = impact / effort (quick wins arriba)
- Visualizable como scatter 4 cuadrantes: quick wins / major projects / fill-ins / time wasters

### 11.9 Quick capture con perdón
- Streaks loss-based fallan (-32% reactivación research ADHD).
- Usar "loss-forgiving": saltar 1 día NO rompe. Notif celebratoria al volver, no shame.
- Lucas dijo "no entiendo gamificación" → diseño default: **sin** badges/puntos. Sólo:
  - Visual progress bar sutil (no número crece dopamine-style)
  - Daily/weekly "done" count, no streak
  - Opt-in luego si Lucas pide

### 11.10 Frameworks descartados
- **GTD completo**: pesado sin adaptación. Tomar solo: inbox capture + next action + 2-min rule.
- **Eisenhower**: ver 11.8.
- **Pomodoro estricto 25min**: muy corto para muchos ADHD. Usar 45min flexible.
- **5-second rule Mel Robbins**: cero evidencia empírica. Skip o micro-nudge UX no más.
- **Motion AI**: re-prioriza constante, distrae ADHD.
- **Streaks loss-based** tipo Duolingo: shame spiral. Evitar.

---

## 12. Marco legal Chile aplicable

### 12.1 Ley 21.719 — Protección Datos Personales
- **Vigencia**: 1 diciembre 2026.
- **Reforma**: deroga ley 19.628.
- **Crea**: Agencia de Protección de Datos Personales (autoridad de control).
- **Sanción**: hasta 20.000 UTM o 4% ingresos anuales reincidencia grave.
- **Impacto IA en Bioalergia**:
  - Derecho ciudadano a oposición a decisiones automatizadas / IA / perfilamiento → cualquier acción auto IA sobre `Patient` necesita supervisión humana + explicabilidad.
  - DPIA (evaluación impacto privacidad) obligatoria para tratamientos alto riesgo: datos sensibles (clínicos), perfilamiento (scoring crédito interno staff/pacientes).
  - DPO si manejo "significativo" — clínica con 70k+ pacientes probable que califique.
  - Registro actividades tratamiento — feature `AuditLog` ya cubre técnicamente.
  - Notificación incidentes en plazo (TBD reglamento).
- **Acción concreta**: doble-lane (IA financiera autónoma + IA clínica solo asiste con confirmación humana). Sección 11.

### 12.2 Ley 21.668 — Interoperabilidad ficha clínica
- **Publicación**: 28 mayo 2024.
- **Modifica**: ley 20.584 (Derechos y Deberes Paciente).
- **Obligaciones**:
  - Conservar ficha clínica ≥15 años.
  - Interoperabilidad entre prestadores (público + privado).
  - Cumplir Ley protección datos privacidad.
- **Reglamento MINSAL**: 18 meses para actualizar. Implementación gradual.
- **Impacto Bioalergia**: cuando salga reglamento, posible export FHIR. Diseñar `ClinicalRecord` con migración futura en mente.

### 12.3 Ley 20.584 — Derechos y Deberes Paciente (ya vigente)
- Ficha clínica = **dato sensible**, calidad **reservada**.
- Acceso restringido a quienes prestan atención directa, excepciones legales.
- Aplica a `Patient`, `ClinicalRecord`, `Consultation`, `MedicalCertificate`.
- IA con acceso → audit log forzoso + minimización datos.

### 12.4 SII Chile — DTE / Boleta electrónica
- DTE obligatorio desde 2018 todos contribuyentes.
- **Mayo 2026**: nuevos requisitos guías despacho.
- **Marzo 2026**: boleta electrónica obligatoria para resto contribuyentes.
- Bioalergia ya integrado vía Haulmer (`apps/api/src/modules/haulmer`).
- API SII pública existe, Haulmer abstrae.

### 12.5 Previred / cotizaciones previsionales
- Plataforma centralizada estado.
- **2026**: deuda previsional = semáforo rojo crediticio. Cumplimiento estricto.
- APIs disponibles (Buk/Nubox/Defontana integran). No urgente para Lucas (1 operador) pero si crece staff: integrar.

---

## 13. Stack técnico adiciones

### 13.1 Apple Calendar sync (CalDAV)
- iCloud usa CalDAV (no REST, no OAuth). Endpoint: `caldav.icloud.com`.
- Auth: Apple ID + app-specific password 16-char (Lucas genera en appleid.apple.com).
- Lib Node/TS recomendada: **`tsdav`** (mature) o `ts-caldav` (más nuevo, lightweight).
- Parsing ICS: `node-ical`.
- Two-way sync posible. Pattern: poll cada 5min, ETag para diff, write con If-Match.
- Storage: tabla `CalendarSync` con account creds (encrypted, KMS o env), last sync token, mapping localEventId ↔ caldavEventId.
- Servicios broker alternativos (skip si self-host preferible): Nylas, Aurinko, OneCal.

### 13.2 MCP servers existentes finance (para reusar después)
- **Ledger CLI MCP** — double-entry accounting query LLM.
- **LunchMoney MCP** — personal finance (no aplica directo pero patrón referencia).
- **Maybe Finance MCP** — querying self-hosted instance.
- **Mercadopago MCP** — ya en env de Lucas.
- **Decisión**: construir custom **Bioalergia DB MCP** que exponga tools financieras de `apps/api/src/orpc/*`. Reusar mismas tools dentro de intranet chat (cuando IA active fase 5).

### 13.3 Editor block-based Notion-style — BlockNote
- **`@blocknote/react`**: block-based (Notion style), built sobre Prosemirror + Tiptap. MIT.
- Tipos bloque: paragraph, heading, list, table, image, code, custom.
- Real-time collab opcional (Yjs) — no necesario fase actual.
- Alternativa: TipTap headless (más flexible, sin UI default — más trabajo).
- **Uso**: quick-capture cmd+K, `Note` model contenido, brain-dump page.
- Persistencia: JSON serializable directo a Postgres jsonb.

### 13.4 Stack agentes / IA framework (cuando aplique fase 5+)
- **Anthropic Agent SDK** directo — Claude-native, Computer Use compatible. Recomendado para Bioalergia (Claude primary).
- Alternativas evaluadas:
  - Mastra (TS-first, serverless, memory built-in) — buen second choice si SDK queda corto.
  - Vercel AI SDK — solo para chat streaming UI React, no agent loops complejos.
  - LangGraph — Python primero, no serverless, skip.
- **Decision (preliminar)**: Anthropic Agent SDK + Mastra como fallback si necesita memory semántica.

### 13.5 Forecasting libs
- **`arima` npm** (zemlyansky) — ARIMA/SARIMA/SARIMAX/AutoARIMA Node + browser.
- **`simple-statistics`** — fallback regresión lineal/promedios.
- **`timeseries-analysis`** — AR coefficients.
- **Decisión**: arima primero, fallback simple-statistics para casos baja data. Reconsiderar foundation models (Chronos, TimesFM) si caso requiere precisión alta.

### 13.6 PDF + Email transactional
- **PDF**: Puppeteer (ya disponible Node). 200-500MB RAM/instancia, 2-5s/gen. Para reportes weekly volumen bajo: aceptable.
  - Alternativa volumen alto: Gotenberg (Docker, multi-format) o react-pdf (light, solo React).
- **Email**: Resend (free 3k/mes, React Email native, mejor DX). Postmark si deliverability crítica. Loops si lifecycle marketing (no aplica caso interno).
- **Decisión preliminar**: Puppeteer + Resend.

### 13.7 Bancos chilenos
- **BCI**: API Market público (apimarket.bci.cl). Best opción.
- **BancoEstado / Santander / Itaú / Scotiabank**: APIs limitadas / cerradas. Opciones:
  - **Floid** (floid.io) — broker pago, integra varios bancos.
  - **Boufin** — Open Data API.
  - **Prometeo** — banca cross-LatAm.
  - **Scraping con Anthropic Computer Use** ($0.08/h running) — viable para conciliación nocturna baja frecuencia.
  - **CSV manual** — fallback siempre acepta.

---

## 14. Diseño UI/UX guidelines TDAH (WCAG + neurodiversidad)

### 14.1 Contraste y tipografía
- WCAG AA: contraste 4.5:1 cuerpo, 3:1 large/bold.
- Tipografía: sans-serif, 14-16px body, max 70 chars/línea, NO italics largos.
- HeroUI v3 default contrast → verificar tokens custom con axe-core o Lighthouse.

### 14.2 Reducción carga cognitiva
- Layouts simples, navegación consistente.
- Jerarquía visual clara (3 niveles max).
- Espaciado generoso (8px grid mínimo, prefer 16-24).
- Un CTA primario por vista.

### 14.3 Animaciones y movimiento
- Auto-play prohibido (WCAG 2.2.2).
- Animaciones < 5s o controles pausar.
- Respeto `prefers-reduced-motion`.
- Loading skeletons sutiles, no spinners agresivos.

### 14.4 Color y categorización
- Color como complemento, nunca único canal (accesibilidad + ADHD coding).
- Paleta limitada (5-7 colores semánticos: success, warning, danger, info, neutral + 2 categóricos máx por contexto).
- ADHD-friendly: color-coding por categoría/prioridad ayuda memoria visual (recuperación más rápida).

### 14.5 Personalización
- Toggle focus mode (esconde non-essential).
- Tamaño fuente ajustable.
- Tema dark/light (HeroUI v3 nativo).
- Densidad UI (cómodo vs compacto).

### 14.6 Feedback y reversibilidad
- Toast de confirmación cada acción (3s, dismiss).
- Undo en acciones destructivas (5-10s window).
- Loading states explícitos (skeleton específico, no genérico).
- Errores: mensaje + acción ("reintentar", "ver detalles"), no solo "error".

### 14.7 Patrones Notion a replicar
- Database con vistas múltiples (table, board, calendar, gallery).
- Filter + sort + group persistente por vista.
- Inline editing (no modal para cambios simples).
- Drag-to-reorder.
- Slash commands en BlockNote (`/heading`, `/list`, `/finance-tx`).
- Backlinks (note menciona otra → link bidireccional).

---

## 15. Decisiones pendientes (para chat #3 — orden por reversibilidad)

### ONE-WAY (difícil revertir, debate antes de decidir)

**D1 — Lane privacidad IA** (cuando active fase 5)
- Reversibilidad: ONE-WAY (cambiar después = re-architect tools, audit, permisos).
- Fase: 5+
- Opciones:
  - A) Lane único: IA lee todo con audit.
  - B) Doble lane: financiera autónoma, clínica con human-in-loop.
  - C) Solo financiera, anonymiza identidad.
  - D) Híbrido: anonymizada default, des-anonymiza on-demand con permiso explícito.
- Recomendación: D (encaja Ley 21.719).

**D2 — Auth IA scope**
- Reversibilidad: ONE-WAY (re-architect permisos).
- Fase: 5+
- Opciones:
  - A) Hereda CASL del usuario invocante.
  - B) Service account propio scope fijo.
  - C) Híbrido: hereda CASL + scope restrictivo adicional (no write financiero sin dual-approval).
- Recomendación: C.

**D3 — Modelo Trigger (implementation intentions)**
- Reversibilidad: ONE-WAY (cambia schema DB + UI declarativa).
- Fase: 2
- Opciones:
  - A) Tabla `Trigger` JSON `condition` + `action` (declarativa, schema flexible).
  - B) Strongly-typed: enums por tipo trigger + action.
  - C) DSL custom (overkill).
- Recomendación: A (JSON validated Zod en orpc-contract).

**D4 — DPO / compliance Ley 21.719**
- Reversibilidad: ONE-WAY (compliance afecta arquitectura entera).
- Fase: pre-1 dic 2026 (urgente)
- Opciones:
  - A) Lucas asume DPO interino + asesoría legal puntual.
  - B) Contratar externo.
  - C) Skip hasta tener volumen mayor (riesgo sanción).
- Decisión requiere consulta legal real. Documentar como pendiente bloqueante para fase 5.

### TWO-WAY (reversible, decisión liviana)

**D5 — Calendar primario**: Apple Calendar (CalDAV) vs interno extender. Fase 3.
- Recomendación: Apple Calendar como source-of-truth, interno espejo read-mostly.

**D6 — Editor quick-capture**: BlockNote vs TipTap vs simple textarea. Fase 3.
- Recomendación: BlockNote (default UI, MIT, suficiente).

**D7 — Forecasting lib**: arima vs simple-statistics vs foundation model. Fase 2.
- Recomendación: arima + fallback simple-statistics.

**D8 — PDF gen**: Puppeteer vs react-pdf vs Gotenberg. Fase 4.
- Recomendación: Puppeteer.

**D9 — Email vendor**: Resend vs Postmark vs Plunk. Fase 4.
- Recomendación: Resend.

**D10 — Bancos integración**: BCI API + Floid + Computer Use fallback. Fase post-5.
- Recomendación: BCI API primero (público), Floid si Lucas tiene más bancos, Computer Use último recurso.

**D11 — Gamificación**: off / mínima / leve. Fase 5+.
- Lucas dijo "no entiendo" → default OFF. Opt-in después si curiosidad.

**D12 — Budget cap IA**: hard $X / soft con auto-degrade.
- Recomendación: soft con auto-degrade Opus → Sonnet → Haiku al 80% cap, hard kill al 100%. Cap inicial $100/mes.

**D13 — Time blocking integración**
- Bloques focus en Apple Calendar nativo (CalDAV write) vs solo UI interno. Fase 3.
- Recomendación: ambos (UI interno + sync Apple).

**D14 — Body doubling async**
- Implementar dashboard "X sesiones focus activas" o skip. Fase 5+.
- Recomendación: skip hasta validar caso (Lucas operador único — body doubling con quién?).

**D15 — Reportes jefe formato**
- PDF email vs URL dashboard vs WhatsApp resumen.
- Pendiente input Lucas (frecuencia, métricas críticas, jefe interactúa o solo lee).

**D16 — Email digest vendor adicional WhatsApp**
- ¿Notif internas via WhatsApp Cloud (ya wireado) o solo push?
- Recomendación: push primero (no espera respuesta), WhatsApp solo para externo (pacientes).

### Pendientes input Lucas (no son decisiones técnicas, son contexto)
- Volumen tx/día, pacientes activos, presupuestos/mes.
- Stack bancos real que usa.
- Stack pagos completo (Mercadopago confirmado, ¿más?).
- Si jefe existe formalmente o es Lucas solo (memoria sugiere clínica con dueño = Lucas; "jefe" puede ser él reportándose a sí mismo).
- Métricas top 5 que Lucas quiere ver primero al login.

---

## 16. Memorias persistentes a actualizar

Una vez decidido approach, agregar a `~/.claude/projects/-Users-notluquis-bioalergia/memory/`:
- `project_tdah_finance_system.md` — arquitectura + fases definitivas
- `feedback_frameworks_first.md` — pivot frameworks → IA diferida + why
- `feedback_ai_costs.md` — modelos elegidos + budget cap (cuando se active)
- `reference_ai_tools.md` — lista tool-calling funcs expuestas
- `reference_legal_chile.md` — Ley 21.719, 21.668, 20.584, SII deadlines

---

**Generado**: 2026-05-12
**Última iteración**: 2026-05-12 (pivot frameworks-first, marco legal Chile, decisiones clasificadas)
**Branch actual**: `forthcoming-ocelot`
**Modelos en schema.zmodel**: 113
**Features finanzas wireadas**: 8
**Próximo paso sugerido**: chat #3 — iterar decisiones ONE-WAY (D1-D4) antes de empezar Fase 0.
