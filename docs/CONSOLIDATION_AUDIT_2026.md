<!-- Generado por workflow consolidation-audit (run wf_db11bca2-228), 2026-06-17. 8 secciones mapeadas, 6 cazadores cross-cutting, 114 candidatos→42 confirmados (verificados adversarialmente). -->

# Roadmap de Consolidación — Intranet Bioalergia
## "El Pulpo" — absorber, fusionar, centralizar progresivamente

> Verificado contra el repo (2026-06-17): **101 rutas**, **~60 items de nav**, **173.839 LOC** en `apps/intranet/src`, **77 archivos `orpc/`** en api, **119 bloques `app.use(.../rpc/*)`** en `app.ts`.

---

## 1. Diagnóstico

**Dónde está la grasa.** El intranet creció por aposición: cada feature nueva trajo su propia copia del mismo andamiaje en vez de adoptar primitivos que YA existen. El síntoma más caro no es lógica duplicada (esa es relativamente poca) sino **boilerplate de presentación clonado**: 64 funciones `to*ApiError` byte-idénticas en `features/*/orpc.ts`, 61 archivos que hand-rollean `Modal.Backdrop/Container/Dialog` cuando existe `components/ui/AppModal.tsx`, 24 archivos que arman a mano el bloque `DatePicker+Calendar` cuando existen `AppDatePicker`/`AppDateRangePicker` (solo 15 lo adoptaron), 10 `<table>` nativas y 10 definiciones locales de `MetricCard/StatCard/KpiCard`. La adopción de primitivos quedó a medias: los primitivos existen y están probados, pero la migración nunca se completó.

**Patrones de fragmentación.** Tres ejes: (a) **dispersión de IA** — el mismo dominio repartido en varias entradas de nav y secciones (5 superficies de calendario; DTE/Haulmer en 3 secciones; 7-8 páginas de cumplimiento sueltas; 2 consentimientos contiguos; catálogos de precios en 2 secciones); (b) **doble implementación del mismo patrón** — `confirmAction` (Store) vs `useConfirmDialog` (Context) coexisten, con **2 archivos importando ambos** (`UserManagementPage.tsx`, `TimesheetEditor.tsx`); rutas full-page que duplican lo que ya hace un modal (`patients/new.tsx`, 357 LOC, **cero nav entrante**); (c) **directorios sin criterio** — `features/operations/inventory` y `features/operations/supplies` que solo alojan páginas cuya lógica vive enteramente en `features/inventory`/`features/supplies`.

**Estado de adopción de primitivos.** Es el hallazgo clave para priorizar: **no hay que inventar casi nada**. `Page`/`PageHeader`/`PageState`, `DataTable`, `AppModal`, `AppDatePicker`/`AppDateRangePicker`, `confirmAction`, `ProtectedTab`, `useLazyTabs`, `calendar/MetricCard` ya existen y tienen adopters. El trabajo del Pulpo es **completar adopciones** (barato, mecánico, alto volumen de LOC) ANTES de las fusiones estructurales, porque cada fusión de páginas (calendar host, compliance host) se abarata si los paneles que va a absorber ya usan los primitivos compartidos. Hacer las fusiones primero obliga a refactorizar dos veces.

---

## 2. Olas de consolidación

### WAVE 1 — Quick-wins (do-now): delete-dead + adopt-primitive mecánico
Bajo riesgo, alto volumen de LOC, sin decisiones de plataforma pendientes. Ideal para subagentes paralelos (regla: `type-check --force` tras ediciones masivas).

