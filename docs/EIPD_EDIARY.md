# EIPD — eDiary de síntomas (CSMS) · Bioalergia

**Evaluación de Impacto en Protección de Datos Personales (EIPD / AIPD)**
Ley 21.719 (Chile), Art. 15 ter · Tratamiento: *Diario electrónico de síntomas alérgicos del paciente*

| Campo | Valor |
|---|---|
| Versión del documento | 0.1 (BORRADOR — no firmado) |
| Fecha | 2026-06-23 |
| Responsable del tratamiento | Bioalergia [RAZÓN SOCIAL + RUT — PENDIENTE] |
| Delegado de Protección de Datos (DPO) | [PENDIENTE — designar si aplica] |
| Estado | Pre-go-live. **Obligatorio completar y firmar ANTES de activar la recolección.** |
| Vinculado a RAT | Entrada "eDiary síntomas" del Registro de Actividades de Tratamiento [crear] |

> ⚠️ **Advertencia de vigencia/regulación.** La Agencia de Protección de Datos Personales fue creada por la Ley 21.719 (vigencia 1-dic-2026). El **reglamento, la lista oficial de operaciones de alto riesgo y las directrices mínimas de EIPD (delegadas por el Art. 15 ter a la Agencia) están PENDIENTES** a junio 2026. Este documento se construye sobre el **piso legal del estatuto + estructura DPIA estilo GDPR**; debe remapearse a la plantilla oficial cuando la Agencia la publique. Verificar la numeración exacta de artículos (15 ter, 14 quinquies, 8 bis, 12, 16) contra el texto consolidado en BCN (Ley 21.719) antes de citar textualmente. Sign-off legal + clínico requerido.

---

## 0. Resumen ejecutivo

El eDiary recolecta a diario, de forma sistemática y continua, **datos sensibles de salud** del paciente (síntomas alérgicos + uso de medicación de rescate) y los procesa mediante un **scoring automatizado (CSMS)** que puede generar alertas a un clínico. Esto dispara la obligación de EIPD por **dos vías independientes** del Art. 15 ter: (i) tratamiento de datos sensibles y (ii) evaluación sistemática basada en tratamiento automatizado (profiling). La EIPD debe completarse **antes** del go-live.

**Decisión de riesgo (a completar al final):** [ ] Proceder · [ ] Proceder con mitigaciones · [ ] Consulta previa a la Agencia.

---

## 1. Necesidad de la EIPD y base legal del disparo

- **Norma:** Art. 15 ter, Ley 21.719 — la EIPD es obligatoria *previa* al inicio del tratamiento cuando éste, por su naturaleza, alcance, contexto, tecnología o fines, pueda producir **alto riesgo** para los derechos de los titulares.
- **Casos enumerados que aplican:**
  1. Evaluación sistemática basada en tratamiento automatizado, incluido **profiling/scoring** con efectos significativos → el cálculo del CSMS y las alertas al clínico.
  2. Tratamiento de **datos sensibles** (salud, Art. 2 lit. g) → síntomas + medicación.
- **Conclusión:** EIPD **requerida**. Realizar antes de habilitar la recolección.

---

## 2. Descripción sistemática del tratamiento

### 2.1 Finalidad(es)
| # | Finalidad | Base de licitud |
|---|---|---|
| F1 | Registro del diario de síntomas/medicación para **seguimiento clínico propio** del paciente (inmunoterapia SCIT/SLIT, rinitis/conjuntivitis alérgica). | Consentimiento explícito específico (no se apoya en la excepción sanitaria como base primaria). |
| F2 | **Scoring automatizado (CSMS)** y generación de tendencias/alertas para revisión por un clínico. | Consentimiento explícito separado (decisión basada en tratamiento automatizado, Art. 8 bis). |
| F3 | Uso **secundario estadístico/investigación** — solo con datos anonimizados/agregados. | Consentimiento explícito separado **o** anonimización irreversible. |
| F4 | **Comunicaciones** (recordatorios/correo vía Resend). | Opt-in separado + baja RFC8058 (ya implementado en el stack de email). |

