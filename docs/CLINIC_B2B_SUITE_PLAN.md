# Plan suite clínica + B2B (Bioalergia)

Roadmap de implementación derivado de research (legal Chile, papers, docs de paquetes,
aerobiología Biobío) + plan por feature. Rama base: `feat/clinic-b2b-suite`.

## Estado

| Feature | Esfuerzo | Estado | Gate |
|---|---|---|---|
| P1 — Páginas de condiciones (SEO) + micro-quizzes | M | ✅ HECHO | Validación clínica del alergólogo antes de publicar |
| shared-pricing — precios por cliente | L | ⏳ pendiente | Tests de @@allow por cuenta |
| shared-productdoc — IFU/SDS/CoA en R2 | M | ⏳ pendiente | SDS/IFU SIEMPRE públicos |
| P3 — Widget polen (Google grass + calendario árboles/malezas) | M | ⏳ pendiente | **`GOOGLE_POLLEN_API_KEY` (tú)** + Maps ToS cache diario |
| shared-reminder — scheduler adherencia (graphile-worker) | M | ⏳ pendiente | Ley 21.719 consent por canal |
| B2B portal (login-to-see-price, RFQ cart, cuenta/reorden, capacitaciones) | XL | ⏳ pendiente | depende de shared-pricing/productdoc |
| P2 — Adherencia SCIT/SLIT + eDiary (CSMS) | L | ⏳ pendiente | **EIPD + sign-off alergólogo**; copy seguridad no descartable |
| P7 — Salud ocupacional B2B (drogas/alcohol) | XL | ⏳ pendiente | **Revisión legal BLOQUEANTE** (ver abajo) |

## Secuencia recomendada

1. **P1** (hecho) — estático, sin backend, mayor valor/esfuerzo.
2. **shared-pricing** (L) + **shared-productdoc** (M) — prerequisitos del portal B2B, sin gate clínico.
3. **P3 polen** (M) — independiente; necesita `GOOGLE_POLLEN_API_KEY` en Railway api + GCP billing.
4. **shared-reminder** (M) — motor graphile-worker para P2 y P7. Gate consent desde día 1.
5. **B2B portal** (XL) — sobre shared-pricing/productdoc + Company/Quote/QuoteProduct existentes. Interno: precio→IFU→RFQ cart→cuenta/reorden→aprobaciones→capacitaciones.
6. **P2 adherencia** (L) — sobre shared-reminder; gate EIPD + sign-off clínico. Empezar por recordatorios de visita SCIT.
7. **P7 ocupacional** (XL) — ÚLTIMO; mayor riesgo legal. Landing + lead capture temprano (bajo riesgo, reusa ReactivoLead); diferir modelo de testeo/cadena-custodia/confirmatorio hasta sign-off legal.

## Infra compartida (construir una vez)

- **shared-pricing**: extender `PriceListItem` (productId/companyId/tierCode/minQty/effective/priority) + `AccountMembership` + `services/b2b-pricing.ts` (waterfall contract>customer>tier>list, server-side, nunca expone precio público). Tests fuertes.
- **shared-productdoc**: `ProductDocument` (type/visibility/lotNumber-nullable) + `services/product-documents.ts` reusando `modules/cloudflare/r2.ts`. SDS/IFU público, CoA/contrato gated.
- **Pollen cache**: `PollenForecast` + `queue/tasks/pollen-sync.ts` cron (TZ=America/Santiago) + `services/pollen.ts`. Overwrite diario (Maps ToS). Sitio lee cache, nunca llama a Google por page-view.
- **shared-reminder**: `ReminderSchedule` + `queue/tasks/adherence-reminder-{send,tick}.ts` espejando `wa-scheduled-send.ts`. Consent-gated (ConsentRecord por canal), wording neutro, opt-out RFC8058.
- **Recharts v3**: agregar `recharts` + override `react-is` en `pnpm-workspace.yaml` (NO package.json). P3 polen + P2 trends.
- **`<ConditionQuiz>`** (hecho): extraído de eres-alergico + `lib/quiz.ts`. Reusado por los 7 micro-quizzes.
- **`medicalWebPageJsonLd()`** (hecho) en `lib/seo.ts`.
- **Tagging compliance vitrina**: `complianceTag` (REGULADO_DECRETO25 / PHARMA_ANAMED / SIN_CONTROL_OBLIGATORIO_AUN) + titular del registro en `QuoteProduct`.