| # | Qué | Archivos | Esf. | Impacto | LOC | Riesgos | Orden |
|---|-----|----------|------|---------|-----|---------|-------|
| 1.1 | **Borrar ruta muerta `patients/new`** (la cubre `CreatePatientModal`, superset) | `routes/_authed/patients/new.tsx` | S | -1 ruta | **-357** | Regenerar `routeTree.gen.ts` (plugin, no a mano); verificar `TanStackSelectField` siga usado en otro lado | 1º (cero deps) |
| 1.2 | **Borrar router Hono muerto `routes/calendar.ts`**, extraer solo el webhook a `google-calendar-webhook.ts` | `apps/api/src/routes/calendar.ts` (1720 LOC), `google-calendar-webhook.ts` | M | -1450/-1680 LOC api | **-1450** | Mover JUNTOS el estado de módulo del webhook (debounce 5s, `webhookSyncTimer`, helpers `executeWebhookSync`/`buildStructuredSyncLogEntries`); smoke `resourceState sync→200`, `exists→debounce` | indep |
| 1.3 | **Adoptar `AppDatePicker` single** en 6 sitios ISO-string limpios | `patients/$id/new-consultation.tsx`, `new-payment.tsx`, `patients/new.tsx`†, `finance/loans/pages/LoansPage.tsx`, `personal-finance/CreateCreditForm.tsx`, `PayInstallmentModal.tsx` + borrar helper local `LoanDateField` en `LoanForm.tsx` | S | corrige overflow `max-w-none` | **-180** | Solo single-date controlado; NO tocar Date-object/TZ-aware (ServiceForm, ConversationParts) | tras 1.1 (new.tsx) |
| 1.4 | **Adoptar `AppDateRangePicker`** en stragglers finance + HR + clínica | `finance/FinancialDashboardPage.tsx`, `statistics/FinanzasStatsPage.tsx`, `finance/DailyIncomePage.tsx`, `hr/reports/ReportsPage.tsx`, `certificates/MedicalCertificatePage.tsx`, `exam-reports/ExamReportsListPanel.tsx`, `operations/supplies/TreatmentAnalyticsPage.tsx` | S | unifica filtro fecha | **-300** | Preservar side-effects extra (`setQuickRange('custom')` en FinanzasStats); extender primitivo con `groupClassName`/`labelHidden` opcionales para look filter-bar | indep |
| 1.5 | **Centralizar `toApiError`** (PIEZA 1, shims re-export) | `lib/api-client.ts` (+ helper) + 64 `features/*/orpc.ts` | S | unifica error mapping | **-1500** | Dejar shim `export const toXApiError = toApiError` para no tocar ~495 call-sites; excepción `skin-tests-orpc.ts` (mensaje custom) | indep |
| 1.6 | **Envolver borrados de asistencia en `confirmAction`** | `attendance/AdminAttendancePage.tsx` | S | cierra hueco a11y/safety | ~0 | IIFE `void (async)` (onPress síncrono); envolver en `onDelete` de `AdminAttendanceContent`, mantener `MarksTable` tonto | indep |
| 1.7 | **Centralizar `TimesheetEntrySchema` + normalizer** | `hr/timesheets/schemas.ts` (nuevo) + `timesheets/api.ts`, `reports/api.ts`, `timesheets-audit/api.ts` | S | dedupe triple | **-28** | Helper genérico `<T extends {work_date}>` para no borrar campos extra de audit; re-aplicar cast `as TimesheetEntry` | indep |
| 1.8 | **Unificar dirs `features/operations/inventory` → `features/inventory`** | `operations/inventory/pages/InventoryPage.tsx` (+test) → `features/inventory/pages/`, plegar `InventoryItemsPanel` wrapper | S | -1 dir, -13 LOC wrapper | -13 | git-mv + 1 import en `routes/_authed/inventory/index.tsx` | indep |
| 1.9 | **Unificar dirs `features/operations/supplies`** (mover `SuppliesPage` → `features/supplies`, `TreatmentAnalyticsPage` → `features/calendar/pages`) | `operations/supplies/pages/*` + `routes/_authed/operations/supplies.tsx`, `clinical/analytics.tsx` | S | -1 dir | ~0 | 2 git-mv independientes; `getRouteApi` hardcodeado sigue válido | indep |
| 1.10 | **`pages/operations/*` → `Page`/`PageHeader`/`PageState`** | `HaulmerDtePage.tsx`, `ReviewsModerationPage.tsx`, `ChannelPricesPage.tsx` | S | mata anti-patrón `text-3xl`, doble-h1 | **-60** | ChannelPrices es tab-panel: NO PageHeader, solo eliminar `<header>`; Haulmer mantiene skeletons granulares (4 queries) | indep |
| 1.11 | **`PageHeader` en 9 páginas compliance icon-box** | `consent/`, `clinical-consent/`, `data-rights/`, `processing-activities/`, `breach-incidents/`, `complaints/`, `settings/RetentionPoliciesPage`, `SecurityAlertsPage`, `PriceListPage` | S | unifica type-ramp | **-120** | Dropea icon-box (confirmar con owner); limpiar imports lucide muertos. **Hacer ANTES de Wave-3 compliance host** o se subsume | antes de 3.2 |
| 1.12 | **`patientKeys`/`patientQueries` en lista+detalle** | `patients/index.tsx`, `patients/$id/index.tsx`, `PatientDetailPage.tsx` + invalidadores `["patient", id]` | S | single-source queryKeys | ~0 | Dejar `dte-sources` como literal (o agregar `patientKeys.dteSources`); no colgar de `nameSearch` | indep |