### 2.2 Categorías de datos y titulares
- **Datos:** identificación del paciente (nombre, RUT), `entryDate`, 6 puntajes de síntomas (0–3), uso de medicación de rescate (3 escalones booleanos), puntajes computados `dSS`/`dMS`/`csms`, notas de texto libre, timestamps. **Todos = dato sensible (salud).**
- **Titulares:** pacientes de la clínica. **Menores de edad** → régimen reforzado + consentimiento del tutor [definir flujo].

### 2.3 Flujos y ciclo de vida
```
Paciente (PWA / magic-link)
  → API Hono (apps/api, oRPC)            [validación + compute CSMS server-side]
  → PostgreSQL (Railway)                  [almacenamiento primario; ZenStack @@allow/@@deny]
  → (export/portabilidad) R2 Cloudflare   [adjuntos/exportaciones, si aplica]
  → (comunicaciones) Resend               [encargado; posible transferencia internacional]
```

### 2.4 Encargados / terceros (sub-procesadores)
| Encargado | Rol | Finalidad | Notas / transferencia |
|---|---|---|---|
| **Railway** | Hosting + PostgreSQL | Almacenamiento y ejecución | Región/transferencia internacional [confirmar]; DPA [confirmar]. |
| **Cloudflare R2** | Object storage | Exportaciones/adjuntos | Cifrado en reposo; bucket público actual → **no usar para PHI**; usar bucket privado + descarga firmada si se almacena PHI. |
| **Resend** | Email | Recordatorios/notificaciones | Sub-procesador; posible transferencia a EE.UU.; DPA [confirmar]; opt-in F4 + RFC8058. |
| **Sentry** (si aplica) | Error tracking | Observabilidad | ⚠️ **Riesgo de fuga de PHI** en payloads de error → scrubbing obligatorio; confirmar que ningún puntaje/identificador entra a Sentry. |

### 2.5 Tecnología
Node 26 / Hono / oRPC / ZenStack v3 (políticas `@@allow`/`@@deny`) / Kysely / PostgreSQL. Cadena de auditoría HMAC ya operativa (registra lecturas de datos clínicos → confirmar que cubre lecturas del eDiary).

---

## 3. Necesidad y proporcionalidad

- **Minimización:** se recolecta únicamente lo necesario para el CSMS (6 síntomas + escalones de medicación + nota opcional). No se recolecta geolocalización, ni datos de terceros, ni más identificadores que los ya en ficha.
- **Alternativas menos invasivas evaluadas:** [completar — p.ej. captura presencial en visita vs. diario continuo]. El diario continuo es el instrumento estándar (EAACI/Pfaar) para carga sintomática longitudinal; no hay alternativa equivalente menos invasiva que cumpla la finalidad.
- **Proporcionalidad del scoring:** el CSMS es **carga sintomática agregada**, no un veredicto de eficacia ni un diagnóstico individual. No produce decisiones legales ni efectos significativos automáticos sobre el paciente (las alertas las interpreta un clínico — *human-in-the-loop*).

---

## 4. Derechos de los titulares (ARCO+P)

| Derecho | Implementación en el eDiary | SLA |
|---|---|---|
| **A**cceso | Vista del propio historial en la PWA. | 30 días corridos (+30 justificado). |
| **R**ectificación | Edición de la entrada del día (recálculo server-side). | 30 días. |
| **C**ancelación / supresión | Borrado de entradas / cierre de cuenta → job de borrado. | 30 días. |
| **O**posición | Opt-out del scoring automatizado (F2) sin perder el registro (F1). | 30 días. |
| **+ Portabilidad** | **Export self-serve** del diario en formato estructurado e interoperable (JSON/CSV). | 30 días. |
| **+ Bloqueo** | Suspensión temporal del tratamiento a solicitud. | 30 días. |