## Hechos clave del research

- **Google Pollen API**: Chile = **solo gramíneas** (sin árboles/malezas). `GET pollen.googleapis.com/v1/forecast:lookup?key=...&location.latitude=-36.827&location.longitude=-73.050&days=5`. Free ~5.000 calls/mes → cache diario sobra. Árboles/malezas = calendario polínico curado (no hay sensor Biobío: polenes.cl llega a Talca; SINCA es PM, no polen).
- **Calendario polínico Chile (hemisferio sur)**: árboles (plátano oriental, ciprés) ago–oct; gramíneas sep–ene; malezas (Rumex, Plantago, artemisa) nov–feb. Estudio más cercano: Temuco (no Concepción).
- **Decreto Exento N°25 (vig. 19-mar-2026)**: +39 DM/DMDIV a registro ISP obligatorio. Verificar **por producto** de la vitrina. Revendedor puede vender bajo registro del importador (Inmunodiagnóstico) **solo si NO importa/almacena**; si almacena necesita Inscripción/Bodega/CDA propia. Glide-path enforcement ~mar-2028/2029. (NO generalizar "todo DMDIV requiere registro" — refutado.)
- **Adherencia AIT**: recordatorios email+SMS T-7 y T-1 (asociados a mejor asistencia; causalidad fuerte NO probada — tratar como best-practice). eDiary CSMS = dSS (suma 6 ítems/6) + dMS (mayor escalón medicación). Gate completitud ≥80%; CSMS es carga sintomática agregada, **NO** veredicto de eficacia por paciente.

## Gates legales (resumen)

- **P1**: disclaimer referencial + lastReviewed/reviewedBy; copy revisado por alergólogo.
- **P3**: Maps ToS = cache temporal (overwrite diario); no pintar árbol/maleza vacío de Google como "0".
- **P2/shared-reminder**: Ley 21.719 — consent por propósito+canal distinto de tratamiento y marketing; wording neutro (sin diagnóstico en el cuerpo); opt-out 1 clic; clínica = ANCI (reporte brecha 3h).
- **P2 eDiary**: dato sensible — EIPD/DPIA pre-go-live; copy seguridad (SAMU 131, observación 30 min, reacción bifásica) firmado por clínico y no descartable.
- **P7 ocupacional (BLOQUEANTE)**: (1) testeo atado a cláusula RIOHS del cliente (Código del Trabajo Art.5/153/154/154bis/184); bloquear onboarding sin atestación RIOHS. (2) tamizaje presuntivo **NUNCA** final — confirmación GC-MS obligatoria (ISP); positivo final imposible sin confirmatorio enlazado. (3) dato sensible → EIPD + consent por propósito. (4) resultado individual al empleador SOLO con consentimiento expreso separado del trabajador (Art.154bis); default = agregado pasa/falla. (5) mandatos sectoriales DS132 minería / "Ley Alberto" transporte (cadencia 4 meses + registro 7 días). Reconfirmar cutoffs ISP, acreditación lab, retención máx, reglamento Ley Alberto.

## Notas de implementación

- Convención golden 2026: handlers oRPC finos → services → `DomainError` → `toORPCError`. ZenStack v3; tsgo (no tsc). Migraciones solo-prod: `migrate create --create-only` → revisar SQL → `migrate deploy`. 100% HeroUI v3 compound components.
- Sin `Stepper` en HeroUI v3 → RFC cart wizard hand-rolled (ProgressBar/Tabs + Form por paso).
- Transacciones SIEMPRE en service layer (evitar cliff TS2321 por `$transaction` inline).