**Wave 1 total estimado: ~-4.000 LOC, -1 ruta, -2 dirs.** †`patients/new.tsx` se borra en 1.1 — si 1.1 va primero, sáquelo de 1.3.

---

### WAVE 2 — Fusiones medianas (do-now/do-later M)
Reducen items de nav y absorben páginas-satélite en hosts existentes. Requieren wiring de tabs/modales pero el patrón ya existe en el repo.

| # | Qué | Archivos | Esf. | Impacto | LOC | Riesgos | Orden |
|---|-----|----------|------|---------|-----|---------|-------|
| 2.1 | **`patients/$id/new-*` → modales del detalle** | `new-budget.tsx`, `new-consultation.tsx`, `new-payment.tsx` → `features/patients/components/New*Modal.tsx`, `PatientDetailPage.tsx` | M | -3 rutas | **-150** neto | `new-budget` grid → Drawer/`max-w-4xl`; agregar `staticData.relatedSubjects:['Budget','Consultation','PatientPayment']` al index para no perder mapeo RBAC; regenerar routeTree | dep 1.3, 1.12 |
| 2.2 | **"Ingresos Diarios" → tab del Tablero** + unificar cache a `statsKeys` | `finanzas/daily.tsx` (→ redirect), `dashboard.tsx`, `DailyIncomePage.tsx`, `FinancialDashboardPage.tsx` | S | -1 nav | -40 | Drift de criterio (`amountPaid>0` vs todos los eventos): decidir semántica antes; redirect para bookmarks | dep 1.4 |
| 2.3 | **Moderación de reseñas → tab de `/store`** | `operations/reviews.tsx` (→ redirect), `store/index.tsx`, `ReviewsModerationPage.tsx` | S | -1 nav | ~0 | Extender `tabKey` z.enum; `ProtectedTab action='update' subject='Product'`; agregar render test (hoy 0) | dep 1.10 |
| 2.4 | **`DataTable` en patient-campaigns + outreach detail** (solo lo tabular) | `patient-campaigns/CampaignRecipientsPanel.tsx`, `outreach/OutreachCampaignDetailPage.tsx` | M | a11y skeletons, quita slice(0,100) | **-80** | Mantener search+select como toolbar externo (`enableToolbar={false}`); NO tocar los 2 card-grids | indep |
| 2.5 | **`DataTable` en 6 `<table>` finance/personal-finance** (por tandas ROI↓) | `ExpensesPanel`, `ExpenseServicesModal`, `ProviderCredentialsTab`, `ExpenseLinkModal`, `UtilityBillHistoryModal`, `HaulmerDtePage` | L | -6 tablas hand-rolled | **-200** | Por tandas, no 1 PR; celda Δ de UtilityBill compleja; sin gate CI (no urgente) | tras 2.4 |
| 2.6 | **`StatTile` canónico** (promover `calendar/MetricCard`) | `calendar/MetricCard.tsx` → `components/ui/StatTile.tsx` + ~8 call-sites núcleo | M | -8 defs locales | **-80** | Solo el subconjunto real (variant card/flat, icon, tone); NO dashboard hero/PhoneTools/QualityBadge; regen Chromatic; añadir story | tras 1.10/1.11 |
| 2.7 | **`StatCard` en HR reports + auditoría** (consume 2.6) | `hr/reports/ReportsPage.tsx`, `hr/timesheets-audit/TimesheetAuditPage.tsx` | M | dedupe stat-row | -60 | Ampliar tonos `secondary`/`accent` + prop `icon` en StatTile | dep 2.6 |
| 2.8 | **`AppModal` Tanda A** (modales simples sin CloseTrigger/Footer separado) | `EditPatientModal`, `RoleFormModal`, `PatientSelectModal`, `ShipmentTrackingModal`, `CampaignFormModal`, `AddressFormModal`, `CreatePostModal` | M | -7 hand-rolls | **-150** | Aceptar unificación backdrop /40→/50, bg→content1 (documentar); mover footer al prop; snapshot por modal | indep |
| 2.9 | **`SearchField` primitivo** (opción A: solo el campo, no SearchableDataTable) | `quotes/index.tsx`, `companies/index.tsx` | S | dedupe buscador | -24 | NO crear 3er mecanismo de tabla; cada página conserva su `useMemo` filter | indep |