Canal de solicitudes + workflow interno con SLA de 30 días [definir owner]. Reusar `DataRightsRequest` existente si aplica.

---

## 5. Retención

- **Principio:** conservar solo el tiempo necesario para la finalidad; documentar **plazo o criterio** por tratamiento en el RAT.
- **Tensión a resolver:** mínimos de retención de **ficha clínica (leyes sanitarias)** vs. minimización del producto eDiary. [Definir regla explícita + job de borrado/anonimización; registrar el criterio aquí y en el RAT.]
- **Propuesta inicial (a validar con legal):** datos identificables del eDiary se conservan mientras dure la relación clínica + [N años por norma sanitaria]; vencido el plazo → anonimizar (conservar agregados sin identificador para F3) o borrar.

---

## 6. Decisiones automatizadas / scoring (Art. 8 bis)

- El CSMS + alertas = profiling de datos de salud. Salvaguardas:
  - **Human-in-the-loop:** ninguna decisión médica es totalmente automatizada; las alertas se enrutan a un clínico que decide. (Mitigación principal del "solely-automated".)
  - **Derecho a explicación:** la lógica del CSMS es transparente y explicable (fórmula `dSS = Σ6 síntomas/6`, `dMS = max escalón`, `CSMS = dSS + dMS`, rango 0–6).
  - **Aviso de transparencia** en el punto de recolección: describe el scoring, su lógica y consecuencias.
  - **Oposición** al scoring como consentimiento separable (F2).
- El scoring de datos sensibles es en sí un disparador de EIPD → documentado como riesgo dedicado (§7).

---

## 7. Identificación y evaluación de riesgos

| ID | Riesgo | Prob. | Impacto | Nivel |
|---|---|---|---|---|
| R1 | Acceso no autorizado a datos de salud (BD/R2). | [ ] | Alto | [ ] |
| R2 | Fuga de PHI a terceros (Sentry/logs/Resend). | [ ] | Alto | [ ] |
| R3 | Interpretación errónea del CSMS como veredicto de eficacia por el paciente. | [ ] | Medio | [ ] |
| R4 | Recolección sin consentimiento válido / granularidad insuficiente. | [ ] | Alto | [ ] |
| R5 | Datos de menores sin consentimiento de tutor. | [ ] | Alto | [ ] |
| R6 | Falta de respuesta a ejercicio de derechos en 30 días. | [ ] | Medio | [ ] |
| R7 | Brecha no notificada en plazo (Agencia / ANCI). | [ ] | Alto | [ ] |
| R8 | Retención excesiva más allá de la finalidad. | [ ] | Medio | [ ] |

*(Completar matriz probabilidad × impacto con el clínico/legal.)*

---

## 8. Medidas de mitigación

**Técnicas**
- Políticas `@@allow`/`@@deny` (ZenStack) por rol; `@@deny('all', auth()==null)`.
- Cifrado en reposo (Railway PG, R2); TLS en tránsito.
- **PHI nunca en bucket público R2** → bucket privado + descarga firmada para exportaciones.
- **Scrubbing de PHI** en Sentry/logs (sin puntajes ni identificadores en payloads de error).
- Cómputo del CSMS **server-side**; validación Zod de síntomas 0–3; rechazo de fuera de rango.
- Cadena de auditoría HMAC cubre lecturas del eDiary.

**Organizativas**
- Consentimiento explícito **por finalidad** (F1–F4) con flujo de revocación.
- Copy de seguridad no descartable (SAMU 131, ventana 30 min, reacción bifásica) firmado por clínico (ver §10).
- Workflow ARCO+P con SLA 30 días.
- Playbook de brechas dual (ver §9).
- Designar DPO [si aplica] y enlazar al RAT.

---

## 9. Brechas — playbook dual (deberes independientes)