**Wave 2 total: ~-900 LOC, -5 rutas/nav.**

---

### WAVE 3 — Reestructuraciones grandes (do-later L)
Alto valor de IA pero requieren refactor Page→Panel, migración de `getRouteApi`→`useSearch`, y matrices de permisos. Hacer **en sesión/branch única** (evitar revert wars) y **después** de que Wave 1 dejó los paneles con primitivos compartidos.

| # | Qué | Archivos | Esf. | Impacto | LOC | Riesgos | Orden |
|---|-----|----------|------|---------|-----|---------|-------|
| 3.1 | **Calendario: fusionar agenda+día+heatmap en host `/calendar`** (FASE A — NO los 5) | `calendar/index.tsx`, `clinical/agenda.tsx`, `clinical/day.tsx`, `clinical/heatmap.tsx` + `CalendarVistaPanel.tsx` | L | **-3 nav** | -300 | Defaults `from/to` DISTINTOS por tab (semana vs ±1mo): selector por `?tab`, no global; migrar `getRouteApi(strict)`→`useSearch({strict:false})`; redirects `/clinical/agenda\|day\|heatmap`; portar override `_authed.tsx:71` (p-1 de day); **NO fusionar `classify`** (schema disjunto + permiso WRITE); actualizar `route-utils.test.ts` + `CalendarVistaPanel.test.tsx` | tras Wave 1 |
| 3.2 | **Host `/admin/compliance` (8 tabs)** | `settings/{consent,clinical-consent,data-rights,processing-activities,breach-incidents,complaints,retention,security-alerts}.tsx` + nuevo host (espejo `admin/database.tsx`) | L | **-7 nav** | -200 neto | Refactor Page→Panel ×8 (~2700 LOC); `ProtectedTab` por-tab (retention=update, resto=read Setting); `complaints` ya tiene sub-tabs → anidados; demote h1→h2 (a11y); redirects bookmarks | tras 1.11 |
| 3.3 | **Consolidar `consent`+`clinical-consent`** | (subsumido en 3.2 como 2 tabs) | — | -1 nav | -20 | Preservar distinción legal (21.719 vs 20.584) en subtítulo por-tab; NO fusionar contratos oRPC | dentro de 3.2 |
| 3.4 | **Host `/settings/integraciones`** (doctoralia + haulmer) | `settings/doctoralia.tsx`, `settings/haulmer.tsx` + host | M | -1 nav | -10 | Doctoralia ya tiene 5 sub-tabs → anidación; fusionar `relatedSubjects`; payoff modesto (2 items) | bajo prioridad |
| 3.5 | **Unificar confirm: `useConfirmDialog` → `confirmAction`** (PASO 0 decisión + migración) | `context/ConfirmDialogContext.tsx` (borrar) + 13 call-sites + `main.tsx` | M | 1 sistema confirm | -100 | **Decisión de plataforma primero**; `confirmAction` NO tiene `status` icon → extender host O perder íconos en deletes peligrosos; QA visual Chromatic; `dialog-discovery.spec` asume `role=dialog` vs `alertdialog` | dep decisión |
| 3.6 | **`makeFeatureClient` factory** (`toApiError` PIEZA 2) | `lib/` + 8 orpc Sistema primero | M | dedupe client construction | -200 | Genérico `<C>` para unificar split cast/genérico; NO hornear `csrfFetch`/superjson (calendar/haulmer divergen → opts override); `type-check --force` | dep 1.5 |
| 3.7 | **`makeORPCHandlers` factory** (api, PIEZA A solo) | 61 `apps/api/src/orpc/*.ts` + `handler-factory.ts` | L | dedupe handler-export | **-1500** | Medir tsgo baseline → 1 archivo (balances.ts) → re-medir → bulk; preserva `typeof xORPCRouter`; NO tocar middleware de permisos (bespoke) | tras medición |
| 3.8 | **Registry/loop de montaje en `app.ts`** | `apps/api/src/app.ts` + `orpc/mount.ts` | M | quita 119 bloques | **-1000** | ORDEN LOAD-BEARING (event-links antes de dte-analytics; haulmer-dte antes de haulmer); no reordenar a array contiguo (SSE/OAuth/webhooks intercalados); smoke routing por prefijo | tras 3.7 |
| 3.9 | **`AppModal` Tanda B** (los 9 con CloseTrigger/Footer/3xl-5xl) | `CompanyFormModal`, `QuoteProductFormModal`, `ArticleFormModal`, `CreditDetailsModal`, `CommerceSelectorModal`, `ExpenseLinkModal`, `ExpenseServicesModal`, `EventDteLinkModal`, `UtilityBillHistoryModal` | L | -9 hand-rolls | -200 | PRIMERO extender AppModal (`showCloseButton`, footer real, size map 2xl/3xl/5xl) | dep 2.8 |