**A) Ley 21.719 — Art. 14 quinquies (Agencia de Protección de Datos):**
- Notificar a la Agencia "por el medio más expedito posible y sin dilaciones indebidas" ante brecha con riesgo razonable a los derechos.
- Notificar a los **titulares** afectados (o aviso masivo si es inviable).
- Sin plazo numérico en el estatuto → objetivo de diligencia **≤72h** (un número podría llegar por reglamento). Omisión = infracción grave (hasta 10.000 UTM).

**B) Ley 21.663 — ANCI / CSIRT Nacional (salud = servicio esencial):**
- **Alerta temprana: 3 horas** desde que se conoce el incidente.
- **Reporte completo: 72 horas** (→ **24 horas** si Bioalergia es OIV y el incidente afecta el servicio esencial).
- **Acción:** confirmar designación OSE/OIV de Bioalergia ante ANCI. Pre-escribir plantillas de ambos caminos.

---

## 10. Copy de seguridad obligatorio (no descartable, firmado por clínico)

Visible siempre en la PWA (banner persistente + gate de onboarding):
- **Ventana de observación:** permanecer ≥30 min bajo observación tras la administración de inmunoterapia.
- **Anafilaxia / reacción bifásica:** las reacciones pueden ser inmediatas o **tardías (horas después)**.
- **Emergencia: SAMU 131** (prominente) + "acude a urgencias".

**Interstitial bloqueante "Busca atención AHORA / llama al 131"** si el paciente reporta cualquier red-flag (NO son ítems del diario; triage separado): dificultad para respirar/sibilancias/opresión torácica; hinchazón de labios/lengua/garganta/cara; urticaria generalizada que se extiende; mareo/desmayo; náusea/vómito + cólicos con lo anterior; sensación de "algo malo va a pasar".

**Regla dura:** el diario **NUNCA** da consejo médico ni guía de dosis. Solo registra y muestra tendencias. La única copia directiva permitida es la escalada de seguridad (131).

---

## 11. Plan de monitoreo y re-evaluación

- Revisión periódica [cadencia — p.ej. anual] o ante: cambio de finalidad, nuevo encargado, cambio en el scoring, publicación del reglamento de la Agencia, incidente de seguridad.
- Remapear a la plantilla oficial de EIPD de la Agencia cuando se publique.

---

## 12. Riesgo residual y decisión

- Riesgo residual tras mitigaciones: [ ] Bajo · [ ] Medio · [ ] Alto.
- Si residual **Alto** → **consulta previa a la Agencia** antes del go-live.
- Decisión: ________________  Firma responsable: ________  Firma clínico: ________  Fecha: ______

---

## Checklist de cierre (pre-go-live)

- [ ] Razón social + RUT del responsable; DPO designado si aplica.
- [ ] Entrada RAT "eDiary síntomas" creada con plazo/criterio de retención.
- [ ] DPAs confirmados (Railway, R2, Resend); transferencias internacionales documentadas.
- [ ] PHI fuera de bucket público; scrubbing Sentry verificado.
- [ ] Pantallas de consentimiento F1–F4 (granular, revocable) implementadas.
- [ ] Export self-serve (portabilidad) + canal ARCO+P con SLA 30 días.
- [ ] Copy de seguridad §10 firmado por clínico y no descartable.
- [ ] Playbook de brechas dual escrito; designación OSE/OIV confirmada.
- [ ] Matriz de riesgo completada; decisión de riesgo firmada.
- [ ] Flujo de menores (consentimiento de tutor) definido.

---

## Fuentes (research golden-2026)

- BCN — Ley 21.719 (texto consolidado, verificar artículos).
- Thomson Reuters — *Ley 21.719 y la reconstrucción del derecho chileno de protección de datos*.
- XMS Latam — *EIPD Chile 2026* · *Datos sensibles y biométricos Ley 21.719*.
- amsoft — *AIPD: metodología y contenido*.
- Ciberlex — *Derechos ARCO+ Ley 21.719*.
- Asentic / Prey / Datlia — *Ley 21.663 (ANCI) + notificación de brechas*.
- Netprovider — *Ley 21.719 e IA (decisiones automatizadas)*.