**Wave 3 total: ~-3.700 LOC, -13 nav.**

---

## 3. El Pulpo — orden de centralización

El principio: **centralizar el primitivo antes de fusionar lo que lo consume.** Cada tentáculo absorbe más barato si la presa ya habla el idioma del primitivo.

```
TENTÁCULO 0 — Limpiar lo muerto (sin dependencias, hazlo ya)
  1.1 patients/new.tsx · 1.2 routes/calendar.ts · 1.8/1.9 dirs operations
        ↓ libera ruido, baja LOC base

TENTÁCULO 1 — Centralizar primitivos de presentación (alimenta TODO lo demás)
  1.5 toApiError ──────────────┐ (habilita 3.6 makeFeatureClient)
  1.3+1.4 AppDate(Range)Picker │
  1.10+1.11 Page/PageHeader ───┤ (habilita 2.6 StatTile, 3.1/3.2 hosts)
  2.6 StatTile ────────────────┤ (habilita 2.7 HR cards)
  2.8 AppModal Tanda A ────────┘ (habilita 3.9 Tanda B)
        ↓ ahora los paneles ya usan primitivos compartidos

TENTÁCULO 2 — Absorber satélites en hosts EXISTENTES (barato porque ya hay host)
  2.2 daily→Tablero · 2.3 reviews→/store · 2.1 patients/new-*→modales
        ↓ reduce nav sin crear hosts nuevos

TENTÁCULO 3 — Crear hosts NUEVOS y fusionar (caro, hacer al final)
  3.2 compliance host (consume 1.11 PageHeader) → subsume 3.3 consent
  3.1 calendar host (consume nada de Wave1 directo, pero menos ruido)
        ↓

TENTÁCULO 4 — Backend dedup (medir antes, regla #11/#13)
  3.6 makeFeatureClient (dep 1.5) · 3.7 makeORPCHandlers → 3.8 app.ts registry
```

**Dependencias críticas (no invertir):**
- **1.11 PageHeader compliance → 3.2 compliance host.** Si haces el host primero, refactorizas el header dos veces. Hazlo después solo si decides NO hacer 1.11 standalone.
- **1.5 toApiError → 3.6 makeFeatureClient.** Los shims de 1.5 capturan el 80% del ahorro sin riesgo; el factory es la cereza.
- **3.7 makeORPCHandlers → 3.8 app.ts registry.** El registry monta los handlers que el factory normaliza.
- **2.6 StatTile → 2.7 HR cards.** No extraigas dos veces.
- **3.5 confirm unify** requiere **decisión de plataforma fuera de los call-sites** (afecta ~52 sitios, no 13). Bloquéala hasta decidir `status` icon.

**Anti-orden (NO hagas):** no empieces por los hosts de Wave 3 — son los más riesgosos y se abaratan ~30% si Wave 1 ya pasó. No toques `app.ts` (3.8) sin medir tsgo baseline (cuello histórico ZenStack >180s).

---

## 4. Métricas objetivo

| Métrica | Actual | Objetivo | Δ |
|---|---|---|---|
| **Items de nav** | ~60 | **~42** | **-18** (calendar -3, compliance -7, consent -1, integraciones -1, daily -1, reviews -1, + misc) |
| **Rutas** (`routes/*.tsx`) | 101 | **~92** | -9 (patients/new -1, new-* -3, daily -1, reviews -1, compliance→redirects -2, agenda/day/heatmap→redirects -1 neto visible) |
| **`to*ApiError` duplicados** | 64 | **1** | -63 |
| **Modales hand-rolled** (`Modal.Backdrop`) | 61 | **~45** (Tanda A) → ~36 (Tanda B) | -16/-25 |
| **Date-pickers hand-rolled** | 24 | **~10** (resto TZ-aware, fuera de scope) | -14 |
| **`<table>` nativas** | 10 | **~4** | -6 |
| **Defs `MetricCard/StatCard/KpiCard`** | 10 | **~3** (canónico + dashboard hero + chips especiales) | -7 |
| **Sistemas de confirm** | 2 | **1** | -1 |
| **LOC eliminado estimado** | — | **~8.500-9.000** (Wave1 ~4k + Wave2 ~0.9k + Wave3 ~3.7k) | de 173.839 ≈ **-5%** |

---

## 5. Quick-wins inmediatos (HOY, sin riesgo, sin decisiones pendientes)

Ordenados por ratio LOC-borrado / riesgo. Todos son `delete-dead` o `adopt-primitive` mecánico; ejecutables por subagentes en paralelo (recordar `pnpm type-check --force` por turbo-cache tras ediciones cross-file).

1. **`git rm apps/intranet/src/routes/_authed/patients/new.tsx`** → regenerar routeTree (dev/build). **-357 LOC, -1 ruta.** Cero migración (el modal es superset; verificar `TanStackSelectField` siga usado).
2. **`toApiError` en `lib/api-client.ts` + 64 shims re-export.** **-1500 LOC.** Riesgo casi nulo (preserva los ~495 call-sites).
3. **Borrar router muerto `apps/api/src/routes/calendar.ts`** (extraer webhook completo a `google-calendar-webhook.ts`). **-1450 LOC.** Mover JUNTOS el estado de módulo del debounce; smoke del webhook.
4. **`AppDatePicker` en los 6 single-date ISO** + matar helper `LoanDateField`. **-180 LOC** + corrige overflow del calendario.
5. **`AppDateRangePicker` en 7 stragglers** finance/HR/clínica. **-300 LOC.** Preservar `setQuickRange('custom')`.
6. **`Page`/`PageHeader` en `pages/operations/*` (3) + 9 compliance.** **-180 LOC**, corrige doble-h1 (a11y). (Compliance: hacerlo ya cierra deuda y abarata el host 3.2 después.)
7. **`TimesheetEntrySchema` → `hr/timesheets/schemas.ts`.** **-28 LOC.**
8. **`confirmAction` en `AdminAttendancePage`** (2 deletes). Cierra hueco de safety; IIFE `void(async)`.
9. **Unificar dirs `features/operations/{inventory,supplies}`.** -2 dirs, git-mv + 1 import c/u.
10. **`patientKeys`/`patientQueries`** en lista+detalle+invalidadores.

> **Suma de quick-wins inmediatos: ~-4.000 LOC, -1 ruta, -2 dirs, en cambios sin decisiones de plataforma ni refactor de tipos.** Es el primer apretón del Pulpo: limpia lo muerto y completa las adopciones de primitivos que ya existen, dejando el terreno listo para que las fusiones de Wave 2/3 sean baratas.
